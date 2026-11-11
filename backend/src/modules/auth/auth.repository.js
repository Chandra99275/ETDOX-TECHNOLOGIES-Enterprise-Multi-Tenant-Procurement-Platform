
import { randomUUID } from "node:crypto";
import {
  pool,
  withTenantTransaction,
} from "../../config/database.js";

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

const DEFAULT_ROLES = [
  {
    name: "organization_admin",
    permissions: [
      "users:read",
      "users:manage",
      "roles:read",
      "roles:manage",
      "workflows:manage",
      "approvals:read",
      "approvals:act",
      "procurement:read",
      "procurement:create",
      "procurement:manage",
      "budgets:read",
      "budgets:manage",
      "analytics:read",
    ],
  },
  {
    name: "admin",
    permissions: [
      "users:read",
      "users:manage",
      "roles:read",
      "roles:manage",
      "workflows:manage",
      "approvals:read",
      "approvals:act",
      "procurement:read",
      "procurement:create",
      "procurement:manage",
      "budgets:read",
      "budgets:manage",
      "analytics:read",
    ],
  },
  {
    name: "employee",
    permissions: [
      "procurement:create",
      "procurement:read",
      "budgets:read",
    ],
  },
  {
    name: "requester",
    permissions: [
      "procurement:create",
      "procurement:read",
      "budgets:read",
    ],
  },
  {
    name: "manager",
    permissions: [
      "procurement:read",
      "approvals:read",
      "approvals:act",
      "budgets:read",
    ],
  },
  {
    name: "department_manager",
    permissions: [
      "procurement:read",
      "approvals:read",
      "approvals:act",
      "budgets:read",
    ],
  },
  {
    name: "finance",
    permissions: [
      "procurement:read",
      "approvals:read",
      "approvals:act",
      "budgets:read",
      "budgets:manage",
    ],
  },
  {
    name: "finance_manager",
    permissions: [
      "procurement:read",
      "approvals:read",
      "approvals:act",
      "budgets:read",
      "budgets:manage",
    ],
  },
  {
    name: "procurement_specialist",
    permissions: [
      "procurement:read",
      "procurement:create",
      "procurement:manage",
      "approvals:read",
    ],
  },
  {
    name: "procurement_manager",
    permissions: [
      "procurement:read",
      "procurement:manage",
      "approvals:read",
      "approvals:act",
      "budgets:read",
    ],
  },
  {
    name: "auditor",
    permissions: [
      "procurement:read",
      "budgets:read",
      "analytics:read",
    ],
  },
  {
    name: "supplier_user",
    permissions: [
      "procurement:read",
    ],
  },
];

function parseRoles(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
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

  const firstName = row.first_name ?? "";
  const lastName = row.last_name ?? "";

  return {
    id: row.id,
    email: row.email,
    firstName,
    lastName,
    fullName:
      row.full_name ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      row.email,
    passwordHash: row.password_hash,
    tenantId: row.tenant_id,
    organizationName: row.organization_name ?? null,
    status:
      row.status ||
      (row.is_active === false ? "DISABLED" : "ACTIVE"),
    isActive: row.is_active !== false,
    emailVerifiedAt: row.email_verified_at ?? null,
    requestedRole: row.requested_role ?? null,
    role: primaryRole,
    roleName: primaryRole,
    roles: roles.length ? roles : [primaryRole],
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function normalizeEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  return email.trim().toLowerCase();
}

// ------------------------------------------------------------
// Default tenant roles
// ------------------------------------------------------------

async function ensureTenantRoles(client, tenantId) {
  for (const role of DEFAULT_ROLES) {
    await client.query(
      `
        INSERT INTO public.roles (
          id,
          tenant_id,
          name,
          description,
          permissions,
          is_system,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5::text[], true, NOW(), NOW()
        )
        ON CONFLICT (tenant_id, name)
        DO NOTHING
      `,
      [
        randomUUID(),
        tenantId,
        role.name,
        `${role.name.replaceAll("_", " ")} role`,
        role.permissions,
      ]
    );
  }
}

async function assignRolesWithClient(
  client,
  tenantId,
  userId,
  roleNames
) {
  for (const roleName of roleNames) {
    const result = await client.query(
      `
        INSERT INTO public.user_roles (
          tenant_id,
          user_id,
          role_id
        )
        SELECT $1, $2, r.id
        FROM public.roles r
        WHERE r.tenant_id = $1
          AND LOWER(r.name) = LOWER($3)
        ON CONFLICT (tenant_id, user_id, role_id)
        DO NOTHING
        RETURNING role_id
      `,
      [tenantId, userId, roleName]
    );

    if (!result.rowCount) {
      const existing = await client.query(
        `
          SELECT id
          FROM public.roles
          WHERE tenant_id = $1
            AND LOWER(name) = LOWER($2)
          LIMIT 1
        `,
        [tenantId, roleName]
      );

      if (!existing.rowCount) {
        throw new Error(
          `Role '${roleName}' does not exist for this organization.`
        );
      }
    }
  }
}

// ------------------------------------------------------------
// Database health
// ------------------------------------------------------------

export async function isPostgresConnected() {
  try {
    const result = await pool.query("SELECT 1 AS healthy");
    return result.rows[0]?.healthy === 1;
  } catch {
    return false;
  }
}

export async function checkAuthRepository() {
  return isPostgresConnected();
}

// ------------------------------------------------------------
// User lookup
// ------------------------------------------------------------

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  const result = await pool.query(
    `
      SELECT *
      FROM public.etdox_auth_user_by_email($1)
    `,
    [normalizedEmail]
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];

  if (row.tenant_id) {
    const roleResult = await withTenantTransaction(
      row.tenant_id,
      async (client) =>
        client.query(
          `
            SELECT r.name
            FROM public.user_roles ur
            INNER JOIN public.roles r
              ON r.id = ur.role_id
             AND r.tenant_id = ur.tenant_id
            WHERE ur.user_id = $1
              AND ur.tenant_id = $2
            ORDER BY r.name
          `,
          [row.id, row.tenant_id]
        )
    );

    row.roles = roleResult.rows.map((item) => item.name);
    row.direct_role = row.roles[0] || row.direct_role;
  }

  return mapUserRow(row);
}

