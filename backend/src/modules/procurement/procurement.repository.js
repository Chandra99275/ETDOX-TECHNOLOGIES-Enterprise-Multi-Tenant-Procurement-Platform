
import { randomUUID } from "node:crypto";
import { pool, withTenantTransaction } from "../../config/database.js";
import { env } from "../../config/env.js";

// ============================================================
// GENERAL HELPERS
// ============================================================

function normalizeEmail(email) {
  return typeof email === "string"
    ? email.trim().toLowerCase()
    : "";
}

function parseRoles(roles) {
  if (typeof roles === "string") {
    try {
      roles = JSON.parse(roles);
    } catch {
      roles = [];
    }
  }

  return Array.isArray(roles)
    ? roles.filter(Boolean)
    : [];
}

function mapUserRow(row) {
  if (!row) return null;

  const roles = parseRoles(row.roles);
  const primaryRole =
    row.direct_role ||
    row.role ||
    roles[0] ||
    row.requested_role ||
    "requester";

  const isActive =
    row.is_active !== false &&
    row.status !== "DISABLED" &&
    row.status !== "SUSPENDED";

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName:
      row.full_name ||
      [row.first_name, row.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      row.email,
    passwordHash: row.password_hash,
    tenantId: row.tenant_id,
    organizationName:
      row.organization_name || "ETDOX Global Technologies",
    status:
      row.status || (isActive ? "ACTIVE" : "DISABLED"),
    isActive,
    emailVerifiedAt: row.email_verified_at,
    requestedRole: row.requested_role,
    role: primaryRole,
    roleName: primaryRole,
    roles: roles.length > 0 ? roles : [primaryRole],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVerificationRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    otp: row.otp,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

function mapPasswordResetRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    otp: row.otp,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

// ============================================================
// DATABASE HEALTH
// ============================================================

export async function isPostgresConnected() {
  try {
    const result = await pool.query("SELECT 1 AS healthy");
    return result.rows[0]?.healthy === 1;
  } catch {
    return false;
  }
}

export async function checkAuthRepository() {
  const result = await pool.query("SELECT 1 AS healthy");
  return result.rows[0]?.healthy === 1;
}

// ============================================================
// USER LOOKUP
// ============================================================

/**
 * Find a user by email before tenant context is established.
 *
 * The database function must be secured appropriately and should
 * return only the user fields needed for authentication.
 */
export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        id,
        email,
        password_hash,
        tenant_id,
        first_name,
        last_name,
        full_name,
        is_active,
        direct_role
      FROM public.etdox_auth_user_by_email($1)
    `,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Resolve the role only after establishing the tenant context.
  if (!row.direct_role && row.tenant_id) {
    row.direct_role = await findAssignedRole(
      row.id,
      row.tenant_id
    );
  }

  return {
    ...row,
    role: row.direct_role,
  };
}

/**
 * Find an assigned role inside the user's tenant.
 */
async function findAssignedRole(userId, tenantId) {
  if (!userId || !tenantId) {
    return null;
  }

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT r.name AS role
        FROM public.user_roles AS ur
        INNER JOIN public.roles AS r
          ON r.id = ur.role_id
        WHERE ur.tenant_id::text = $1::text
          AND ur.user_id::text = $2::text
        ORDER BY r.name
        LIMIT 1
      `,
      [tenantId, userId]
    );

    return result.rows[0]?.role ?? null;
  });
}

/**
 * Find a user by ID within a tenant.
 *
 * Never look up the user by ID alone when authenticating a
 * tenant-scoped request.
 */
