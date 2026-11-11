
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
]);

const ROLE_PERMISSIONS = {
  admin: [
    "analytics:read",
    "workflows:manage",
    "approvals:read",
    "approvals:act",
  ],

  organization_admin: [
    "analytics:read",
    "workflows:manage",
    "approvals:read",
    "approvals:act",
  ],

  manager: [
    "analytics:read",
    "approvals:read",
    "approvals:act",
  ],

  department_manager: [
    "analytics:read",
    "approvals:read",
    "approvals:act",
  ],

  procurement_manager: [
    "analytics:read",
    "workflows:manage",
    "approvals:read",
    "approvals:act",
  ],

  procurement_specialist: [
    "analytics:read",
    "workflows:manage",
    "approvals:read",
  ],

  finance: [
    "analytics:read",
    "approvals:read",
    "approvals:act",
  ],

  finance_manager: [
    "analytics:read",
    "approvals:read",
    "approvals:act",
  ],

  auditor: [
    "analytics:read",
    "approvals:read",
  ],

  employee: [],
  requester: [],
  supplier_user: [],
};

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

function expandRoleAliases(roleSet) {
  if (
    roleSet.has("organization_admin") ||
    roleSet.has("admin")
  ) {
    roleSet.add("admin");
    roleSet.add("organization_admin");
  }

  if (
    roleSet.has("requester") ||
    roleSet.has("employee")
  ) {
    roleSet.add("employee");
    roleSet.add("requester");
  }

  if (
    roleSet.has("department_manager") ||
    roleSet.has("procurement_manager") ||
    roleSet.has("manager")
  ) {
    roleSet.add("manager");
    roleSet.add("department_manager");
  }

  if (
    roleSet.has("finance_manager") ||
    roleSet.has("finance")
  ) {
    roleSet.add("finance");
    roleSet.add("finance_manager");
  }
}

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
    if (!source) continue;

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

  expandRoleAliases(roles);

  return roles;
}

function getExplicitPermissions(req) {
  const permissions = new Set();

  const sources = [
    req.user?.permissions,
    req.context?.permissions,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;

    for (const permission of source) {
      if (typeof permission === "string") {
        const normalized = normalizePermission(permission);
        if (normalized) permissions.add(normalized);
      } else if (permission && typeof permission === "object") {
        const normalized = normalizePermission(
          permission.name ??
          permission.permission ??
          permission.code
        );

        if (normalized) permissions.add(normalized);
      }
    }
  }

  return permissions;
}

function getPermissions(req) {
  const permissions = getExplicitPermissions(req);
  const roles = getUserRoles(req);

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }

  return permissions;
}

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

export function requireRole(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles
    .flat()
    .map(normalizeRole)
    .filter((role) => VALID_ROLES.has(role));

  return function roleMiddleware(req, res, next) {
    if (!req.user) return sendUnauthorized(res);

    if (normalizedAllowedRoles.length === 0) {
      return sendForbidden(
        res,
        "No valid roles were configured for this route."
      );
    }

    const userRoles = getUserRoles(req);

    const hasAllowedRole = normalizedAllowedRoles.some(
      (role) => userRoles.has(role)
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

export function requirePermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .map(normalizePermission)
    .filter(Boolean);

  return function permissionMiddleware(req, res, next) {
    if (!req.user) return sendUnauthorized(res);

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

export function requireAnyPermission(...requiredPermissions) {
  const required = requiredPermissions
    .flat()
    .map(normalizePermission)
    .filter(Boolean);

  return function anyPermissionMiddleware(req, res, next) {
    if (!req.user) return sendUnauthorized(res);

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

export default {
  requireRole,
  requirePermission,
  requireAnyPermission,
};
