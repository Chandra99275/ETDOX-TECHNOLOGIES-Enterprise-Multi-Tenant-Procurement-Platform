<<<<<<< HEAD
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';
=======

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/database.js";
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

<<<<<<< HEAD
const SEEDS_DIR = path.join(__dirname, 'seeds');
const SEED_LOCK_ID = 72416002;

async function seed() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query(
      'SELECT pg_advisory_lock($1)',
      [SEED_LOCK_ID]
    );
    lockAcquired = true;

=======
const SEEDS_DIR = path.join(__dirname, "seeds");
const SEED_LOCK_ID = 72416002;

async function seed() {
  let client;
  let lockAcquired = false;

  try {
    // Connect to PostgreSQL.
    client = await pool.connect();

    // Prevent multiple seed processes from running simultaneously.
    await client.query("SELECT pg_advisory_lock($1)", [SEED_LOCK_ID]);
    lockAcquired = true;

    // Check whether the seeds directory exists.
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
    let files;

    try {
      files = (await fs.readdir(SEEDS_DIR))
<<<<<<< HEAD
        .filter((file) => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(
          'No seeds directory found. Create src/database/seeds when seed SQL is ready.'
=======
        .filter((file) => file.endsWith(".sql"))
        .sort();
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(
          "No seeds directory found. Create backend/src/database/seeds first."
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
        );
        return;
      }

      throw error;
    }

    if (files.length === 0) {
<<<<<<< HEAD
      console.log('No SQL seed files found.');
      return;
    }

    // Track executed seed scripts to avoid running them repeatedly.
=======
      console.log("No SQL seed files found.");
      return;
    }

    // Create the seed tracking table.
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_seeds (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

<<<<<<< HEAD
    const result = await client.query(
      'SELECT name FROM schema_seeds'
=======
    // Load previously executed seed files.
    const result = await client.query(
      "SELECT name FROM schema_seeds"
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
    );

    const appliedSeeds = new Set(
      result.rows.map((row) => row.name)
    );

<<<<<<< HEAD
    for (const file of files) {
      if (appliedSeeds.has(file)) {
        console.log(`Skipping already executed seed: ${file}`);
        continue;
      }

      const sql = await fs.readFile(
        path.join(SEEDS_DIR, file),
        'utf8'
      );

      console.log(`Executing seed: ${file}`);

      await client.query('BEGIN');
=======
    // Execute seed files in alphabetical order.
    for (const file of files) {
      if (appliedSeeds.has(file)) {
        console.log(`Skipping previously executed seed: ${file}`);
        continue;
      }

      const filePath = path.join(SEEDS_DIR, file);
      const sql = await fs.readFile(filePath, "utf8");

      if (!sql.trim()) {
        console.log(`Skipping empty seed file: ${file}`);
        continue;
      }

      console.log(`Executing seed: ${file}`);

      await client.query("BEGIN");
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

      try {
        await client.query(sql);

        await client.query(
<<<<<<< HEAD
          'INSERT INTO schema_seeds (name) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`Seed completed: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
=======
          "INSERT INTO schema_seeds (name) VALUES ($1)",
          [file]
        );

        await client.query("COMMIT");

        // Track the seed in memory only after the transaction succeeds.
        appliedSeeds.add(file);

        console.log(`Seed completed successfully: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");

>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
        throw new Error(
          `Seed failed (${file}): ${error.message}`,
          { cause: error }
        );
      }
    }

<<<<<<< HEAD
    console.log('All database seeds completed.');
  } catch (error) {
    console.error('Database seeding failed:', error.message);
    throw error;
  } finally {
    if (lockAcquired) {
      try {
        await client.query(
          'SELECT pg_advisory_unlock($1)',
          [SEED_LOCK_ID]
        );
      } catch (error) {
        console.error('Could not release seed lock:', error.message);
      }
    }

    client.release();
  }
}

seed()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

=======
    console.log("All database seeds completed successfully.");
  } catch (error) {
    console.error("Database seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    // Release the advisory lock before releasing the connection.
    if (client && lockAcquired) {
      try {
        await client.query(
          "SELECT pg_advisory_unlock($1)",
          [SEED_LOCK_ID]
        );
      } catch (error) {
        console.error(
          "Could not release seed lock:",
          error.message
        );
      }
    }

    if (client) {
      client.release();
    }

    // Close the pool when this standalone script finishes.
    await pool.end();
  }
}

await seed();
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
