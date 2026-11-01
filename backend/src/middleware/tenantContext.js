import { withTenantTransaction } from "../config/database.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function tenantContext(req, _res, next) {
  try {
    if (!req.user) {
      return next(
        createError(
          401,
          "Authentication is required to establish tenant context.",
          "UNAUTHORIZED"
        )
      );
    }

    const tenantId = req.user.tenantId;

    if (typeof tenantId !== "string" || !UUID_REGEX.test(tenantId)) {
      return next(
        createError(
          403,
          "The authenticated user has an invalid tenant ID.",
          "INVALID_TENANT"
        )
      );
    }

    // Reject a conflicting tenant ID supplied through a request header.
    const requestedTenantId = req.headers["x-tenant-id"];

    if (
      requestedTenantId !== undefined &&
      (
        typeof requestedTenantId !== "string" ||
        requestedTenantId.toLowerCase() !== tenantId.toLowerCase()
      )
    ) {
      return next(
        createError(
          403,
          "You cannot access another tenant's data.",
          "TENANT_MISMATCH"
        )
      );
    }

    // The tenant ID is taken from the verified authentication context.
    req.tenantId = tenantId;

    /**
     * Run tenant-scoped database operations inside a transaction.
     *
     * The callback receives the transaction's PostgreSQL client.
     * All tenant-scoped queries must use that client so the
     * transaction-local app.tenant_id setting remains in effect.
     */
    req.withTenantTransaction = (callback) =>
      withTenantTransaction(req.tenantId, callback);

    return next();
  } catch (error) {
    return next(error);
  }
}

export default tenantContext;