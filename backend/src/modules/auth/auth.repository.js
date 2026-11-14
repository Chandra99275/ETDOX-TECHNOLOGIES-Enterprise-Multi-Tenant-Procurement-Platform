
import { randomUUID } from "node:crypto";

import {
  pool,
  withTenantTransaction,
} from "../../config/database.js";

// ------------------------------------------------------------
// Constants
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
      "*",
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

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  return email.trim().toLowerCase();
}

function requireTenantId(tenantId) {
  if (
    typeof tenantId !== "string" ||
    !UUID_REGEX.test(tenantId)
  ) {
    throw new Error("A valid tenant ID is required.");
  }
}

function requireUserId(userId) {
  if (
    typeof userId !== "string" ||
    !UUID_REGEX.test(userId)
  ) {
    throw new Error("A valid user ID is required.");
  }
}

function parseRoles(value) {
  if (Array.isArray(value)) {
    return value
      .map((role) =>
        typeof role === "string" ? role : role?.name
      )
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed.filter(Boolean)
        : [];
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

    isActive:
      row.is_active === true ||
      row.is_active === "true",

    emailVerifiedAt: row.email_verified_at ?? null,
    requestedRole: row.requested_role ?? null,

    role: primaryRole,
    roleName: primaryRole,
    roles: roles.length ? roles : [primaryRole],

    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapTokenRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    tokenHash: row.token_hash ?? null,
    otp: row.otp ?? null,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at ?? null,
  };
}

// ------------------------------------------------------------
// Tenant roles
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
  roleNames = []
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
// User lookup by email
// ------------------------------------------------------------

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  const lookup = await pool.query(
    `
      SELECT *
      FROM public.etdox_auth_user_by_email($1)
    `,
    [normalizedEmail]
  );

  if (!lookup.rowCount) return null;

  if (lookup.rowCount > 1) {
    throw new Error(
      "This email belongs to multiple organizations. Organization selection is required."
    );
  }

  const candidate = lookup.rows[0];

  if (!candidate.tenant_id) {
    throw new Error(
      "User account has no tenant association."
    );
  }

  requireTenantId(candidate.tenant_id);

  return withTenantTransaction(
    candidate.tenant_id,
    async (client) => {
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
        [candidate.id, candidate.tenant_id]
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
        [user.id, candidate.tenant_id]
      );

      user.roles = roleResult.rows.map((item) => item.name);
      user.direct_role = user.roles[0] ?? null;

      return mapUserRow(user);
    }
  );
}

// ------------------------------------------------------------
// User lookup by ID
// ------------------------------------------------------------

export async function findUserById(userId, tenantId) {
  if (!userId || !tenantId) return null;

  requireTenantId(tenantId);
  requireUserId(userId);

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
      [userId, tenantId]
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
      [userId, tenantId]
    );

    user.roles = roleResult.rows.map((item) => item.name);
    user.direct_role = user.roles[0] ?? null;

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

  const tenantId = randomUUID();

  const baseSlug = (
    slug ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  )
    .slice(0, 40)
    .replace(/^-+|-+$/g, "") || "organization";

  const cleanSlug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const result = await client.query(
      `
        INSERT INTO public.tenants (
          id,
          name,
          slug,
          status,
          base_currency
        )
        VALUES ($1, $2, $3, 'ACTIVE', 'INR')
        RETURNING *
      `,
      [tenantId, name.trim(), cleanSlug]
    );

    await client.query(
      `
        INSERT INTO public.organizations (
          id,
          name,
          slug
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `,
      [tenantId, name.trim(), cleanSlug]
    );

    await ensureTenantRoles(client, tenantId);

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findTenantById(tenantId) {
  if (!tenantId) return null;

  requireTenantId(tenantId);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT *
        FROM public.tenants
        WHERE id = $1
        LIMIT 1
      `,
      [tenantId]
    );

    return result.rows[0] ?? null;
  });
}

export async function findDefaultTenant() {
  return null;
}

// ------------------------------------------------------------
// User creation
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

  requireTenantId(tenantId);

  const userId = randomUUID();

  await withTenantTransaction(tenantId, async (client) => {
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
      userId,
      assignedRoles
    );
  });

  return findUserById(userId, tenantId);
}

// ------------------------------------------------------------
// User status
// ------------------------------------------------------------

export async function updateUserStatus(
  userId,
  tenantId,
  status,
  emailVerified = false
) {
  if (!userId || !tenantId || !status) {
    throw new Error(
      "User ID, tenant ID, and status are required."
    );
  }

  requireTenantId(tenantId);
  requireUserId(userId);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
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
          AND tenant_id = $5
        RETURNING id
      `,
      [
        status,
        status === "ACTIVE",
        Boolean(emailVerified),
        userId,
        tenantId,
      ]
    );

    return result.rowCount > 0;
  });
}

// ------------------------------------------------------------
// Role assignment
// ------------------------------------------------------------

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

  requireTenantId(tenantId);
  requireUserId(userId);

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

// ------------------------------------------------------------
// Password update
// ------------------------------------------------------------

