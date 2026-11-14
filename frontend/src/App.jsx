
import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import EmployeePage from "./pages/employeepage";
import ManagerPage from "./pages/ManagerPage";
import FinancePage from "./pages/FinancePage";
import AdminPage from "./pages/AdminPage";

// Procurement pages are directly inside src/pages
import ProcurementManagerPage from "./pages/ProcurementManagerPage";
import ProcurementSpecialistPage from "./pages/ProcurementSpecialistPage";

// ============================================================
// AUTH HELPERS
// ============================================================

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken");

const getUser = () => {
  try {
    const storedUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    return (
      storedUser?.user ||
      storedUser?.data?.user ||
      storedUser?.data ||
      storedUser ||
      {}
    );
  } catch {
    return {};
  }
};

// ============================================================
// ROLE NORMALIZATION
// ============================================================

const normalizeRole = (role) => {
  if (!role) return "";

  if (typeof role === "object") {
    role =
      role.name ||
      role.slug ||
      role.code ||
      role.role ||
      "";
  }

  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
};

// ============================================================
// GET USER ROLES
// ============================================================

const getUserRoles = () => {
  const user = getUser();

  const possibleRoles = [
    user.role,
    user.userRole,
    user.user_type,
    user.userType,
    user.role_name,
    user.roleName,
    user.primaryRole,
    user.primary_role,
    user.roles,
    user.permissions?.role,
    user.account?.role,
  ];

  const roles = [];

  possibleRoles.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const role = normalizeRole(item);
        if (role) roles.push(role);
      });
    } else {
      const role = normalizeRole(value);
      if (role) roles.push(role);
    }
  });

  return [...new Set(roles)];
};

// ============================================================
// ROLE DASHBOARD ROUTES
// ============================================================

const roleRoutes = {
  employee: "/employee/dashboard",
  requester: "/employee/dashboard",

  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",

  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",

  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",

  procurement_manager: "/procurement-manager/dashboard",
  procurement_specialist: "/procurement-specialist/dashboard",
};

// ============================================================
// ROLE PRIORITY
// ============================================================

const rolePriority = [
  "platform_admin",
  "procurement_manager",
  "procurement_specialist",
  "organization_admin",
  "admin",
  "finance_manager",
  "finance",
  "department_manager",
  "manager",
  "requester",
  "employee",
];

// ============================================================
// GET USER DASHBOARD
// ============================================================

const getDashboardForUser = () => {
  const roles = getUserRoles();

  const primaryRole = rolePriority.find((role) =>
    roles.includes(role)
  );

  return roleRoutes[primaryRole] || "/login";
};

// ============================================================
// ROLE PERMISSIONS
// ============================================================

const rolePermissions = {
  employee: ["employee", "requester"],

  manager: ["manager", "department_manager"],

  finance: ["finance", "finance_manager"],

  admin: ["admin", "organization_admin"],

  procurementManager: ["procurement_manager"],

  procurementSpecialist: ["procurement_specialist"],
};

// ============================================================
// PROTECTED ROUTE
// ============================================================

function ProtectedRoute({
  children,
  allowedRoles = [],
}) {
  const location = useLocation();

  const token = getToken();
  const roles = getUserRoles();

  // No token means the user is not logged in.
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // Do not allow dashboard access when role information
  // is missing from localStorage.
  if (roles.length === 0) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // Check whether the logged-in user has permission.
  const hasAccess = allowedRoles.some((role) =>
    roles.includes(role)
  );

  // Prevent users from opening another role's dashboard.
  if (!hasAccess) {
    const dashboard = getDashboardForUser();

    return (
      <Navigate
        to={dashboard}
        replace
      />
    );
  }

  return children;
}

// ============================================================
// DASHBOARD REDIRECT
// ============================================================

function DashboardRedirect() {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const dashboard = getDashboardForUser();

  return (
    <Navigate
      to={dashboard}
      replace
    />
  );
}

// ============================================================
// APP ROUTES
// ============================================================

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC ROUTES */}

        <Route
          path="/"
          element={
            <Navigate
              to="/landingpage"
              replace
            />
          }
        />

        <Route
          path="/landingpage"
          element={<LandingPage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* EMPLOYEE DASHBOARD */}

        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={rolePermissions.employee}
            >
              <EmployeePage />
            </ProtectedRoute>
          }
        />

        {/* MANAGER DASHBOARD */}

        <Route
          path="/manager/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={rolePermissions.manager}
            >
              <ManagerPage />
            </ProtectedRoute>
          }
        />

        {/* FINANCE DASHBOARD */}

        <Route
          path="/finance/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={rolePermissions.finance}
            >
              <FinancePage />
            </ProtectedRoute>
          }
        />

        {/* ORGANIZATION ADMIN DASHBOARD */}

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={rolePermissions.admin}
            >
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* PROCUREMENT MANAGER DASHBOARD */}

        <Route
          path="/procurement-manager/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={rolePermissions.procurementManager}
            >
              <ProcurementManagerPage />
            </ProtectedRoute>
          }
        />

        {/* PROCUREMENT SPECIALIST DASHBOARD */}

        <Route
          path="/procurement-specialist/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={rolePermissions.procurementSpecialist}
            >
              <ProcurementSpecialistPage />
            </ProtectedRoute>
          }
        />

        {/* OLD PROCUREMENT URL REDIRECT */}

        <Route
          path="/procurement"
          element={
            <DashboardRedirect />
          }
        />

        <Route
          path="/procurement/dashboard"
          element={
            <DashboardRedirect />
          }
        />

        {/* DASHBOARD REDIRECT */}

        <Route
          path="/dashboard"
          element={<DashboardRedirect />}
        />

        {/* UNKNOWN ROUTES */}

        <Route
          path="*"
          element={
            <Navigate
              to="/landingpage"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