export async function findUserById(id, tenantId) {
  if (!id || !tenantId) return null;

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
        FROM public.users u
        LEFT JOIN public.tenants t
          ON t.id = u.tenant_id
        WHERE u.id = $1
          AND u.tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    if (!result.rowCount) return null;

    const user = result.rows[0];

    const roleResult = await client.query(
      `
        SELECT r.name
        FROM public.user_roles ur
        INNER JOIN public.roles r
          ON r.id = ur.role_id
         AND r.tenant_id = ur.tenant_id
        WHERE ur.user_id = $1
          AND ur.tenant_id = $2
        ORDER BY r.name
      `,
      [id, tenantId]
    );

    user.roles = roleResult.rows.map((item) => item.name);

    if (user.roles.length) {
      user.direct_role = user.roles[0];
    }

    return mapUserRow(user);
  });
}

// ------------------------------------------------------------
// Tenant management
// ------------------------------------------------------------

export async function createTenant({ name, slug }) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Organization name is required.");
  }

  const id = randomUUID();

  const baseSlug = (
    slug ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  )
    .slice(0, 40)
    .replace(/^-+|-+$/g, "") || "organization";

  const cleanSlug =
    `${baseSlug}-${randomUUID().slice(0, 8)}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [id]
    );

    const result = await client.query(
      `
        INSERT INTO public.tenants
          (id, name, slug, status, base_currency)
        VALUES
          ($1, $2, $3, 'ACTIVE', 'INR')
        RETURNING *
      `,
      [id, name.trim(), cleanSlug]
    );

    await client.query(
      `
        INSERT INTO public.organizations (id, name, slug)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `,
      [id, name.trim(), cleanSlug]
    );

    await ensureTenantRoles(client, id);

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
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function findDefaultTenant() {
  const result = await pool.query(
    `
      SELECT *
      FROM public.tenants
      WHERE status = 'ACTIVE'
      ORDER BY created_at ASC
      LIMIT 1
    `
  );

  return result.rows[0] ?? null;
}

// ------------------------------------------------------------
// User creation and updates
// ------------------------------------------------------------

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

  if (!normalizedEmail || !tenantId || !passwordHash) {
    throw new Error(
      "Valid email, tenant ID, and password hash are required."
    );
  }

  const id = randomUUID();
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `,
      [
        id,
        tenantId,
        normalizedEmail,
        passwordHash,
        firstName?.trim() || "",
        lastName?.trim() || "",
        status,
        requestedRole,
        status === "ACTIVE",
      ]
    );

    await ensureTenantRoles(client, tenantId);

    await assignRolesWithClient(
      client,
      tenantId,
      id,
      assignedRoles
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return findUserById(id, tenantId);
}

export async function updateUserStatus(
  userId,
  status,
  emailVerified = false
) {
  if (!userId || !status) {
    throw new Error("User ID and status are required.");
  }

  const result = await pool.query(
    `
      UPDATE public.users
      SET
        status = $1,
        is_active = $2,
        email_verified_at =
          CASE WHEN $3::boolean THEN NOW()
               ELSE email_verified_at END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id
    `,
    [
      status,
      status === "ACTIVE",
      Boolean(emailVerified),
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
    await ensureTenantRoles(client, tenantId);

    await assignRolesWithClient(
      client,
      tenantId,
      userId,
      [roleName]
    );

    return true;
  });
}

