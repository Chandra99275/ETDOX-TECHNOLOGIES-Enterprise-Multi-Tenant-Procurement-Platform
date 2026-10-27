
const VALID_ROLES = new Set([
  "admin",
  "employee",
  "manager",
  "finance",
]);

function normalizeRole(role) {
  return typeof role === "string"
    ? role.trim().toLowerCase()
    : "";
}

function getUserRoles(req) {
  const roles = new Set();

  const user = req.user;

  if (user?.role) {
    roles.add(normalizeRole(user.role));
  }

  if (user?.roleName) {
    roles.add(normalizeRole(user.roleName));
  }

  if (Array.isArray(user?.roles)) {
    for (const role of user.roles) {
      if (typeof role === "string") {
        roles.add(normalizeRole(role));
      } else if (typeof role?.name === "string") {
        roles.add(normalizeRole(role.name));
      }
    }
  }

  if (Array.isArray(req.context?.roles)) {
    for (const role of req.context.roles) {
      if (typeof role === "string") {
        roles.add(normalizeRole(role));
      } else if (typeof role?.name === "string") {
        roles.add(normalizeRole(role.name));
      }
    }
  }

  roles.delete("");
  return roles;
}

function getPermissions(req) {
  const permissions = new Set();

  for (const source of [
    req.user?.permissions,
    req.context?.permissions,
  ]) {
    if (Array.isArray(source)) {
      for (const permission of source) {
        if (typeof permission === "string") {
          permissions.add(permission.trim().toLowerCase());
        }
      }
    }
  }

  return permissions;
}

function sendForbidden(res, message = "You do not have permission to perform this action.") {
  return res.status(403).json({
    success: false,
    message,
    error: "FORBIDDEN",
  });
}

/**
 * Restrict a route to one or more roles.
 *
 * Example:
 * router.get("/admin", authenticate, requireRole("admin"), handler);
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles
    .flat()
    .map(normalizeRole)
    .filter((role) => VALID_ROLES.has(role));

  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "UNAUTHENTICATED",
      });
    }

    if (normalizedAllowedRoles.length === 0) {
      return sendForbidden(res, "No valid roles were configured for this route.");
    }

    const userRoles = getUserRoles(req);

    if (!normalizedAllowedRoles.some((role) => userRoles.has(role))) {
      return sendForbidden(res, "Your account role cannot access this resource.");
    }

    return next();
  };
}

/**
 * Require all listed permissions.
 *
 * Example:
 * router.post("/", authenticate, requirePermission("procurement:create"), handler);
 */
export function requirePermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .map((permission) =>
      typeof permission === "string"
        ? permission.trim().toLowerCase()
        : ""
    )
    .filter(Boolean);

  return function permissionMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "UNAUTHENTICATED",
      });
    }

    if (required.length === 0) {
      return sendForbidden(res, "No permissions were configured for this route.");
    }

    const permissions = getPermissions(req);
    const roles = getUserRoles(req);

    // Demo role access is intentionally simple for local UI testing.
    // Do not use this role-to-permission mapping as production authorization.
    if (req.user.isDemo === true) {
      if (roles.has("admin")) {
        return next();
      }

      return sendForbidden(
        res,
        "Demo users do not have configured granular permissions."
      );
    }

    const hasAllPermissions = required.every(
      (permission) =>
        permissions.has("*") ||
        permissions.has(permission)
    );

    if (!hasAllPermissions) {
      return sendForbidden(res);
    }

    return next();
  };
}

/**
 * Require at least one listed permission.
 */
export function requireAnyPermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .map((permission) =>
      typeof permission === "string"
        ? permission.trim().toLowerCase()
        : ""
    )
    .filter(Boolean);

  return function anyPermissionMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "UNAUTHENTICATED",
      });
    }

    if (required.length === 0) {
      return sendForbidden(res, "No permissions were configured for this route.");
    }

    const permissions = getPermissions(req);

    if (req.user.isDemo === true) {
      return getUserRoles(req).has("admin")
        ? next()
        : sendForbidden(
            res,
            "Demo users do not have configured granular permissions."
          );
    }

    const hasAnyPermission = required.some(
      (permission) =>
        permissions.has("*") ||
        permissions.has(permission)
    );

    if (!hasAnyPermission) {
      return sendForbidden(res);
    }

    return next();
  };
}

export default {
  requireRole,
  requirePermission,
  requireAnyPermission,
};
