import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORE_PATH = path.resolve(__dirname, "../../../database/local-auth-store.json");

let postgresAvailable = null;

/**
 * Quick check if PostgreSQL is currently accessible.
 */
export async function isPostgresConnected() {
  if (postgresAvailable === false && process.env.NODE_ENV === "test") {
    return false;
  }
  try {
    const client = await pool.connect();
    client.release();
    postgresAvailable = true;
    return true;
  } catch {
    postgresAvailable = false;
    return false;
  }
}

// ----------------------------------------------------------------------
// LOCAL PERSISTENT FALLBACK STORE (Used when PostgreSQL is offline)
// ----------------------------------------------------------------------

function initLocalStore() {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const data = fs.readFileSync(LOCAL_STORE_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch {
    // initialize fresh store below
  }

  const defaultTenantId = env.demoTenantId || "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";

  const store = {
    tenants: [
      {
        id: defaultTenantId,
        name: "ETDOX Global Technologies",
        slug: "etdox-global",
        status: "ACTIVE",
        base_currency: "USD",
        created_at: new Date().toISOString(),
      },
    ],
    roles: [
      { id: "role-req", name: "requester", description: "Creates procurement requests" },
      { id: "role-dep-mgr", name: "department_manager", description: "Approves department requests" },
      { id: "role-proc-sp", name: "procurement_specialist", description: "Manages POs and vendors" },
      { id: "role-proc-mgr", name: "procurement_manager", description: "Procurement manager" },
      { id: "role-fin-mgr", name: "finance_manager", description: "Reviews invoices and payments" },
      { id: "role-org-adm", name: "organization_admin", description: "Tenant organization administrator" },
      { id: "role-audit", name: "auditor", description: "Read-only auditor" },
      { id: "role-supp", name: "supplier_user", description: "Supplier portal user" },
      // Aliases
      { id: "role-admin", name: "admin", description: "Organization administrator" },
      { id: "role-emp", name: "employee", description: "Employee requester" },
      { id: "role-mgr", name: "manager", description: "Manager" },
      { id: "role-fin", name: "finance", description: "Finance user" },
    ],
    users: [
      {
        id: "demo-admin",
        tenant_id: defaultTenantId,
        email: "admin@etdox.com",
        password_hash: bcrypt.hashSync("admin123", 10),
        first_name: "ETDOX",
        last_name: "Admin",
        status: "ACTIVE",
        is_active: true,
        email_verified_at: new Date().toISOString(),
        roles: ["organization_admin", "admin"],
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-employee",
        tenant_id: defaultTenantId,
        email: "employee@etdox.com",
        password_hash: bcrypt.hashSync("employee123", 10),
        first_name: "ETDOX",
        last_name: "Employee",
        status: "ACTIVE",
        is_active: true,
        email_verified_at: new Date().toISOString(),
        roles: ["requester", "employee"],
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-manager",
        tenant_id: defaultTenantId,
        email: "manager@etdox.com",
        password_hash: bcrypt.hashSync("manager123", 10),
        first_name: "ETDOX",
        last_name: "Manager",
        status: "ACTIVE",
        is_active: true,
        email_verified_at: new Date().toISOString(),
        roles: ["department_manager", "manager"],
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-finance",
        tenant_id: defaultTenantId,
        email: "finance@etdox.com",
        password_hash: bcrypt.hashSync("finance123", 10),
        first_name: "ETDOX",
        last_name: "Finance",
        status: "ACTIVE",
        is_active: true,
        email_verified_at: new Date().toISOString(),
        roles: ["finance_manager", "finance"],
        created_at: new Date().toISOString(),
      },
    ],
    email_verifications: [],
    password_resets: [],
    invitations: [],
    sessions: [],
  };

  saveLocalStore(store);
  return store;
}

let localStore = null;

function getLocalStore() {
  if (!localStore) {
    localStore = initLocalStore();
  }
  return localStore;
}

function saveLocalStore(store) {
  try {
    const dir = path.dirname(LOCAL_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("[AuthRepository] Could not write to local store:", err.message);
  }
}

// ----------------------------------------------------------------------
// REPOSITORY METHODS (Unified Interface)
// ----------------------------------------------------------------------

export async function findUserByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      const res = await pool.query(
        `SELECT u.*, t.name as organization_name,
                COALESCE(
                  json_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),
                  '[]'::json
                ) as roles
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE LOWER(u.email) = LOWER($1)
         GROUP BY u.id, t.name
         LIMIT 1`,
        [normalized]
      );
      if (res.rows[0]) {
        const row = res.rows[0];
        let roles = row.roles;
        if (typeof roles === "string") {
          try { roles = JSON.parse(roles); } catch { roles = []; }
        }
        return {
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email,
          passwordHash: row.password_hash,
          tenantId: row.tenant_id,
          organizationName: row.organization_name,
          status: row.status || (row.is_active ? "ACTIVE" : "DISABLED"),
          isActive: row.is_active !== false && row.status !== "DISABLED" && row.status !== "SUSPENDED",
          emailVerifiedAt: row.email_verified_at,
          requestedRole: row.requested_role,
          roles: Array.isArray(roles) ? roles : [],
        };
      }
    } catch (err) {
      console.warn("[AuthRepository] Postgres query failed, falling back to local store:", err.message);
    }
  }

  // Fallback to local store
  const store = getLocalStore();
  const user = store.users.find((u) => u.email.toLowerCase() === normalized);
  if (!user) return null;

  const tenant = store.tenants.find((t) => t.id === user.tenant_id);

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email,
    passwordHash: user.password_hash,
    tenantId: user.tenant_id,
    organizationName: tenant?.name || "ETDOX Enterprise",
    status: user.status || (user.is_active ? "ACTIVE" : "DISABLED"),
    isActive: user.is_active !== false && user.status !== "DISABLED" && user.status !== "SUSPENDED",
    emailVerifiedAt: user.email_verified_at,
    requestedRole: user.requested_role,
    roles: user.roles || [],
  };
}

