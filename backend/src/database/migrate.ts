import fs from 'fs';
import path from 'path';
import { pool, withTransaction } from './db';

async function migrate(): Promise<void> {
  const dir = path.join(__dirname, 'migrations');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [f]);
    if (existing.rowCount) continue;
    console.log('Applying', f);
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await withTransaction(async client => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    });
  }
}

migrate().catch(error => {
  console.error('Database migration failed', error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
