
import { Pool } from "pg";
import { env } from "../config/env.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --------------------------------------------------
// PostgreSQL connection pool
// --------------------------------------------------

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: "etdox-procurement-api",
});

pool.on("error", (error) => {
  console.error(
    "[Database] Unexpected error on an idle PostgreSQL client:",
    error.message
  );
});

// --------------------------------------------------
// Basic query helpers
// --------------------------------------------------

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function getClient() {
  return pool.connect();
}

// --------------------------------------------------
// Transaction helper
// --------------------------------------------------

export async function withTransaction(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("withTransaction requires a callback.");
  }

  const client = await getClient();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await fn(client);

    await client.query("COMMIT");
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Database] Transaction rollback failed:",
          rollbackError.message
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

// --------------------------------------------------
// Tenant-scoped transaction helper
// --------------------------------------------------

export async function withTenantTransaction(tenantId, fn) {
  if (
    typeof tenantId !== "string" ||
    !UUID_RE.test(tenantId)
  ) {
    throw Object.assign(
      new Error("A valid tenant UUID is required."),
      {
        statusCode: 400,
        code: "INVALID_TENANT_ID",
      }
    );
  }

  if (typeof fn !== "function") {
    throw new TypeError(
      "withTenantTransaction requires a callback."
    );
  }

  return withTransaction(async (client) => {
    // Transaction-local setting resets automatically when
    // the transaction commits or rolls back.
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    return fn(client);
  });
}

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

export async function closeDatabase() {
  await pool.end();
}
