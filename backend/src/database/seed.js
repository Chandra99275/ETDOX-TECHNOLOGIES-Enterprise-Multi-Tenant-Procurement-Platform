import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    let files;

    try {
      files = (await fs.readdir(SEEDS_DIR))
        .filter((file) => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(
          'No seeds directory found. Create src/database/seeds when seed SQL is ready.'
        );
        return;
      }

      throw error;
    }

    if (files.length === 0) {
      console.log('No SQL seed files found.');
      return;
    }

    // Track executed seed scripts to avoid running them repeatedly.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_seeds (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await client.query(
      'SELECT name FROM schema_seeds'
    );

    const appliedSeeds = new Set(
      result.rows.map((row) => row.name)
    );

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

      try {
        await client.query(sql);

        await client.query(
          'INSERT INTO schema_seeds (name) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`Seed completed: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Seed failed (${file}): ${error.message}`,
          { cause: error }
        );
      }
    }

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

