
import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import EmployeePage from "./pages/employeepage";
import ManagerPage from "./pages/ManagerPage";
import FinancePage from "./pages/FinancePage";
import AdminPage from "./pages/AdminPage";
import ProcurementPage from "./pages/procurement/ProcurementPage";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken");

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getUserRole = () => {
  const user = getUser();
  return String(
    user.role ||
      user.userRole ||
      user.user_type ||
      user.userType ||
      ""
  ).toLowerCase();
};

const roleRoutes = {
  employee: "/employee/dashboard",
  requester: "/employee/dashboard",
  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",
  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",
  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",
  procurement_manager: "/procurement/dashboard",
  procurement_specialist: "/procurement/dashboard",
};

function ProtectedRoute({ children, allowedRoles }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const role = getUserRole();

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <Navigate
        to={roleRoutes[role] || "/login"}
        replace
      />
    );
  }

  return children;
}

function DashboardRedirect() {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  const role = getUserRole();

  return (
    <Navigate
      to={roleRoutes[role] || "/login"}
      replace
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Navigate to="/landingpage" replace />} />
        <Route path="/landingpage" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Employee Dashboard */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={["employee", "requester"]}
            >
              <EmployeePage />
            </ProtectedRoute>
          }
        />

        {/* Manager Dashboard */}
        <Route
          path="/manager/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={["manager", "department_manager"]}
            >
              <ManagerPage />
            </ProtectedRoute>
          }
        />

        {/* Finance Dashboard */}
        <Route
          path="/finance/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={["finance", "finance_manager"]}
            >
              <FinancePage />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={["admin", "organization_admin"]}
            >
              <AdminPage />
            </ProtectedRoute>
          }
        />
          
          {/* Procurement Dashboard */}
       <Route
         path="/procurement/dashboard"
         element={
           <ProtectedRoute
             allowedRoles={[
               "procurement_manager",
               "procurement_specialist",
               "admin",
                "organization_admin",
             ]}
           >
             <ProcurementPage />
           </ProtectedRoute>
         }
       />

        {/* Role-based Dashboard Redirect */}
        <Route path="/dashboard" element={<DashboardRedirect />} />

        {/* Unknown Routes */}
        <Route path="*" element={<Navigate to="/landingpage" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
