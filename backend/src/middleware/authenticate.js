import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

function sendUnauthorized(res, message = "Authentication required.") {
  return res.status(401).json({
    success: false,
    message,
    error: {
      code: "UNAUTHENTICATED",
      message,
    },
  });
}

export function authenticate(req, res, next) {
  let token = null;

  // 1. Check HTTP-only cookie first
  if (req.cookies && typeof req.cookies.etdox_token === "string" && req.cookies.etdox_token.trim()) {
    token = req.cookies.etdox_token.trim();
  }

  // 2. Check Authorization Bearer header
  if (!token) {
    const authorization = req.headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      token = authorization.slice(7).trim();
    }
  }

  if (!token) {
    return sendUnauthorized(res, "Authentication required. No session or token provided.");
  }

  let claims;
  try {
    claims = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
  } catch (error) {
    return sendUnauthorized(res, "Invalid or expired session token.");
  }

  if (!claims || typeof claims !== "object" || !claims.sub) {
    return sendUnauthorized(res, "Invalid token payload.");
  }

  const userId = claims.sub;
  const tenantId = claims.tenant_id || claims.tenantId || env.demoTenantId;
  const role = claims.role || (Array.isArray(claims.roles) ? claims.roles[0] : "requester");
  const roles = Array.isArray(claims.roles) ? claims.roles : [role];

  const user = {
    id: userId,
    sub: userId,
    email: claims.email || "",
    name: claims.name || "",
    tenantId,
    tenant_id: tenantId,
    role,
    roleName: role,
    roles,
    permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
  };

  req.user = user;
  req.context = {
    userId: user.id,
    tenantId,
    email: user.email,
    roles,
    permissions: user.permissions,
  };

  return next();
}

export default authenticate;
