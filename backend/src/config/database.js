import pg from "pg";
import { env } from "./env.js";
import { logger } from "./logger.js";

const { Pool } = pg;

const poolConfig = {
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: "etdox-procurement-api",
};

if (env.dbSsl) {
  poolConfig.ssl = {
    rejectUnauthorized: true,
  };
}

export const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  logger.error(
    { err: error },
    "Unexpected error from an idle PostgreSQL client"
  );
});

/**
 * Execute a query.
 *
 * Use this for queries that do not require tenant context,
 * such as a basic database health check.
 *
 * Tenant-scoped queries should use withTenantTransaction().
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Verify that PostgreSQL is accessible.
 */
export async function checkDatabase() {
  const result = await pool.query(`
    SELECT
      current_database() AS database,
      NOW() AS server_time
  `);

  return result.rows[0];
}

/**
 * Execute multiple queries in one transaction.
 */
export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { err: rollbackError },
        "Failed to roll back PostgreSQL transaction"
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute tenant-scoped operations in a transaction.
 *
 * Example:
 *
 * await withTenantTransaction(tenantId, async (client) => {
 *   return client.query(
 *     "SELECT id, email FROM users WHERE tenant_id = $1",
 *     [tenantId]
 *   );
 * });
 */
export async function withTenantTransaction(tenantId, callback) {
  if (
    typeof tenantId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantId
    )
  ) {
    throw new TypeError("A valid tenant UUID is required.");
  }

  if (typeof callback !== "function") {
    throw new TypeError("A transaction callback is required.");
  }

  return withTransaction(async (client) => {
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    return callback(client);
  });
}

/**
 * Close the pool during graceful server shutdown.
 */
export async function closeDatabase() {
  await pool.end();

  logger.info("PostgreSQL connection pool closed");
}