export async function findUserById(id) {
  if (!id) return null;

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      const res = await pool.query(
        `SELECT u.*, t.name as organization_name,
                COALESCE(
                  json_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),
                  '[]'::json
                ) as roles
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id, t.name
         LIMIT 1`,
        [id]
      );
      if (res.rows[0]) {
        const row = res.rows[0];
        let roles = row.roles;
        if (typeof roles === "string") {
          try { roles = JSON.parse(roles); } catch { roles = []; }
        }
        return {
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email,
          passwordHash: row.password_hash,
          tenantId: row.tenant_id,
          organizationName: row.organization_name,
          status: row.status || (row.is_active ? "ACTIVE" : "DISABLED"),
          isActive: row.is_active !== false && row.status !== "DISABLED" && row.status !== "SUSPENDED",
          emailVerifiedAt: row.email_verified_at,
          requestedRole: row.requested_role,
          roles: Array.isArray(roles) ? roles : [],
        };
      }
    } catch (err) {
      console.warn("[AuthRepository] Postgres query failed:", err.message);
    }
  }

  const store = getLocalStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;

  const tenant = store.tenants.find((t) => t.id === user.tenant_id);

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email,
    passwordHash: user.password_hash,
    tenantId: user.tenant_id,
    organizationName: tenant?.name || "ETDOX Enterprise",
    status: user.status || (user.is_active ? "ACTIVE" : "DISABLED"),
    isActive: user.is_active !== false && user.status !== "DISABLED" && user.status !== "SUSPENDED",
    emailVerifiedAt: user.email_verified_at,
    requestedRole: user.requested_role,
    roles: user.roles || [],
  };
}

export async function createTenant({ name, slug }) {
  const id = randomUUID();
  const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 50);

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      const res = await pool.query(
        `INSERT INTO tenants (id, name, slug, status, base_currency)
         VALUES ($1, $2, $3, 'ACTIVE', 'USD')
         RETURNING *`,
        [id, name, cleanSlug]
      );
      return res.rows[0];
    } catch (err) {
      console.warn("[AuthRepository] Postgres createTenant failed:", err.message);
    }
  }

  const store = getLocalStore();
  const newTenant = {
    id,
    name,
    slug: cleanSlug,
    status: "ACTIVE",
    base_currency: "USD",
    created_at: new Date().toISOString(),
  };
  store.tenants.push(newTenant);
  saveLocalStore(store);
  return newTenant;
}

