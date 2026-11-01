const normalize = (value) => String(value).trim().toLowerCase();

function forbidden(message = "You do not have permission to perform this action.") {
  const error = new Error(message);
  error.status = 403;
  error.code = "FORBIDDEN";
  return error;
}

/**
 * Restrict a route to one or more roles.
 *
 * Example:
 * authorize("admin", "manager")
 */
export function authorize(...allowedRoles) {
  const permittedRoles = allowedRoles.flat().map(normalize);

  if (permittedRoles.length === 0) {
    throw new Error("authorize() requires at least one allowed role.");
  }

  return function authorizeRole(req, _res, next) {
    if (!req.user) {
      const error = new Error("Authentication required.");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    const userRoles = [
      ...(req.user.role ? [req.user.role] : []),
      ...(Array.isArray(req.user.roles) ? req.user.roles : []),
    ].map(normalize);

    const hasPermission = permittedRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!hasPermission) {
      return next(forbidden());
    }

    return next();
  };
}

/**
 * Require a specific permission.
 *
 * Example:
 * requirePermission("invoices:approve")
 */
export function requirePermission(...requiredPermissions) {
  const permissions = requiredPermissions.flat();

  if (permissions.length === 0) {
    throw new Error(
      "requirePermission() requires at least one permission."
    );
  }

  return function permissionCheck(req, _res, next) {
    if (!req.user) {
      const error = new Error("Authentication required.");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    const userPermissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];

    const allowed = permissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!allowed) {
      return next(forbidden("Required permission is missing."));
    }

    return next();
  };
}

export default authorize;