
import pg from "pg";
import { env } from "./env.js";
import { logger } from "./logger.js";

const { Pool } = pg;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// PostgreSQL connection pool
export const pool = new Pool(poolConfig);

// Handle unexpected idle connection errors
pool.on("error", (error) => {
  logger.error(
    { err: error },
    "Unexpected error from an idle PostgreSQL client"
  );
});

/**
 * Execute a query without tenant context.
 *
 * Use only for operations that genuinely do not require
 * tenant-scoped access, such as database health checks.
 *
 * Never use this function for tenant-scoped queries.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Verify PostgreSQL connectivity.
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
 *
 * Every query inside the callback must use the supplied
 * PostgreSQL client.
 */
export async function withTransaction(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("A transaction callback is required.");
  }

  const client = await pool.connect();

  let destroyClient = false;

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      destroyClient = true;

      logger.error(
        { err: rollbackError },
        "Failed to roll back PostgreSQL transaction"
      );
    }

    throw error;
  } finally {
    // Destroy the connection if rollback failed.
    // Otherwise, safely return it to the pool.
    if (destroyClient) {
      client.release(
        new Error("PostgreSQL transaction rollback failed")
      );
    } else {
      client.release();
    }
  }
}

/**
 * Execute tenant-scoped operations in a transaction.
 *
 * Tenant context is set using PostgreSQL's transaction-local
 * configuration, so it automatically resets after COMMIT
 * or ROLLBACK.
 *
 * IMPORTANT:
 * - tenantId must come from authenticated, authorized membership.
 * - Never trust tenantId directly from frontend input.
 * - All queries must use the supplied client.
 * - Never use pool.query() inside this callback.
 *
 * Example:
 *
 * await withTenantTransaction(tenantId, async (client) => {
 *   return client.query(
 *     `SELECT id, email
 *      FROM public.users
 *      WHERE tenant_id = $1`,
 *     [tenantId]
 *   );
 * });
 */
export async function withTenantTransaction(tenantId, callback) {
  if (
    typeof tenantId !== "string" ||
    !UUID_REGEX.test(tenantId)
  ) {
    throw new TypeError("A valid tenant UUID is required.");
  }

  if (typeof callback !== "function") {
    throw new TypeError("A transaction callback is required.");
  }

  return withTransaction(async (client) => {
    // Set tenant context for this transaction only.
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    // Verify that PostgreSQL received the correct context.
    const contextResult = await client.query(`
      SELECT public.app_current_tenant_id() AS tenant_id
    `);

    if (
      contextResult.rows[0]?.tenant_id?.toLowerCase() !==
      tenantId.toLowerCase()
    ) {
      throw new Error(
        "Failed to establish PostgreSQL tenant context."
      );
    }

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
