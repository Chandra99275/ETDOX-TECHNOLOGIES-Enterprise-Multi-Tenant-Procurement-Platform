import { randomUUID } from "node:crypto";
import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";

/**
 * Check if PostgreSQL is currently accessible.
 */
export async function isPostgresConnected() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

function mapUserRow(row) {
  if (!row) return null;

  let roles = row.roles;
  if (typeof roles === "string") {
    try {
      roles = JSON.parse(roles);
    } catch {
      roles = [];
    }
  }

  const roleList = Array.isArray(roles) ? roles.filter(Boolean) : [];
  const primaryRole = roleList[0] || row.requested_role || "requester";

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email,
    passwordHash: row.password_hash,
    tenantId: row.tenant_id,
    organizationName: row.organization_name || "ETDOX Global Technologies",
    status: row.status || (row.is_active ? "ACTIVE" : "DISABLED"),
    isActive: row.is_active !== false && row.status !== "DISABLED" && row.status !== "SUSPENDED",
    emailVerifiedAt: row.email_verified_at,
    requestedRole: row.requested_role,
    role: primaryRole,
    roleName: primaryRole,
    roles: roleList.length > 0 ? roleList : [primaryRole],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();

  const res = await pool.query(
    `SELECT u.*, t.name as organization_name,
            COALESCE(
              json_agg(DISTINCT role_names.name) FILTER (WHERE role_names.name IS NOT NULL),
              '[]'::json
            ) as roles
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN roles rd ON rd.id = u.role_id
     LEFT JOIN LATERAL (
       SELECT r.name WHERE r.name IS NOT NULL
       UNION
       SELECT rd.name WHERE rd.name IS NOT NULL
     ) role_names ON true
     WHERE LOWER(u.email) = LOWER($1)
     GROUP BY u.id, t.name
     LIMIT 1`,
    [normalized]
  );

  return mapUserRow(res.rows[0]);
}

export async function findUserById(id) {
  if (!id) return null;

  const res = await pool.query(
    `SELECT u.*, t.name as organization_name,
            COALESCE(
              json_agg(DISTINCT role_names.name) FILTER (WHERE role_names.name IS NOT NULL),
              '[]'::json
            ) as roles
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN roles rd ON rd.id = u.role_id
     LEFT JOIN LATERAL (
       SELECT r.name WHERE r.name IS NOT NULL
       UNION
       SELECT rd.name WHERE rd.name IS NOT NULL
     ) role_names ON true
     WHERE u.id = $1
     GROUP BY u.id, t.name
     LIMIT 1`,
    [id]
  );

  return mapUserRow(res.rows[0]);
}

export async function createTenant({ name, slug }) {
  const id = randomUUID();
  const baseSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 40).replace(/^-|-$/g, "") || "org";
  const cleanSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  // Set session tenant context so RLS check passes
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [id]);

    const res = await client.query(
      `INSERT INTO tenants (id, name, slug, status, base_currency)
       VALUES ($1, $2, $3, 'ACTIVE', 'USD')
       RETURNING *`,
      [id, name, cleanSlug]
    );

    // Also insert into organizations for compatibility
    await client.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, cleanSlug]
    );

    await client.query("COMMIT");
    return res.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findTenantById(id) {
  if (!id) return null;
  const res = await pool.query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
}

export async function findDefaultTenant() {
  const defaultId = env.demoTenantId || "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";
  const res = await pool.query(
    `SELECT * FROM tenants WHERE id = $1 OR status = 'ACTIVE' ORDER BY (id = $1) DESC, created_at ASC LIMIT 1`,
    [defaultId]
  );
  return res.rows[0] || null;
}

export async function createUser({
  email,
  passwordHash,
  firstName,
  lastName,
  tenantId,
  status = "PENDING_VERIFICATION",
  requestedRole = "requester",
  assignedRoles = [],
}) {
  const id = randomUUID();
  const normalizedEmail = email.trim().toLowerCase();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, status, requested_role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        id,
        tenantId,
        normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        status,
        requestedRole,
        status === "ACTIVE",
      ]
    );

    // Assign initial roles if provided
    for (const roleName of assignedRoles) {
      await client.query(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         SELECT $1, $2, id FROM roles WHERE tenant_id = $1 AND LOWER(name) = LOWER($3)
         ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING`,
        [tenantId, id, roleName]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return findUserById(id);
}

export async function updateUserStatus(userId, status, emailVerified = false) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE users
       SET status = $1,
           is_active = $2,
           email_verified_at = CASE WHEN $3 = true THEN NOW() ELSE email_verified_at END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [status, status === "ACTIVE", emailVerified, userId]
    );
    return res.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function assignUserRole(userId, tenantId, roleName) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT $1, $2, id FROM roles WHERE tenant_id = $1 AND LOWER(name) = LOWER($3)
       ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING`,
      [tenantId, userId, roleName]
    );
  } finally {
    client.release();
  }
}

export async function updateUserPassword(userId, newPasswordHash) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [newPasswordHash, userId]
    );
    return res.rowCount > 0;
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------
// EMAIL VERIFICATION TOKENS (PostgreSQL Only)
// ----------------------------------------------------------------------