export async function findTenantById(id) {
  if (!id) return null;
  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      const res = await pool.query(`SELECT * FROM tenants WHERE id = $1`, [id]);
      if (res.rows[0]) return res.rows[0];
    } catch (err) {
      console.warn("[AuthRepository] Postgres findTenantById failed:", err.message);
    }
  }
  const store = getLocalStore();
  return store.tenants.find((t) => t.id === id) || null;
}

export async function findDefaultTenant() {
  const store = getLocalStore();
  return store.tenants[0] || null;
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
  const now = new Date().toISOString();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      await pool.query(
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

      // Assign initial roles if any
      for (const roleName of assignedRoles) {
        await pool.query(
          `INSERT INTO user_roles (tenant_id, user_id, role_id)
           SELECT $1, $2, id FROM roles WHERE name = $3
           ON CONFLICT DO NOTHING`,
          [tenantId, id, roleName]
        );
      }
    } catch (err) {
      console.warn("[AuthRepository] Postgres createUser failed:", err.message);
    }
  }

  // Always update local store as well
  const store = getLocalStore();
  const newUser = {
    id,
    tenant_id: tenantId,
    email: normalizedEmail,
    password_hash: passwordHash,
    first_name: firstName,
    last_name: lastName,
    status,
    requested_role: requestedRole,
    roles: assignedRoles,
    is_active: status === "ACTIVE",
    email_verified_at: status === "ACTIVE" ? now : null,
    created_at: now,
  };
  store.users.push(newUser);
  saveLocalStore(store);

  return findUserById(id);
}

export async function updateUserStatus(userId, status, emailVerified = false) {
  const now = new Date().toISOString();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      await pool.query(
        `UPDATE users
         SET status = $1,
             is_active = $2,
             email_verified_at = CASE WHEN $3 = true THEN NOW() ELSE email_verified_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [status, status === "ACTIVE", emailVerified, userId]
      );
    } catch (err) {
      console.warn("[AuthRepository] Postgres updateUserStatus failed:", err.message);
    }
  }

  const store = getLocalStore();
  const user = store.users.find((u) => u.id === userId);
  if (user) {
    user.status = status;
    user.is_active = status === "ACTIVE";
    if (emailVerified) {
      user.email_verified_at = now;
    }
    saveLocalStore(store);
  }
  return true;
}

export async function assignUserRole(userId, tenantId, roleName) {
  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      await pool.query(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         SELECT $1, $2, id FROM roles WHERE name = $3
         ON CONFLICT DO NOTHING`,
        [tenantId, userId, roleName]
      );
    } catch (err) {
      console.warn("[AuthRepository] Postgres assignUserRole failed:", err.message);
    }
  }

  const store = getLocalStore();
  const user = store.users.find((u) => u.id === userId);
  if (user) {
    if (!user.roles) user.roles = [];
    if (!user.roles.includes(roleName)) {
      user.roles.push(roleName);
      saveLocalStore(store);
    }
  }
}

export async function updateUserPassword(userId, newPasswordHash) {
  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      await pool.query(
        `UPDATE users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [newPasswordHash, userId]
      );
    } catch (err) {
      console.warn("[AuthRepository] Postgres updateUserPassword failed:", err.message);
    }
  }

  const store = getLocalStore();
  const user = store.users.find((u) => u.id === userId);
  if (user) {
    user.password_hash = newPasswordHash;
    saveLocalStore(store);
  }
  return true;
}

// ----------------------------------------------------------------------
// EMAIL VERIFICATION TOKENS
// ----------------------------------------------------------------------

export async function createEmailVerificationToken({ userId, tokenHash, otp, expiresAt }) {
  const id = randomUUID();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      await pool.query(
        `INSERT INTO email_verifications (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [id, userId, tokenHash, expiresAt]
      );
    } catch (err) {
      console.warn("[AuthRepository] Postgres createEmailVerificationToken failed:", err.message);
    }
  }

  const store = getLocalStore();
  store.email_verifications.push({
    id,
    user_id: userId,
    token_hash: tokenHash,
    otp: otp || null,
    expires_at: expiresAt.toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
  });
  saveLocalStore(store);
  return { id, userId, tokenHash, otp, expiresAt };
}

