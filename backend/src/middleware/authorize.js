
import {
  requireRole,
  requirePermission as checkPermission,
  requireAnyPermission as checkAnyPermission,
} from "./rbac.js";

// ============================================================
// ETDOX CENTRALIZED AUTHORIZATION MIDDLEWARE
// ============================================================

/**
 * Restrict access to specific roles.
 *
 * Examples:
 * authorize("admin")
 * authorize("admin", "manager")
 * authorize("procurement_manager")
 * authorize("platform_admin")
 */
export function authorize(...allowedRoles) {
  return requireRole(...allowedRoles);
}

/**
 * Require ALL specified permissions.
 *
 * Example:
 * requirePermission(
 *   "purchase_requests:read",
 *   "purchase_requests:approve"
 * )
 */
export function requirePermission(...requiredPermissions) {
  return checkPermission(...requiredPermissions);
}

/**
 * Require ANY ONE of the specified permissions.
 *
 * Example:
 * requireAnyPermission(
 *   "purchase_requests:read",
 *   "purchase_orders:read"
 * )
 */
export function requireAnyPermission(...requiredPermissions) {
  return checkAnyPermission(...requiredPermissions);
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default authorize;
