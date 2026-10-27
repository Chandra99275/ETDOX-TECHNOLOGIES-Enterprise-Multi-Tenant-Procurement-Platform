
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const DEMO_USERS = Object.freeze({
  "demo-admin": {
    email: "admin@etdox.com",
    name: "ETDOX Admin",
    role: "admin",
  },
  "demo-employee": {
    email: "employee@etdox.com",
    name: "ETDOX Employee",
    role: "employee",
  },
  "demo-manager": {
    email: "manager@etdox.com",
    name: "ETDOX Manager",
    role: "manager",
  },
  "demo-finance": {
    email: "finance@etdox.com",
    name: "ETDOX Finance",
    role: "finance",
  },
});

function sendUnauthorized(res, message = "Authentication required.") {
  return res.status(401).json({
    success: false,
    message,
    error: "UNAUTHENTICATED",
  });
}

function isDemoAuthEnabled() {
  return env.demoAuthEnabled === true && !env.isProduction;
}

function normalizeRole(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return sendUnauthorized(res);
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return sendUnauthorized(res);
  }

  let claims;

  try {
    claims = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
  } catch {
    return sendUnauthorized(res, "Invalid or expired token.");
  }

  if (
    !claims ||
    typeof claims !== "object" ||
    typeof claims.sub !== "string"
  ) {
    return sendUnauthorized(res, "Invalid token payload.");
  }

  // Demo accounts are explicitly handled without database lookups.
  if (claims.demo === true) {
    if (!isDemoAuthEnabled()) {
      return sendUnauthorized(res, "Demo authentication is disabled.");
    }

    const demoUser = DEMO_USERS[claims.sub];

    if (!demoUser) {
      return sendUnauthorized(res, "Unknown demo account.");
    }

    const tenantId = env.demoTenantId;

    if (
      !tenantId ||
      claims.tenant_id !== tenantId ||
      normalizeRole(claims.role) !== demoUser.role ||
      !Array.isArray(claims.roles) ||
      !claims.roles.some(
        (role) => normalizeRole(role) === demoUser.role
      )
    ) {
      return sendUnauthorized(res, "Invalid demo account permissions.");
    }

    const user = {
      id: claims.sub,
      sub: claims.sub,
      email: demoUser.email,
      name: demoUser.name,
      tenantId,
      tenant_id: tenantId,
      role: demoUser.role,
      roleName: demoUser.role,
      roles: [demoUser.role],
      permissions: [],
      isDemo: true,
    };

    req.user = user;

    req.context = {
      userId: user.id,
      tenantId,
      email: user.email,
      roles: [demoUser.role],
      permissions: [],
      isDemo: true,
    };

    return next();
  }

  // Non-demo JWTs are not accepted by this demo-only middleware.
  // This prevents accidentally treating ordinary tokens as demo accounts.
  return sendUnauthorized(
    res,
    "This backend is currently configured for demo authentication only."
  );
}

export default authenticate;