export async function findAndConsumeVerificationToken(tokenHash) {
  const now = new Date();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
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
    } catch (err) {
      console.warn("[AuthRepository] Postgres findAndConsumeVerificationToken failed:", err.message);
    }
  }

  const store = getLocalStore();
  const record = store.email_verifications.find(
    (ev) => (ev.token_hash === tokenHash || ev.otp === tokenHash) && !ev.consumed_at && new Date(ev.expires_at) > now
  );
  if (!record) return null;

  record.consumed_at = now.toISOString();
  saveLocalStore(store);
  return {
    userId: record.user_id,
    expiresAt: new Date(record.expires_at),
    consumedAt: now,
  };
}

export async function findAndConsumeVerificationByOtp(email, otp) {
  if (!email || !otp) return null;
  const user = await findUserByEmail(email);
  if (!user) return null;

  const now = new Date();
  const store = getLocalStore();
  const cleanOtp = String(otp).trim();

  const record = store.email_verifications.find(
    (ev) =>
      ev.user_id === user.id &&
      String(ev.otp).trim() === cleanOtp &&
      !ev.consumed_at &&
      new Date(ev.expires_at) > now
  );

  if (!record) return null;

  record.consumed_at = now.toISOString();
  saveLocalStore(store);
  return {
    userId: record.user_id,
    expiresAt: new Date(record.expires_at),
    consumedAt: now,
  };
}

// ----------------------------------------------------------------------
// PASSWORD RESET TOKENS
// ----------------------------------------------------------------------

export async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const id = randomUUID();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
      await pool.query(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [id, userId, tokenHash, expiresAt]
      );
    } catch (err) {
      console.warn("[AuthRepository] Postgres createPasswordResetToken failed:", err.message);
    }
  }

  const store = getLocalStore();
  store.password_resets.push({
    id,
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
  });
  saveLocalStore(store);
  return { id, userId, tokenHash, expiresAt };
}

export async function findAndConsumePasswordResetToken(tokenHash) {
  const now = new Date();

  const usePg = await isPostgresConnected();
  if (usePg) {
    try {
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
          userId: res.rows[0].user_id,
          expiresAt: res.rows[0].expires_at,
          consumedAt: res.rows[0].consumed_at,
        };
      }
    } catch (err) {
      console.warn("[AuthRepository] Postgres findAndConsumePasswordResetToken failed:", err.message);
    }
  }

  const store = getLocalStore();
  const record = store.password_resets.find(
    (pr) => pr.token_hash === tokenHash && !pr.consumed_at && new Date(pr.expires_at) > now
  );
  if (!record) return null;

  record.consumed_at = now.toISOString();
  saveLocalStore(store);
  return {
    userId: record.user_id,
    expiresAt: new Date(record.expires_at),
    consumedAt: now,
  };
}

// ----------------------------------------------------------------------
// SESSIONS & REVOCATION
// ----------------------------------------------------------------------

export async function createSession({ userId, tenantId, tokenHash, expiresAt, ipAddress, userAgent }) {
  const id = randomUUID();
  const store = getLocalStore();
  store.sessions.push({
    id,
    user_id: userId,
    tenant_id: tenantId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    revoked_at: null,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    created_at: new Date().toISOString(),
  });
  saveLocalStore(store);
  return id;
}

export async function revokeUserSessions(userId) {
  const now = new Date().toISOString();
  const store = getLocalStore();
  for (const session of store.sessions) {
    if (session.user_id === userId && !session.revoked_at) {
      session.revoked_at = now;
    }
  }
  saveLocalStore(store);
  return true;
}
