
import { AppError } from "../utils/errors.js";

// --------------------------------------------------
// 1. Normalize roles
// --------------------------------------------------

function getUserRoles(user) {
  if (!user) return [];

  const roles = Array.isArray(user.roles)
    ? user.roles
    : [];

  const normalizedRoles = roles
    .map((role) =>
      typeof role === "string"
        ? role
        : role?.name
    )
    .filter(Boolean)
    .map((role) => role.trim().toLowerCase());

  // Support legacy middleware and login responses that
  // expose a single role instead of a roles array.
  if (normalizedRoles.length === 0) {
    const singleRole =
      typeof user.role === "string"
        ? user.role
        : typeof user.roleName === "string"
          ? user.roleName
          : null;

    if (singleRole?.trim()) {
      normalizedRoles.push(singleRole.trim().toLowerCase());
    }
  }

  return [...new Set(normalizedRoles)];
}

// --------------------------------------------------
// 2. Normalize permissions
// --------------------------------------------------

function getUserPermissions(req) {
  const permissions = new Set();

  const userPermissions = req.user?.permissions;
  const contextPermissions = req.context?.permissions;

  if (Array.isArray(userPermissions)) {
    userPermissions.forEach((permission) => {
      if (typeof permission === "string") {
        permissions.add(permission.trim());
      }
    });
  }

  if (Array.isArray(contextPermissions)) {
    contextPermissions.forEach((permission) => {
      if (typeof permission === "string") {
        permissions.add(permission.trim());
      }
    });
  }

  // Some authentication implementations store permissions
  // on individual role objects.
  for (const role of req.user?.roles ?? []) {
    if (
      role &&
      typeof role === "object" &&
      Array.isArray(role.permissions)
    ) {
      role.permissions.forEach((permission) => {
        if (typeof permission === "string") {
          permissions.add(permission.trim());
        }
      });
    }
  }

  permissions.delete("");

  return permissions;
}

// --------------------------------------------------
// 3. Check whether a permission is granted
// --------------------------------------------------

function hasPermission(grantedPermissions, requiredPermission) {
  return (
    grantedPermissions.has("*") ||
    grantedPermissions.has(requiredPermission)
  );
}

// --------------------------------------------------
// 4. Role-based authorization
// --------------------------------------------------

export function authorize(...allowedRoles) {
  const requiredRoles = allowedRoles
    .flat()
    .filter((role) => role !== null && role !== undefined)
    .map((role) => String(role).trim().toLowerCase())
    .filter(Boolean);

  return (req, res, next) => {
    if (!req.user && !req.context) {
      return next(
        new AppError(
          401,
          "UNAUTHENTICATED",
          "Authenticate before accessing this resource."
        )
      );
    }

    // An empty role list means authentication is sufficient.
    if (requiredRoles.length === 0) {
      return next();
    }

    const userRoles = getUserRoles(req.user);

    // Support context-only middleware.
    if (userRoles.length === 0 && req.context) {
      userRoles.push(
        ...getUserRoles({
          roles: req.context.roles,
        })
      );
    }

    const allowed = requiredRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!allowed) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have the required role."
        )
      );
    }

    return next();
  };
}

// --------------------------------------------------
// 5. Permission-based authorization
// --------------------------------------------------

export function requirePermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .filter(
      (permission) =>
        permission !== null && permission !== undefined
    )
    .map((permission) => String(permission).trim())
    .filter(Boolean);

  return (req, res, next) => {
    if (!req.user && !req.context) {
      return next(
        new AppError(
          401,
          "UNAUTHENTICATED",
          "Authentication is required."
        )
      );
    }

    // No requested permissions means authentication alone
    // is sufficient.
    if (required.length === 0) {
      return next();
    }

    const grantedPermissions = getUserPermissions(req);

    const allowed = required.every((permission) =>
      hasPermission(grantedPermissions, permission)
    );

    if (!allowed) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action."
        )
      );
    }

    return next();
  };
}

// --------------------------------------------------
// 6. Require any one of several permissions
// --------------------------------------------------

export function requireAnyPermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .filter(
      (permission) =>
        permission !== null && permission !== undefined
    )
    .map((permission) => String(permission).trim())
    .filter(Boolean);

  return (req, res, next) => {
    if (!req.user && !req.context) {
      return next(
        new AppError(
          401,
          "UNAUTHENTICATED",
          "Authentication is required."
        )
      );
    }

    if (required.length === 0) {
      return next();
    }

    const grantedPermissions = getUserPermissions(req);

    const allowed = required.some((permission) =>
      hasPermission(grantedPermissions, permission)
    );

    if (!allowed) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have any of the required permissions."
        )
      );
    }

    return next();
  };
}

// --------------------------------------------------
// 7. Default export
// --------------------------------------------------

export default authorize;
