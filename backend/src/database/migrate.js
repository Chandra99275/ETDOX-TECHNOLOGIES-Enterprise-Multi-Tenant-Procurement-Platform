
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK_ID = 72416001;

async function migrate() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query(
      'SELECT pg_advisory_lock($1)',
      [MIGRATION_LOCK_ID]
    );
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No SQL migration files found.');
      return;
    }

    const result = await client.query(
      'SELECT name FROM schema_migrations'
    );

    const appliedMigrations = new Set(
      result.rows.map((row) => row.name)
    );

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, 'utf8');

      console.log(`Applying migration: ${file}`);

      await client.query('BEGIN');

      try {
        await client.query(sql);

        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`Migration applied successfully: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration failed (${file}): ${error.message}`,
          { cause: error }
        );
      }
    }

    console.log('All database migrations completed.');
  } catch (error) {
    console.error('Database migration failed:', error.message);
    throw error;
  } finally {
    if (lockAcquired) {
      try {
        await client.query(
          'SELECT pg_advisory_unlock($1)',
          [MIGRATION_LOCK_ID]
        );
      } catch (error) {
        console.error('Could not release migration lock:', error.message);
      }
    }

    client.release();
  }
}

migrate()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
