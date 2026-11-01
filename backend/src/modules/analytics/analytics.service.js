import { getDashboardAnalytics } from "./analytics.repository.js";

function getTenantId(user) {
  return (
    user?.tenantId ??
    user?.tenant_id ??
    user?.tenant?.id ??
    null
  );
}

export async function getAnalyticsDashboard(user) {
  if (!user) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  const tenantId = getTenantId(user);

  if (!tenantId) {
    const error = new Error(
      "Your authenticated account does not have a tenant assigned."
    );
    error.statusCode = 403;
    throw error;
  }

  return getDashboardAnalytics(tenantId);
}