export async function updateUserPassword(
  userId,
  tenantId,
  newPasswordHash
) {
  if (!userId || !tenantId || !newPasswordHash) {
    throw new Error(
      "User ID, tenant ID, and password hash are required."
    );
  }

  requireTenantId(tenantId);
  requireUserId(userId);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        UPDATE public.users
        SET
          password_hash = $1,
          updated_at = NOW()
        WHERE id = $2
          AND tenant_id = $3
        RETURNING id
      `,
      [newPasswordHash, userId, tenantId]
    );

    return result.rowCount > 0;
  });
}

export async function updatePassword(
  userId,
  tenantId,
  newPasswordHash
) {
  return updateUserPassword(
    userId,
    tenantId,
    newPasswordHash
  );
}

// ------------------------------------------------------------
// Token owner lookup
// ------------------------------------------------------------

async function getVerificationTokenOwner(tokenHash) {
  if (!tokenHash) return null;

  const result = await pool.query(
    `
      SELECT *
      FROM public.etdox_email_token_owner($1)
    `,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

async function getPasswordTokenOwner(tokenHash) {
  if (!tokenHash) return null;

  const result = await pool.query(
    `
      SELECT *
      FROM public.etdox_password_token_owner($1)
    `,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

// ------------------------------------------------------------
// Email verification token creation
// ------------------------------------------------------------

export async function createEmailVerificationToken({
  userId,
  tenantId,
  tokenHash,
  otp,
  expiresAt,
}) {
  if (!userId || !tenantId || !tokenHash || !expiresAt) {
    throw new Error(
      "User ID, tenant ID, token hash, and expiry are required."
    );
  }

  requireTenantId(tenantId);
  requireUserId(userId);

  const id = randomUUID();

  await withTenantTransaction(tenantId, async (client) => {
    const userResult = await client.query(
      `
        SELECT id
        FROM public.users
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!userResult.rowCount) {
      throw new Error(
        "Cannot create verification token for a user outside this tenant."
      );
    }

    await client.query(
      `
        INSERT INTO public.email_verifications (
          id,
          user_id,
          tenant_id,
          token_hash,
          otp,
          expires_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      [
        id,
        userId,
        tenantId,
        tokenHash,
        otp || null,
        expiresAt,
      ]
    );
  });

  return {
    id,
    userId,
    tenantId,
    tokenHash,
    otp,
    expiresAt,
  };
}

// ------------------------------------------------------------
// Consume verification token
// ------------------------------------------------------------

export async function findAndConsumeVerificationToken(tokenHash) {
  const owner = await getVerificationTokenOwner(tokenHash);

  if (!owner) return null;

  requireTenantId(owner.tenant_id);

  return withTenantTransaction(
    owner.tenant_id,
    async (client) => {
      const result = await client.query(
        `
          UPDATE public.email_verifications
          SET consumed_at = NOW()
          WHERE tenant_id = $1
            AND user_id = $2
            AND token_hash = $3
            AND consumed_at IS NULL
            AND expires_at > NOW()
          RETURNING
            id,
            user_id,
            tenant_id,
            token_hash,
            otp,
            expires_at,
            consumed_at
        `,
        [
          owner.tenant_id,
          owner.user_id,
          tokenHash,
        ]
      );

      return mapTokenRow(result.rows[0]);
    }
  );
}

// ------------------------------------------------------------
// Consume verification OTP
// ------------------------------------------------------------

export async function findAndConsumeVerificationByOtp(
  email,
  otp
) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) return null;

  const user = await findUserByEmail(normalizedEmail);

  if (!user) return null;

  const tenantId = user.tenantId;

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        UPDATE public.email_verifications
        SET consumed_at = NOW()
        WHERE id = (
          SELECT id
          FROM public.email_verifications
          WHERE user_id = $1
            AND tenant_id = $2
            AND otp = $3
            AND consumed_at IS NULL
            AND expires_at > NOW()
          ORDER BY expires_at DESC
          LIMIT 1
          FOR UPDATE
        )
          AND user_id = $1
          AND tenant_id = $2
          AND consumed_at IS NULL
          AND expires_at > NOW()
        RETURNING
          id,
          user_id,
          tenant_id,
          token_hash,
          otp,
          expires_at,
          consumed_at
      `,
      [user.id, tenantId, String(otp).trim()]
    );

    return mapTokenRow(result.rows[0]);
  });
}

// ------------------------------------------------------------
// Password reset token creation
// ------------------------------------------------------------

