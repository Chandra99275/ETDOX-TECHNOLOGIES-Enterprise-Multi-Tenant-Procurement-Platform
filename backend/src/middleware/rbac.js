
// ============================================================
// ETDOX ENTERPRISE RBAC MIDDLEWARE
// Role-Based Access Control
// ============================================================

// All supported database roles.
const VALID_ROLES = new Set([
  "admin",
  "organization_admin",
  "employee",
  "requester",
  "manager",
  "department_manager",
  "procurement_manager",
  "procurement_specialist",
  "finance",
  "finance_manager",
  "auditor",
  "supplier_user",
  "platform_admin",
]);

// Only genuinely equivalent role names are treated as aliases.
// Procurement Manager is NOT automatically a Manager.
// Platform Admin is NOT automatically an Organization Admin.
const ROLE_ALIASES = {
  admin: "admin",
  organization_admin: "admin",

  employee: "employee",
  requester: "employee",

  manager: "manager",
  department_manager: "manager",

  finance: "finance",
  finance_manager: "finance",

  procurement_manager: "procurement_manager",
  procurement_specialist: "procurement_specialist",

  auditor: "auditor",
  supplier_user: "supplier_user",
  platform_admin: "platform_admin",
};

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeRole(role) {
  if (typeof role !== "string") return "";

  return role
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizePermission(permission) {
  if (typeof permission !== "string") return "";

  return permission.trim().toLowerCase();
}

function canonicalRole(role) {
  const normalized = normalizeRole(role);

  if (!VALID_ROLES.has(normalized)) {
    return "";
  }

  return ROLE_ALIASES[normalized] ?? normalized;
}

// ============================================================
// EXTRACT USER ROLES
// ============================================================

function getUserRoles(req) {
  const roles = new Set();

  const addRole = (value) => {
    const normalized = normalizeRole(value);

    if (normalized && VALID_ROLES.has(normalized)) {
      roles.add(normalized);
    }
  };

  const sources = [
    req.user,
    req.context,
  ];

  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    addRole(source.role);
    addRole(source.roleName);
    addRole(source.role_name);

    if (Array.isArray(source.roles)) {
      for (const role of source.roles) {
        if (typeof role === "string") {
          addRole(role);
        } else if (role && typeof role === "object") {
          addRole(role.name);
          addRole(role.role);
          addRole(role.role_name);
        }
      }
    }
  }

  return roles;
}

// ============================================================
// EXTRACT EXPLICIT PERMISSIONS
// ============================================================

function getExplicitPermissions(req) {
  const permissions = new Set();

  const sources = [
    req.user?.permissions,
    req.context?.permissions,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const permission of source) {
      if (typeof permission === "string") {
        const normalized = normalizePermission(permission);

        if (normalized) {
          permissions.add(normalized);
        }
      } else if (
        permission &&
        typeof permission === "object"
      ) {
        const normalized = normalizePermission(
          permission.name ??
          permission.permission ??
          permission.code
        );

        if (normalized) {
          permissions.add(normalized);
        }
      }
    }
  }

  return permissions;
}

// ============================================================
// EFFECTIVE PERMISSIONS
// ============================================================

// PostgreSQL role permissions must be loaded into
// req.user.permissions by the authentication flow.
//
// This middleware deliberately does not invent permissions
// based only on a role name. It follows deny-by-default.
function getPermissions(req) {
  return getExplicitPermissions(req);
}

// ============================================================
// ERROR RESPONSES
// ============================================================

function sendForbidden(
  res,
  message = "You do not have permission to perform this action."
) {
  return res.status(403).json({
    success: false,
    message,
    error: "FORBIDDEN",
  });
}

function sendUnauthorized(res) {
  return res.status(401).json({
    success: false,
    message: "Authentication required.",
    error: "UNAUTHENTICATED",
  });
}

// ============================================================
// REQUIRE ROLE
// ============================================================

export function requireRole(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles
    .flat()
    .map(canonicalRole)
    .filter(Boolean);

  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return sendUnauthorized(res);
    }

    if (normalizedAllowedRoles.length === 0) {
      return sendForbidden(
        res,
        "No valid roles were configured for this route."
      );
    }

    const userRoles = getUserRoles(req);

    const canonicalUserRoles = new Set(
      [...userRoles]
        .map(canonicalRole)
        .filter(Boolean)
    );

    const hasAllowedRole = normalizedAllowedRoles.some(
      (role) => canonicalUserRoles.has(role)
    );

    if (!hasAllowedRole) {
      return sendForbidden(
        res,
        "Your account role cannot access this resource."
      );
    }

    return next();
  };
}

// ============================================================
// REQUIRE ALL PERMISSIONS
// ============================================================

export function requirePermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .map(normalizePermission)
    .filter(Boolean);

  return function permissionMiddleware(req, res, next) {
    if (!req.user) {
      return sendUnauthorized(res);
    }

    if (required.length === 0) {
      return sendForbidden(
        res,
        "No permissions were configured for this route."
      );
    }

    const permissions = getPermissions(req);

    const hasAllPermissions = required.every(
      (permission) =>
        permissions.has("*") ||
        permissions.has(permission)
    );

    if (!hasAllPermissions) {
      return sendForbidden(
        res,
        "Your account does not have the required permission."
      );
    }

    return next();
  };
}

// ============================================================
// REQUIRE ANY PERMISSION
// ============================================================

export function requireAnyPermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .map(normalizePermission)
    .filter(Boolean);

  return function anyPermissionMiddleware(req, res, next) {
    if (!req.user) {
      return sendUnauthorized(res);
    }

    if (required.length === 0) {
      return sendForbidden(
        res,
        "No permissions were configured for this route."
      );
    }

    const permissions = getPermissions(req);

    const hasAnyPermission = required.some(
      (permission) =>
        permissions.has("*") ||
        permissions.has(permission)
    );

    if (!hasAnyPermission) {
      return sendForbidden(
        res,
        "Your account does not have any of the required permissions."
      );
    }

    return next();
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  requireRole,
  requirePermission,
  requireAnyPermission,
};