export async function findUserById(userId, tenantId) {
  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    typeof tenantId !== "string" ||
    !tenantId.trim()
  ) {
    return null;
  }

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT
          u.id,
          u.email,
          u.password_hash,
          u.tenant_id,
          u.first_name,
          u.last_name,
          concat_ws(' ', u.first_name, u.last_name) AS full_name,
          u.is_active,
          u.status,
          u.requested_role,
          u.email_verified_at,
          u.created_at,
          u.updated_at,
          t.name AS organization_name
        FROM public.users AS u
        LEFT JOIN public.tenants AS t
          ON t.id = u.tenant_id
        WHERE u.id::text = $1::text
          AND u.tenant_id::text = $2::text
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    const roleResult = await client.query(
      `
        SELECT r.name AS role
        FROM public.user_roles AS ur
        INNER JOIN public.roles AS r
          ON r.id = ur.role_id
        WHERE ur.tenant_id::text = $1::text
          AND ur.user_id::text = $2::text
        ORDER BY r.name
      `,
      [tenantId, user.id]
    );

    user.roles = roleResult.rows.map((row) => row.role);
    user.direct_role = user.roles[0] || user.requested_role || null;

    return mapUserRow(user);
  });
}

// ============================================================
// TENANTS
// ============================================================

export async function createTenant({ name, slug }) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Tenant name is required.");
  }

  const tenantId = randomUUID();

  const baseSlug = (
    slug ||
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
  )
    .slice(0, 40)
    .replace(/^-|-$/g, "") || "org";

  const cleanSlug =
    `${baseSlug}-${randomUUID().slice(0, 8)}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const result = await client.query(
      `
        INSERT INTO public.tenants
          (id, name, slug, status, base_currency)
        VALUES
          ($1, $2, $3, 'ACTIVE', 'USD')
        RETURNING *
      `,
      [tenantId, name.trim(), cleanSlug]
    );

    // Preserve compatibility with installations that use
    // both organizations and tenants.
    await client.query(
      `
        INSERT INTO public.organizations (id, name, slug)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `,
      [tenantId, name.trim(), cleanSlug]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findTenantById(id) {
  if (!id) return null;

  const result = await pool.query(
    `
      SELECT *
      FROM public.tenants
      WHERE id::text = $1::text
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function findDefaultTenant() {
  const defaultId =
    env.demoTenantId ||
    "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";

  const result = await pool.query(
    `
      SELECT *
      FROM public.tenants
      WHERE id::text = $1::text
         OR status = 'ACTIVE'
      ORDER BY
        (id::text = $1::text) DESC,
        created_at ASC
      LIMIT 1
    `,
    [defaultId]
  );

  return result.rows[0] || null;
}

