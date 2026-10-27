
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const ROLE_DASHBOARDS = Object.freeze({
  admin: "/admin/dashboard",
  employee: "/employee/dashboard",
  manager: "/manager/dashboard",
  finance: "/finance/dashboard",
});

// Development-only demo accounts.
// Do not use these credentials in production.
const DEMO_USERS = Object.freeze([
  {
    id: "demo-admin",
    email: "admin@etdox.com",
    password: "admin123",
    name: "ETDOX Admin",
    role: "admin",
    roles: ["admin"],
    isActive: true,
  },
  {
    id: "demo-employee",
    email: "employee@etdox.com",
    password: "employee123",
    name: "ETDOX Employee",
    role: "employee",
    roles: ["employee"],
    isActive: true,
  },
  {
    id: "demo-manager",
    email: "manager@etdox.com",
    password: "manager123",
    name: "ETDOX Manager",
    role: "manager",
    roles: ["manager"],
    isActive: true,
  },
  {
    id: "demo-finance",
    email: "finance@etdox.com",
    password: "finance123",
    name: "ETDOX Finance",
    role: "finance",
    roles: ["finance"],
    isActive: true,
  },
]);

function createAuthError(message, statusCode, code) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function isDemoAuthEnabled() {
  return env.demoAuthEnabled === true && !env.isProduction;
}

function getDemoTenantId() {
  const tenantId = env.demoTenantId;

  if (
    typeof tenantId !== "string" ||
    !tenantId.trim()
  ) {
    throw createAuthError(
      "Demo authentication is not configured. Set ETDOX_DEMO_TENANT_ID in the backend environment.",
      503,
      "DEMO_TENANT_NOT_CONFIGURED"
    );
  }

  return tenantId.trim();
}

function createAccessToken(user) {
  const tenantId = getDemoTenantId();

  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw createAuthError(
      "JWT configuration is invalid.",
      500,
      "JWT_CONFIGURATION_ERROR"
    );
  }

  const payload = {
    sub: user.id,
    tenant_id: tenantId,
    role: user.role,
    roles: user.roles,
    demo: true,
    iss: env.jwtIssuer,
    aud: env.jwtAudience,
  };

  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn || "8h",
  });
}

function createLoginResponse(user) {
  const accessToken = createAccessToken(user);
  const tenantId = getDemoTenantId();

  return {
    success: true,
    message: "Login successful.",
    accessToken,
    token: accessToken,
    tokenType: "Bearer",
    expiresIn: env.jwtExpiresIn || "8h",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId,
      role: user.role,
      roles: user.roles,
    },
    redirectTo: ROLE_DASHBOARDS[user.role],
  };
}

/**
 * Authenticate one of the four local demo accounts.
 * No PostgreSQL user lookup is performed.
 */
export async function login({ email, password } = {}) {
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    throw createAuthError(
      "Email and password are required.",
      400,
      "VALIDATION_ERROR"
    );
  }

  if (!isDemoAuthEnabled()) {
    throw createAuthError(
      "Demo login is disabled. Enable it only for local development.",
      403,
      "DEMO_AUTH_DISABLED"
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = DEMO_USERS.find(
    (candidate) => candidate.email === normalizedEmail
  );

  if (!user || user.password !== password) {
    throw createAuthError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (!user.isActive) {
    throw createAuthError(
      "This account is inactive.",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  return createLoginResponse(user);
}

/**
 * Demo identities do not exist in the PostgreSQL users table.
 * Return their public profile from the demo-user list instead.
 */
export async function getCurrentUser(userId, tenantId) {
  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    typeof tenantId !== "string" ||
    !tenantId.trim()
  ) {
    throw createAuthError(
      "Valid user and tenant IDs are required.",
      400,
      "INVALID_IDENTITY"
    );
  }

  if (!isDemoAuthEnabled()) {
    throw createAuthError(
      "Demo authentication is disabled.",
      403,
      "DEMO_AUTH_DISABLED"
    );
  }

  if (tenantId !== getDemoTenantId()) {
    throw createAuthError(
      "The requested tenant is invalid.",
      403,
      "INVALID_TENANT"
    );
  }

  const user = DEMO_USERS.find(
    (candidate) => candidate.id === userId
  );

  if (!user || !user.isActive) {
    throw createAuthError(
      "Demo user not found.",
      404,
      "USER_NOT_FOUND"
    );
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId,
    role: user.role,
    roles: user.roles,
  };
}