export async function createEmailVerificationToken({ userId, tokenHash, otp, expiresAt }) {
  const id = randomUUID();

  await pool.query(
    `INSERT INTO email_verifications (id, user_id, token_hash, otp, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, otp || null, expiresAt]
  );

  return { id, userId, tokenHash, otp, expiresAt };
}

export async function findAndConsumeVerificationToken(tokenHash) {
  const res = await pool.query(
    `UPDATE email_verifications
     SET consumed_at = NOW()
     WHERE token_hash = $1
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING *`,
    [tokenHash]
  );

  if (res.rows[0]) {
    return {
      userId: res.rows[0].user_id,
      expiresAt: res.rows[0].expires_at,
      consumedAt: res.rows[0].consumed_at,
    };
  }

  return null;
}

export async function findAndConsumeVerificationByOtp(email, otp) {
  if (!email || !otp) return null;
  const user = await findUserByEmail(email);
  if (!user) return null;

  const cleanOtp = String(otp).trim();

  const res = await pool.query(
    `UPDATE email_verifications
     SET consumed_at = NOW()
     WHERE user_id = $1
       AND otp = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING *`,
    [user.id, cleanOtp]
  );

  if (res.rows[0]) {
    return {
      userId: res.rows[0].user_id,
      expiresAt: res.rows[0].expires_at,
      consumedAt: res.rows[0].consumed_at,
    };
  }

  return null;
}

// ----------------------------------------------------------------------
// PASSWORD RESET TOKENS (PostgreSQL Only)
// ----------------------------------------------------------------------

export async function createPasswordResetToken({ userId, tokenHash, otp, expiresAt }) {
  const id = randomUUID();

  await pool.query(
    `INSERT INTO password_resets (id, user_id, token_hash, otp, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, otp || null, expiresAt]
  );

  return { id, userId, tokenHash, otp, expiresAt };
}

export async function findActivePasswordResetByOtp(email, otp) {
  if (!email || !otp) return null;
  const user = await findUserByEmail(email);
  if (!user) return null;

  const cleanOtp = String(otp).trim();

  const res = await pool.query(
    `SELECT id, user_id, token_hash, otp, expires_at
     FROM password_resets
     WHERE user_id = $1
       AND otp = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id, cleanOtp]
  );

  if (res.rows[0]) {
    return {
      id: res.rows[0].id,
      userId: res.rows[0].user_id,
      tokenHash: res.rows[0].token_hash,
      otp: res.rows[0].otp,
      expiresAt: res.rows[0].expires_at,
    };
  }

  return null;
}

export async function findAndConsumePasswordResetByOtp(email, otp) {
  if (!email || !otp) return null;
  const user = await findUserByEmail(email);
  if (!user) return null;

  const cleanOtp = String(otp).trim();

  const res = await pool.query(
    `UPDATE password_resets
     SET consumed_at = NOW()
     WHERE id = (
       SELECT id FROM password_resets
       WHERE user_id = $1
         AND otp = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING *`,
    [user.id, cleanOtp]
  );

  if (res.rows[0]) {
    return {
      id: res.rows[0].id,
      userId: res.rows[0].user_id,
      expiresAt: res.rows[0].expires_at,
      consumedAt: res.rows[0].consumed_at,
    };
  }

  return null;
}

export async function findAndConsumePasswordResetToken(tokenHash) {
  const res = await pool.query(
    `UPDATE password_resets
     SET consumed_at = NOW()
     WHERE token_hash = $1
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING *`,
    [tokenHash]
  );

  if (res.rows[0]) {
    return {
      id: res.rows[0].id,
      userId: res.rows[0].user_id,
      expiresAt: res.rows[0].expires_at,
      consumedAt: res.rows[0].consumed_at,
    };
  }

  return null;
}

// ----------------------------------------------------------------------
// SESSIONS & REVOCATION (PostgreSQL Only)
// ----------------------------------------------------------------------

export async function createSession({ userId, tenantId, tokenHash, expiresAt, ipAddress, userAgent }) {
  const id = randomUUID();
  try {
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, tenant_id, refresh_token_hash, token_hash, expires_at, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, NOW())`,
      [id, userId, tenantId, tokenHash, expiresAt, ipAddress || null, userAgent || null]
    );
  } catch (err) {
    // If user_sessions table has column differences, log but don't fail auth
    console.warn("[AuthRepository] Could not save user_session:", err.message);
  }
  return id;
}

export async function revokeUserSessions(userId) {
  try {
    await pool.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  } catch (err) {
    console.warn("[AuthRepository] Could not revoke user_sessions:", err.message);
  }
  return true;
}

export async function getUserPermissions(tenantId, roles = []) {
  if (!roles || roles.length === 0) return [];
  try {
    const res = await pool.query(
      `SELECT DISTINCT unnest(permissions) AS permission
       FROM roles
       WHERE tenant_id = $1 AND LOWER(name) = ANY($2::text[])`,
      [tenantId, roles.map((r) => String(r).toLowerCase())]
    );
    return res.rows.map((r) => r.permission);
  } catch {
    return [];
  }
}