// ============================================================
// USER CREATION
// ============================================================

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
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("A valid email address is required.");
  }

  if (!passwordHash) {
    throw new Error("Password hash is required.");
  }

  if (!tenantId) {
    throw new Error("Tenant ID is required.");
  }

  const userId = randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    await client.query(
      `
        INSERT INTO public.users (
          id,
          tenant_id,
          email,
          password_hash,
          first_name,
          last_name,
          status,
          requested_role,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        )
      `,
      [
        userId,
        tenantId,
        normalizedEmail,
        passwordHash,
        firstName || null,
        lastName || null,
        status,
        requestedRole,
        status === "ACTIVE",
      ]
    );

    for (const roleName of assignedRoles) {
      await client.query(
        `
          INSERT INTO public.user_roles
            (tenant_id, user_id, role_id)
          SELECT $1, $2, r.id
          FROM public.roles AS r
          WHERE r.tenant_id = $1
            AND LOWER(r.name) = LOWER($3)
          ON CONFLICT (tenant_id, user_id, role_id)
          DO NOTHING
        `,
        [tenantId, userId, roleName]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return findUserById(userId, tenantId);
}

// ============================================================
// USER STATUS AND ROLE MANAGEMENT
// ============================================================

export async function updateUserStatus(
  userId,
  status,
  emailVerified = false
) {
  const result = await pool.query(
    `
      UPDATE public.users
      SET
        status = $1,
        is_active = $2,
        email_verified_at =
          CASE
            WHEN $3::boolean THEN NOW()
            ELSE email_verified_at
          END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id
    `,
    [
      status,
      status === "ACTIVE",
      emailVerified,
      userId,
    ]
  );

  return result.rowCount > 0;
}

export async function assignUserRole(
  userId,
  tenantId,
  roleName
) {
  if (!userId || !tenantId || !roleName) {
    throw new Error(
      "User ID, tenant ID, and role name are required."
    );
  }

  return withTenantTransaction(tenantId, async (client) => {
    await client.query(
      `
        INSERT INTO public.user_roles
          (tenant_id, user_id, role_id)
        SELECT $1, $2, r.id
        FROM public.roles AS r
        WHERE r.tenant_id = $1
          AND LOWER(r.name) = LOWER($3)
        ON CONFLICT (tenant_id, user_id, role_id)
        DO NOTHING
      `,
      [tenantId, userId, roleName]
    );

    return true;
  });
}

// ============================================================
// PASSWORD MANAGEMENT
// ============================================================

export async function updateUserPassword(
  userId,
  newPasswordHash
) {
  if (!userId || !newPasswordHash) {
    throw new Error(
      "User ID and password hash are required."
    );
  }

  const result = await pool.query(
    `
      UPDATE public.users
      SET password_hash = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [newPasswordHash, userId]
  );

  return result.rowCount > 0;
}

// ============================================================
// EMAIL VERIFICATION TOKENS
// ============================================================

export async function createEmailVerificationToken({
  userId,
  tokenHash,
  otp,
  expiresAt,
}) {
  if (!userId || !tokenHash || !expiresAt) {
    throw new Error(
      "User ID, token hash, and expiry are required."
    );
  }

  const id = randomUUID();

  const result = await pool.query(
    `
      INSERT INTO public.email_verifications (
        id,
        user_id,
        token_hash,
        otp,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [id, userId, tokenHash, otp || null, expiresAt]
  );

  return mapVerificationRow(result.rows[0]);
}

export async function findAndConsumeVerificationToken(
  tokenHash
) {
  if (!tokenHash) return null;

  const result = await pool.query(
    `
      UPDATE public.email_verifications
      SET consumed_at = NOW()
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING *
    `,
    [tokenHash]
  );

  return mapVerificationRow(result.rows[0]);
}

export async function findAndConsumeVerificationByOtp(
  email,
  otp
) {
  const normalizedEmail = normalizeEmail(email);
  const cleanOtp = String(otp || "").trim();

  if (!normalizedEmail || !cleanOtp) {
    return null;
  }

  const user = await findUserByEmail(normalizedEmail);

  if (!user?.id) {
    return null;
  }

  const result = await pool.query(
    `
      UPDATE public.email_verifications
      SET consumed_at = NOW()
      WHERE id = (
        SELECT ev.id
        FROM public.email_verifications AS ev
        WHERE ev.user_id = $1
          AND ev.otp = $2
          AND ev.consumed_at IS NULL
          AND ev.expires_at > NOW()
        ORDER BY ev.expires_at DESC
        LIMIT 1
        FOR UPDATE
      )
      RETURNING *
    `,
    [user.id, cleanOtp]
  );

  return mapVerificationRow(result.rows[0]);
}

// ============================================================
// PASSWORD RESET TOKENS
// ============================================================

export async function createPasswordResetToken({
  userId,
  tokenHash,
  otp,
  expiresAt,
}) {
  if (!userId || !tokenHash || !expiresAt) {
    throw new Error(
      "User ID, token hash, and expiry are required."
    );
  }

  const id = randomUUID();

  const result = await pool.query(
    `
      INSERT INTO public.password_resets (
        id,
        user_id,
        token_hash,
        otp,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [id, userId, tokenHash, otp || null, expiresAt]
  );

  return mapPasswordResetRow(result.rows[0]);
}

export async function findActivePasswordResetByOtp(
  email,
  otp
) {
  const normalizedEmail = normalizeEmail(email);
  const cleanOtp = String(otp || "").trim();

  if (!normalizedEmail || !cleanOtp) {
    return null;
  }

  const user = await findUserByEmail(normalizedEmail);

  if (!user?.id) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        id,
        user_id,
        token_hash,
        otp,
        expires_at,
        consumed_at
      FROM public.password_resets
      WHERE user_id = $1
        AND otp = $2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [user.id, cleanOtp]
  );

  return mapPasswordResetRow(result.rows[0]);
}

export async function findAndConsumePasswordResetByOtp(
  email,
  otp
) {
  const normalizedEmail = normalizeEmail(email);
  const cleanOtp = String(otp || "").trim();

  if (!normalizedEmail || !cleanOtp) {
    return null;
  }

  const user = await findUserByEmail(normalizedEmail);

  if (!user?.id) {
    return null;
  }

  const result = await pool.query(
    `
      UPDATE public.password_resets
      SET consumed_at = NOW()
      WHERE id = (
        SELECT pr.id
        FROM public.password_resets AS pr
        WHERE pr.user_id = $1
          AND pr.otp = $2
          AND pr.consumed_at IS NULL
          AND pr.expires_at > NOW()
        ORDER BY pr.created_at DESC
        LIMIT 1
        FOR UPDATE
      )
      RETURNING *
    `,
    [user.id, cleanOtp]
  );

  return mapPasswordResetRow(result.rows[0]);
}

export async function findAndConsumePasswordResetToken(
  tokenHash
) {
  if (!tokenHash) return null;

  const result = await pool.query(
    `
      UPDATE public.password_resets
      SET consumed_at = NOW()
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING *
    `,
    [tokenHash]
  );

  return mapPasswordResetRow(result.rows[0]);
}

// ============================================================
// USER SESSIONS
// ============================================================

export async function createSession({
  userId,
  tenantId,
  tokenHash,
  expiresAt,
  ipAddress,
  userAgent,
}) {
  if (!userId || !tenantId || !tokenHash || !expiresAt) {
    throw new Error(
      "User ID, tenant ID, token hash, and expiry are required."
    );
  }

  const id = randomUUID();

  try {
    await pool.query(
      `
        INSERT INTO public.user_sessions (
          id,
          user_id,
          tenant_id,
          refresh_token_hash,
          token_hash,
          expires_at,
          ip_address,
          user_agent,
          created_at
        )
        VALUES ($1, $2, $3, $4, $4, $5, $6, $7, NOW())
      `,
      [
        id,
        userId,
        tenantId,
        tokenHash,
        expiresAt,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    // Do not silently treat a failed session insert as a secure
    // session. Log the failure for investigation.
    console.error(
      "[AuthRepository] Could not create session:",
      error.message
    );

    throw error;
  }

  return id;
}

export async function revokeUserSessions(userId) {
  if (!userId) return false;

  const result = await pool.query(
    `
      UPDATE public.user_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId]
  );

  return result.rowCount >= 0;
}

// ============================================================
// ROLE PERMISSIONS
// ============================================================

export async function getUserPermissions(
  tenantId,
  roles = []
) {
  if (!tenantId || !Array.isArray(roles) || roles.length === 0) {
    return [];
  }

  try {
    return await withTenantTransaction(
      tenantId,
      async (client) => {
        const result = await client.query(
          `
            SELECT DISTINCT
              unnest(r.permissions) AS permission
            FROM public.roles AS r
            WHERE r.tenant_id = $1
              AND LOWER(r.name) = ANY($2::text[])
          `,
          [
            tenantId,
            roles.map((role) =>
              String(role).toLowerCase()
            ),
          ]
        );

        return result.rows
          .map((row) => row.permission)
          .filter(Boolean);
      }
    );
  } catch (error) {
    console.error(
      "[AuthRepository] Could not load permissions:",
      error.message
    );

    throw error;
  }
}
