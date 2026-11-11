
import { getDashboardAnalytics } from "./analytics.repository.js";

function getTenantId(user) {
  return (
    user?.tenantId ??
    user?.tenant_id ??
    user?.tenant?.id ??
    null
  );
}

function getUserId(user) {
  return user?.id ?? user?.userId ?? user?.user_id ?? null;
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function getAnalyticsDashboard(user) {
  if (!user || !getUserId(user)) {
    throw httpError("Authentication is required.", 401);
  }

  const tenantId = getTenantId(user);

  if (!tenantId) {
    throw httpError(
      "Your authenticated account does not have a tenant assigned.",
      403,
    );
  }

  return getDashboardAnalytics(String(tenantId));
}
