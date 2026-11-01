import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { pool, closeDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Migrations 002–010 are intentionally blocked because this project has
// existing schema objects and those migrations have not been verified.
const BLOCKED_MIGRATIONS = new Set([
  "002",
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "010",
]);

const APPLY_MIGRATIONS =
  process.env.MIGRATION_APPLY === "true";

const ALLOWLIST = new Set(
  (process.env.MIGRATION_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

function migrationNumber(filename) {
  const match = filename.match(/^(\d+)[_-]/);
  return match ? match[1] : null;
}

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function getMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, {
    withFileTypes: true,
  });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^\d+[_-].+\.sql$/i.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => {
      const numberA = Number(migrationNumber(a));
      const numberB = Number(migrationNumber(b));

      return numberA - numberB || a.localeCompare(b);
    });
}

/**
 * Inspect the existing migration tracking table instead of assuming
 * its columns match a newly invented schema.
 */
async function inspectMigrationTracking(client) {
  const tableResult = await client.query(
    `SELECT to_regclass('public.schema_migrations') AS table_name`
  );

  if (!tableResult.rows[0]?.table_name) {
    return {
      exists: false,
      columns: [],
      records: [],
    };
  }

  const columnResult = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'schema_migrations'
     ORDER BY ordinal_position`
  );

  const columns = columnResult.rows.map((row) => row.column_name);

  const nameColumn = [
    "migration_name",
    "filename",
    "file_name",
    "name",
    "version",
  ].find((column) => columns.includes(column));

  if (!nameColumn) {
    throw new Error(
      "Cannot safely identify migration records in schema_migrations. " +
      `Found columns: ${columns.join(", ")}. Inspect the table before proceeding.`
    );
  }

  // The identifier comes from a fixed allowlist of column names obtained
  // from information_schema, not from user input.
  const recordsResult = await client.query(
    `SELECT "${nameColumn}"::text AS migration_name
     FROM public.schema_migrations`
  );

  return {
    exists: true,
    columns,
    records: recordsResult.rows.map((row) => row.migration_name),
  };
}

function isRecorded(filename, records) {
  const number = migrationNumber(filename);

  return records.some((record) => {
    const value = String(record);

    return (
      value === filename ||
      value === number ||
      (number && value.startsWith(`${number}_`)) ||
      (number && value.startsWith(`${number}-`))
    );
  });
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      migration_name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function recordMigration(client, filename, fileChecksum) {
  const tracking = await inspectMigrationTracking(client);

  const nameColumn = [
    "migration_name",
    "filename",
    "file_name",
    "name",
    "version",
  ].find((column) => tracking.columns.includes(column));

  if (!nameColumn) {
    throw new Error(
      "The migration tracking table has no supported migration name column."
    );
  }

  const checksumColumn = tracking.columns.includes("checksum")
    ? "checksum"
    : null;

  const appliedAtColumn = tracking.columns.includes("applied_at")
    ? "applied_at"
    : null;

  const columns = [`"${nameColumn}"`];
  const values = [filename];

  if (checksumColumn) {
    columns.push(`"${checksumColumn}"`);
    values.push(fileChecksum);
  }

  if (appliedAtColumn) {
    // Use the database's default for the timestamp column.
    // This column is omitted from the INSERT below.
  }

  const placeholders = values.map((_, index) => `$${index + 1}`);

  await client.query(
    `INSERT INTO public.schema_migrations (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})`,
    values
  );
}

async function applyMigration(filename, sql) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentTracking = await inspectMigrationTracking(client);

    if (!currentTracking.exists) {
      await ensureTrackingTable(client);
    }

    // Run only the explicitly approved SQL file.
    await client.query(sql);

    await recordMigration(client, filename, checksum(sql));

    await client.query("COMMIT");

    logger.info({ migration: filename }, "Migration applied");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      logger.error(
        { err: rollbackError, migration: filename },
        "Migration rollback failed"
      );
    });

    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const client = await pool.connect();

  let tracking;

  try {
    await client.query("SELECT 1");
    tracking = await inspectMigrationTracking(client);
  } finally {
    client.release();
  }

  const files = await getMigrationFiles();

  if (files.length === 0) {
    logger.info("No SQL migration files found.");
    return;
  }

  logger.info(
    {
      migrationDirectory: MIGRATIONS_DIR,
      applyMode: APPLY_MIGRATIONS,
      availableMigrations: files.length,
    },
    "Migration inspection started"
  );

  const records = tracking?.records || [];
  const pending = files.filter(
    (filename) => !isRecorded(filename, records)
  );

  if (pending.length === 0) {
    logger.info("All discovered migration files are already recorded.");
    return;
  }

  for (const filename of pending) {
    const number = migrationNumber(filename);

    if (number && BLOCKED_MIGRATIONS.has(number)) {
      logger.warn(
        { migration: filename },
        "Migration is blocked to protect the existing schema"
      );
      continue;
    }

    if (!APPLY_MIGRATIONS) {
      logger.info(
        { migration: filename },
        "DRY RUN: migration has not been applied"
      );
      continue;
    }

    if (!ALLOWLIST.has(filename)) {
      logger.warn(
        { migration: filename },
        "Skipped: migration is not in MIGRATION_ALLOWLIST"
      );
      continue;
    }

    // Never automatically apply legacy migrations 001–011.
    // Verify existing migration history before authorizing newer files.
    if (number && Number(number) <= 11) {
      throw new Error(
        `Refusing to apply legacy migration ${filename}. ` +
        "Inspect the database and migration history first."
      );
    }

    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(fullPath, "utf8");

    if (!sql.trim()) {
      throw new Error(`Migration ${filename} is empty.`);
    }

    logger.info({ migration: filename }, "Applying approved migration");

    await applyMigration(filename, sql);
  }
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Migration process failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch((error) => {
      logger.error({ err: error }, "Failed to close database pool");
    });
  });