export async function updateUserPassword(
  userId,
  newPasswordHash
) {
  if (!userId || !newPasswordHash) {
    throw new Error("User ID and password hash are required.");
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

// ------------------------------------------------------------
// Email verification tokens
// ------------------------------------------------------------

export async function createEmailVerificationToken({
  userId,
  tokenHash,
  otp,
  expiresAt,
}) {
  const id = randomUUID();

  await pool.query(
    `
      INSERT INTO public.email_verifications
        (id, user_id, token_hash, otp, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [id, userId, tokenHash, otp || null, expiresAt]
  );

  return { id, userId, tokenHash, otp, expiresAt };
}

export async function findAndConsumeVerificationToken(tokenHash) {
  const result = await pool.query(
    `
      UPDATE public.email_verifications
      SET consumed_at = NOW()
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id, expires_at, consumed_at
    `,
    [tokenHash]
  );

  const row = result.rows[0];

  return row
    ? {
        userId: row.user_id,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
      }
    : null;
}

export async function findAndConsumeVerificationByOtp(email, otp) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) return null;

  const user = await findUserByEmail(normalizedEmail);

  if (!user) return null;

  const result = await pool.query(
    `
      UPDATE public.email_verifications
      SET consumed_at = NOW()
      WHERE id = (
        SELECT id
        FROM public.email_verifications
        WHERE user_id = $1
          AND otp = $2
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY expires_at DESC
        LIMIT 1
        FOR UPDATE
      )
      RETURNING user_id, expires_at, consumed_at
    `,
    [user.id, String(otp).trim()]
  );

  const row = result.rows[0];

  return row
    ? {
        userId: row.user_id,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
      }
    : null;
}

// ------------------------------------------------------------
// Password reset tokens
// ------------------------------------------------------------

export async function createPasswordResetToken({
  userId,
  tokenHash,
  otp,
  expiresAt,
}) {
  const id = randomUUID();

  await pool.query(
    `
      INSERT INTO public.password_resets
        (id, user_id, token_hash, otp, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [id, userId, tokenHash, otp || null, expiresAt]
  );

  return { id, userId, tokenHash, otp, expiresAt };
}

export async function findActivePasswordResetByOtp(email, otp) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) return null;

  const user = await findUserByEmail(normalizedEmail);

  if (!user) return null;

  const result = await pool.query(
    `
      SELECT id, user_id, token_hash, otp, expires_at
      FROM public.password_resets
      WHERE user_id = $1
        AND otp = $2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [user.id, String(otp).trim()]
  );

  const row = result.rows[0];

  return row
    ? {
        id: row.id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        otp: row.otp,
        expiresAt: row.expires_at,
      }
    : null;
}

export async function findAndConsumePasswordResetByOtp(email, otp) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) return null;

  const user = await findUserByEmail(normalizedEmail);

  if (!user) return null;

  const result = await pool.query(
    `
      UPDATE public.password_resets
      SET consumed_at = NOW()
      WHERE id = (
        SELECT id
        FROM public.password_resets
        WHERE user_id = $1
          AND otp = $2
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      )
      RETURNING id, user_id, expires_at, consumed_at
    `,
    [user.id, String(otp).trim()]
  );

  const row = result.rows[0];

  return row
    ? {
        id: row.id,
        userId: row.user_id,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
      }
    : null;
}

export async function findAndConsumePasswordResetToken(tokenHash) {
  const result = await pool.query(
    `
      UPDATE public.password_resets
      SET consumed_at = NOW()
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING id, user_id, expires_at, consumed_at
    `,
    [tokenHash]
  );

  const row = result.rows[0];

  return row
    ? {
        id: row.id,
        userId: row.user_id,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
      }
    : null;
}

// ------------------------------------------------------------
// User sessions
// ------------------------------------------------------------

export async function createSession({
  userId,
  tenantId,
  tokenHash,
  expiresAt,
  ipAddress,
  userAgent,
}) {
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
    console.warn(
      "[AuthRepository] Could not save session:",
      error.message
    );
  }

  return id;
}

export async function revokeUserSessions(userId) {
  if (!userId) return false;

  try {
    await pool.query(
      `
        UPDATE public.user_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [userId]
    );
  } catch (error) {
    console.warn(
      "[AuthRepository] Could not revoke sessions:",
      error.message
    );
  }

  return true;
}

// ------------------------------------------------------------
// Permissions
// ------------------------------------------------------------

export async function getUserPermissions(tenantId, roles = []) {
  if (!tenantId || !Array.isArray(roles) || !roles.length) {
    return [];
  }

  return withTenantTransaction(tenantId, async (client) => {
    const normalizedRoles = roles
      .map((role) =>
        String(
          typeof role === "string"
            ? role
            : role?.name ?? ""
        ).trim().toLowerCase()
      )
      .filter(Boolean);

    if (!normalizedRoles.length) return [];

    const result = await client.query(
      `
        SELECT DISTINCT unnest(r.permissions) AS permission
        FROM public.roles r
        WHERE r.tenant_id = $1
          AND LOWER(r.name) = ANY($2::text[])
      `,
      [tenantId, normalizedRoles]
    );

    return result.rows.map((row) => row.permission);
  });
}
