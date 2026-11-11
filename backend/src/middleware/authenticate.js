
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const unauthorized = (message = "Authentication required.") => {
  const error = new Error(message);
  error.status = 401;
  error.code = "UNAUTHORIZED";
  return error;
};

export function authenticate(req, _res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return next(unauthorized());
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return next(unauthorized("Bearer token is missing."));
    }

    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    });

    if (!payload || typeof payload !== "object") {
      return next(unauthorized("Invalid authentication token."));
    }

    const userId = payload.sub ?? payload.userId ?? payload.id;
    const tenantId = payload.tenantId ?? payload.tenant_id;
    const role = payload.role;

    if (typeof userId !== "string" || !userId) {
      return next(unauthorized("Token does not contain a valid user ID."));
    }

    if (typeof tenantId !== "string" || !tenantId) {
      return next(unauthorized("Token does not contain a tenant ID."));
    }

    if (typeof role !== "string" || !role) {
      return next(unauthorized("Token does not contain a user role."));
    }

    const roles = Array.isArray(payload.roles)
      ? [...new Set([
          role.toLowerCase(),
          ...payload.roles.map((item) => String(item).toLowerCase()),
        ])]
      : [role.toLowerCase()];

    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions
      : [];

    const user = {
      id: userId,
      userId,
      tenantId,
      role: role.toLowerCase(),
      roles,
      permissions,
    };

    // Preserve compatibility with existing controllers.
    req.user = user;

    // Required by getRequestContext().
    req.context = {
      ...user,
      tenant_id: tenantId,
      user_id: userId,
    };

    req.authTokenPayload = payload;

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        unauthorized("Your session has expired. Please log in again.")
      );
    }

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return next(
        unauthorized("Invalid or inactive authentication token.")
      );
    }

    return next(error);
  }
}

export default authenticate;