export async function createPasswordResetToken({
  userId,
  tenantId,
  tokenHash,
  otp,
  expiresAt,
}) {
  if (!userId || !tenantId || !tokenHash || !expiresAt) {
    throw new Error(
      "User ID, tenant ID, token hash, and expiry are required."
    );
  }

  requireTenantId(tenantId);
  requireUserId(userId);

  const id = randomUUID();

  await withTenantTransaction(tenantId, async (client) => {
    const userResult = await client.query(
      `
        SELECT id
        FROM public.users
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!userResult.rowCount) {
      throw new Error(
        "Cannot create password-reset token for a user outside this tenant."
      );
    }

    await client.query(
      `
        INSERT INTO public.password_resets (
          id,
          user_id,
          tenant_id,
          token_hash,
          otp,
          expires_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      [
        id,
        userId,
        tenantId,
        tokenHash,
        otp || null,
        expiresAt,
      ]
    );
  });

  return {
    id,
    userId,
    tenantId,
    tokenHash,
    otp,
    expiresAt,
  };
}

// ------------------------------------------------------------
// Find active password-reset OTP
// ------------------------------------------------------------

export async function findActivePasswordResetByOtp(email, otp) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) return null;

  const user = await findUserByEmail(normalizedEmail);

  if (!user) return null;

  return withTenantTransaction(user.tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT
          id,
          user_id,
          tenant_id,
          token_hash,
          otp,
          expires_at,
          consumed_at
        FROM public.password_resets
        WHERE user_id = $1
          AND tenant_id = $2
          AND otp = $3
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [user.id, user.tenantId, String(otp).trim()]
    );

    return mapTokenRow(result.rows[0]);
  });
}

// ------------------------------------------------------------
// Consume password-reset OTP
// ------------------------------------------------------------

export async function findAndConsumePasswordResetByOtp(
  email,
  otp
) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) return null;

  const user = await findUserByEmail(normalizedEmail);

  if (!user) return null;

  return withTenantTransaction(
    user.tenantId,
    async (client) => {
      const result = await client.query(
        `
          UPDATE public.password_resets
          SET consumed_at = NOW()
          WHERE id = (
            SELECT id
            FROM public.password_resets
            WHERE user_id = $1
              AND tenant_id = $2
              AND otp = $3
              AND consumed_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
          )
            AND user_id = $1
            AND tenant_id = $2
            AND consumed_at IS NULL
            AND expires_at > NOW()
          RETURNING
            id,
            user_id,
            tenant_id,
            token_hash,
            otp,
            expires_at,
            consumed_at
        `,
        [
          user.id,
          user.tenantId,
          String(otp).trim(),
        ]
      );

      return mapTokenRow(result.rows[0]);
    }
  );
}

// ------------------------------------------------------------
// Consume password-reset token
// ------------------------------------------------------------

export async function findAndConsumePasswordResetToken(tokenHash) {
  const owner = await getPasswordTokenOwner(tokenHash);

  if (!owner) return null;

  requireTenantId(owner.tenant_id);

  return withTenantTransaction(
    owner.tenant_id,
    async (client) => {
      const result = await client.query(
        `
          UPDATE public.password_resets
          SET consumed_at = NOW()
          WHERE tenant_id = $1
            AND user_id = $2
            AND token_hash = $3
            AND consumed_at IS NULL
            AND expires_at > NOW()
          RETURNING
            id,
            user_id,
            tenant_id,
            token_hash,
            otp,
            expires_at,
            consumed_at
        `,
        [
          owner.tenant_id,
          owner.user_id,
          tokenHash,
        ]
      );

      return mapTokenRow(result.rows[0]);
    }
  );
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
  if (!userId || !tenantId || !tokenHash || !expiresAt) {
    throw new Error(
      "User ID, tenant ID, token hash, and expiry are required."
    );
  }

  requireTenantId(tenantId);
  requireUserId(userId);

  const sessionId = randomUUID();

  await withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
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
        SELECT
          $1,
          u.id,
          u.tenant_id,
          $4,
          $4,
          $5,
          $6,
          $7,
          NOW()
        FROM public.users u
        WHERE u.id = $2
          AND u.tenant_id = $3
        RETURNING id
      `,
      [
        sessionId,
        userId,
        tenantId,
        tokenHash,
        expiresAt,
        ipAddress || null,
        userAgent || null,
      ]
    );

    if (!result.rowCount) {
      throw new Error(
        "Cannot create a session for a user outside this tenant."
      );
    }
  });

  return sessionId;
}

// ------------------------------------------------------------
// Revoke user sessions
// ------------------------------------------------------------

export async function revokeUserSessions(userId, tenantId) {
  if (!userId || !tenantId) return false;

  requireTenantId(tenantId);
  requireUserId(userId);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        UPDATE public.user_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND tenant_id = $2
          AND revoked_at IS NULL
      `,
      [userId, tenantId]
    );

    return result.rowCount > 0;
  });
}

// ------------------------------------------------------------
// User permissions
// Fetch permissions from actual database role assignments.
// ------------------------------------------------------------

export async function getUserPermissions(tenantId, userId) {
  if (!tenantId || !userId) {
    return [];
  }

  requireTenantId(tenantId);
  requireUserId(userId);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT DISTINCT
          p.permission
        FROM public.user_roles ur
        INNER JOIN public.roles r
          ON r.id = ur.role_id
         AND r.tenant_id = ur.tenant_id
        CROSS JOIN LATERAL
          unnest(
            COALESCE(r.permissions, ARRAY[]::text[])
          ) AS p(permission)
        WHERE ur.tenant_id = $1
          AND ur.user_id = $2
        ORDER BY p.permission
      `,
      [tenantId, userId]
    );

    return result.rows
      .map((row) => row.permission)
      .filter(
        (permission) =>
          typeof permission === "string" &&
          permission.trim().length > 0
      );
  });
}
