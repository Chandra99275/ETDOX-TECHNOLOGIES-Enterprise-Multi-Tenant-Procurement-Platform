
import { Navigate, Outlet, useLocation } from "react-router-dom";

const ROLE_DASHBOARDS = {
  admin: "/admin/dashboard",
  employee: "/employee/dashboard",
  manager: "/manager/dashboard",
  finance: "/finance/dashboard",
};

function readStoredValue(key) {
  // Prefer localStorage because Login.jsx saves authentication there.
  // Fall back to sessionStorage for compatibility with older components.
  const localValue = localStorage.getItem(key);

  if (localValue) {
    return localValue;
  }

  return sessionStorage.getItem(key);
}

function getStoredAuthentication() {
  let token = null;
  let user = null;

  try {
    token =
      readStoredValue("accessToken") ||
      readStoredValue("authToken") ||
      readStoredValue("token");

    const storedUser = readStoredValue("user");

    user = storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error(
      "[ProtectedRoute] Unable to read stored authentication:",
      error
    );

    return { token: null, user: null };
  }

  return { token, user };
}

function getUserRole(user) {
  const role =
    user?.role ||
    user?.roleName ||
    (Array.isArray(user?.roles) ? user.roles[0] : "");

  return String(role || "").trim().toLowerCase();
}

export default function ProtectedRoute({ allowedRoles = [] }) {
  const location = useLocation();

  const { token, user } = getStoredAuthentication();

  // Require both a token and valid user details.
  if (!token || !user || typeof user !== "object") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  const role = getUserRole(user);

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  const normalizedAllowedRoles = allowedRoles.map((item) =>
    String(item).trim().toLowerCase()
  );

  // Keep users on the dashboard matching their own role.
  if (!normalizedAllowedRoles.includes(role)) {
    const correctDashboard = ROLE_DASHBOARDS[role];

    return (
      <Navigate
        to={correctDashboard || "/login"}
        replace
      />
    );
  }

  return <Outlet />;
}
