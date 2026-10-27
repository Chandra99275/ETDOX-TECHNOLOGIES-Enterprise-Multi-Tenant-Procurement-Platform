
import { pool } from "../../config/database.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --------------------------------------------------
// 1. Map database records
// --------------------------------------------------

function mapUser(row) {
  if (!row) return null;

  let roles = row.roles ?? [];

  if (typeof roles === "string") {
    try {
      roles = JSON.parse(roles);
    } catch {
      roles = [];
    }
  }

  if (!Array.isArray(roles)) {
    roles = [];
  }

  return {
    id: row.id,
    email: row.email,
    name:
      [row.first_name, row.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      row.name ||
      row.email,
    tenantId: row.tenant_id,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    roles,
  };
}

// --------------------------------------------------
// 2. Shared user query
// --------------------------------------------------

const userSelect = `
  SELECT
    u.id,
    u.email,
    u.password_hash,
    u.tenant_id,
    u.is_active,
    u.first_name,
    u.last_name,
    COALESCE(
      json_agg(DISTINCT r.name)
        FILTER (WHERE r.name IS NOT NULL),
      '[]'::json
    ) AS roles
  FROM users u
  LEFT JOIN user_roles ur
    ON ur.user_id = u.id
   AND ur.tenant_id = u.tenant_id
  LEFT JOIN roles r
    ON r.id = ur.role_id
   AND r.tenant_id = ur.tenant_id
`;

// --------------------------------------------------
// 3. Execute a query with tenant context
// --------------------------------------------------

async function withTenantContext(tenantId, callback) {
  if (!tenantId || !UUID_RE.test(String(tenantId))) {
    throw Object.assign(
      new Error("A valid tenant ID is required."),
      {
        statusCode: 400,
        code: "INVALID_TENANT_ID",
      }
    );
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Transaction-local setting: it resets at transaction end.
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const result = await callback(client);

    await client.query("COMMIT");
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original error.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

// --------------------------------------------------
// 4. Find user by email
// --------------------------------------------------
// Tenant ID must be known before querying. This avoids
// selecting an account from an arbitrary tenant.

export async function findByEmail(email, tenantId) {
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  if (!tenantId) {
    throw Object.assign(
      new Error(
        "Tenant ID is required for tenant-scoped login."
      ),
      {
        statusCode: 400,
        code: "TENANT_REQUIRED",
      }
    );
  }

  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `
        ${userSelect}
        WHERE LOWER(u.email) = LOWER($1)
          AND u.tenant_id = $2
        GROUP BY
          u.id,
          u.email,
          u.password_hash,
          u.tenant_id,
          u.is_active,
          u.first_name,
          u.last_name
        LIMIT 1
      `,
      [email.trim(), tenantId]
    );

    return mapUser(result.rows[0]);
  });
}

// --------------------------------------------------
// 5. Find user by ID
// --------------------------------------------------

export async function findPublicById(userId, tenantId) {
  if (!userId || !tenantId) {
    throw Object.assign(
      new Error("User ID and tenant ID are required."),
      {
        statusCode: 400,
        code: "USER_AND_TENANT_REQUIRED",
      }
    );
  }

  return withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `
        ${userSelect}
        WHERE u.id = $1
          AND u.tenant_id = $2
        GROUP BY
          u.id,
          u.email,
          u.password_hash,
          u.tenant_id,
          u.is_active,
          u.first_name,
          u.last_name
        LIMIT 1
      `,
      [userId, tenantId]
    );

    const user = mapUser(result.rows[0]);

    if (!user) return null;

    const {
      passwordHash,
      isActive,
      ...publicUser
    } = user;

    return publicUser;
  });
}

// --------------------------------------------------
// 6. Update last login
// --------------------------------------------------

export async function updateLastLogin(userId, tenantId) {
  if (!userId || !tenantId) {
    throw Object.assign(
      new Error(
        "User ID and tenant ID are required to update last login."
      ),
      {
        statusCode: 400,
        code: "USER_AND_TENANT_REQUIRED",
      }
    );
  }

  return withTenantContext(tenantId, async (client) => {
    // This assumes last_login_at exists in your users table.
    const result = await client.query(
      `
        UPDATE users
        SET last_login_at = NOW()
        WHERE id = $1
          AND tenant_id = $2
        RETURNING id
      `,
      [userId, tenantId]
    );

    return result.rowCount > 0;
  });
}
