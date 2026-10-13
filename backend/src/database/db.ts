import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.databaseUrl, max: 20,
  idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000,
});
export const query = (text: string, params?: unknown[]) => pool.query(text, params);
export const getClient = (): Promise<PoolClient> => pool.connect();

export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await getClient();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

export function withTenantTransaction<T>(
  tenantId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(async client => {
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    return fn(client);
  });
}
