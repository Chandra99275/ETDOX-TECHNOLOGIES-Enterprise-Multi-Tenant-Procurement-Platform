
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// ============================================================
// CONFIGURATION
// ============================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unauthorized = (message = "Authentication required.") => {
  const error = new Error(message);
  error.status = 401;
  error.code = "UNAUTHORIZED";
  return error;
};

const normalizeRole = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizePermission = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

export function authenticate(req, _res, next) {
  try {
    const authorization = req.headers.authorization;

    // --------------------------------------------------------
    // 1. Validate Authorization header
    // --------------------------------------------------------

    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      return next(unauthorized());
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return next(unauthorized("Bearer token is missing."));
    }

    // --------------------------------------------------------
    // 2. Verify JWT
    // --------------------------------------------------------

    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    });

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return next(
        unauthorized("Invalid authentication token.")
      );
    }

    // --------------------------------------------------------
    // 3. Extract and validate user identity
    // --------------------------------------------------------

    const userId =
      payload.sub ??
      payload.userId ??
      payload.user_id ??
      payload.id;

    const tenantId =
      payload.tenantId ??
      payload.tenant_id;

    if (
      typeof userId !== "string" ||
      !UUID_REGEX.test(userId)
    ) {
      return next(
        unauthorized("Token does not contain a valid user ID.")
      );
    }

    if (
      typeof tenantId !== "string" ||
      !UUID_REGEX.test(tenantId)
    ) {
      return next(
        unauthorized("Token does not contain a valid tenant ID.")
      );
    }

    // --------------------------------------------------------
    // 4. Extract and normalize roles
    // --------------------------------------------------------

    const primaryRole = normalizeRole(payload.role);

    const tokenRoles = Array.isArray(payload.roles)
      ? payload.roles
      : [];

    const roles = [
      ...new Set(
        [primaryRole, ...tokenRoles]
          .map(normalizeRole)
          .filter(Boolean)
      ),
    ];

    if (roles.length === 0) {
      return next(
        unauthorized("Token does not contain a valid user role.")
      );
    }

    // Keep a primary role for existing controllers.
    const role = primaryRole || roles[0];

    // --------------------------------------------------------
    // 5. Extract and normalize permissions
    // --------------------------------------------------------

    const tokenPermissions = Array.isArray(payload.permissions)
      ? payload.permissions
      : [];

    const permissions = [
      ...new Set(
        tokenPermissions
          .map(normalizePermission)
          .filter(Boolean)
      ),
    ];

    // --------------------------------------------------------
    // 6. Build authenticated user
    // --------------------------------------------------------

    const user = {
      id: userId,
      userId,
      tenantId,
      role,
      roles,
      permissions,
    };

    req.user = user;

    // Preserve compatibility with existing controllers
    // and tenant-context middleware.
    req.context = {
      ...user,
      tenant_id: tenantId,
      user_id: userId,
    };

    // Preserve verified JWT claims for other middleware.
    req.authTokenPayload = payload;

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        unauthorized(
          "Your session has expired. Please log in again."
        )
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
