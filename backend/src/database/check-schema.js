import "dotenv/config";

import { pool, closeDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";

const REQUIRED_TABLES = [
  "tenants",
  "users",
  "roles",
  "user_roles",
  "purchase_requests",
  "budgets",
  "invoices",
  "goods_receipt_items",
];

async function checkConnection(client) {
  const result = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      NOW() AS checked_at
  `);

  console.log("\n=== DATABASE CONNECTION ===");
  console.table(result.rows);
}

async function checkRequiredTables(client) {
  const result = await client.query(
    `SELECT
       required.table_name,
       CASE
         WHEN tables.table_name IS NULL THEN 'MISSING'
         ELSE 'PRESENT'
       END AS status
     FROM unnest($1::text[]) AS required(table_name)
     LEFT JOIN information_schema.tables AS tables
       ON tables.table_schema = 'public'
      AND tables.table_name = required.table_name
     ORDER BY required.table_name`,
    [REQUIRED_TABLES]
  );

  console.log("\n=== REQUIRED TABLES ===");
  console.table(result.rows);

  return result.rows;
}

async function checkMigrationHistory(client) {
  const tableResult = await client.query(
    `SELECT to_regclass('public.schema_migrations') AS table_name`
  );

  console.log("\n=== MIGRATION HISTORY ===");

  if (!tableResult.rows[0]?.table_name) {
    console.log("schema_migrations table does not exist.");
    return;
  }

  const columnsResult = await client.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'schema_migrations'
     ORDER BY ordinal_position`
  );

  console.log("Migration tracking columns:");
  console.table(columnsResult.rows);

  const columns = columnsResult.rows.map((row) => row.column_name);

  const nameColumn = [
    "migration_name",
    "filename",
    "file_name",
    "name",
    "version",
  ].find((column) => columns.includes(column));

  const appliedColumn = [
    "applied_at",
    "created_at",
    "executed_at",
  ].find((column) => columns.includes(column));

  if (!nameColumn) {
    console.warn(
      "Unable to identify the migration name column. No migration rows queried."
    );
    return;
  }

  const selectedColumns = [
    `"${nameColumn}"::text AS migration_name`,
  ];

  if (appliedColumn) {
    selectedColumns.push(`"${appliedColumn}" AS applied_at`);
  }

  const result = await client.query(
    `SELECT ${selectedColumns.join(", ")}
     FROM public.schema_migrations
     ORDER BY "${nameColumn}"::text`
  );

  console.table(result.rows);
}

async function checkRowLevelSecurity(client) {
  const result = await client.query(
    `SELECT
       schemaname,
       tablename,
       rowsecurity AS rls_enabled,
       forcerowsecurity AS rls_forced
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = ANY($1::text[])
     ORDER BY tablename`,
    [[
      "tenants",
      "users",
      "purchase_requests",
      "budgets",
      "invoices",
      "goods_receipt_items",
    ]]
  );

  console.log("\n=== ROW-LEVEL SECURITY ===");
  console.table(result.rows);
}

async function checkForeignKeys(client) {
  const result = await client.query(
    `SELECT
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS referenced_table,
       ccu.column_name AS referenced_column,
       tc.constraint_name
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_name = ANY($1::text[])
     ORDER BY tc.table_name, tc.constraint_name`,
    [[
      "users",
      "user_roles",
      "purchase_requests",
      "budgets",
      "invoices",
    ]]
  );

  console.log("\n=== FOREIGN KEY RELATIONSHIPS ===");
  console.table(result.rows);
}

async function main() {
  const client = await pool.connect();

  try {
    await checkConnection(client);

    const tables = await checkRequiredTables(client);

    await checkMigrationHistory(client);
    await checkRowLevelSecurity(client);
    await checkForeignKeys(client);

    const missingTables = tables.filter(
      (row) => row.status === "MISSING"
    );

    if (missingTables.length > 0) {
      console.warn(
        "\nSchema check completed with missing required tables:",
        missingTables.map((row) => row.table_name).join(", ")
      );

      process.exitCode = 1;
    } else {
      console.log("\nSchema check completed. All required tables are present.");
    }
  } catch (error) {
    logger.error({ err: error }, "Schema check failed");
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main().finally(async () => {
  await closeDatabase().catch((error) => {
    logger.error({ err: error }, "Failed to close database pool");
  });
});