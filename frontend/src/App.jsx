import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LandingPage from "./pages/LandingPage.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PendingApproval from "./pages/PendingApproval.jsx";

import EmployeePage from "./pages/EmployeePage.jsx";
import FinancePage from "./pages/FinancePage.jsx";
import ManagerPage from "./pages/ManagerPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* Employee / Requester Dashboard */}
        <Route element={<ProtectedRoute allowedRoles={["employee", "requester"]} />}>
          <Route path="/employee/dashboard" element={<EmployeePage />} />
          <Route path="/dashboard" element={<EmployeePage />} />
        </Route>

        {/* Finance Manager Dashboard */}
        <Route element={<ProtectedRoute allowedRoles={["finance", "finance_manager"]} />}>
          <Route path="/finance/dashboard" element={<FinancePage />} />
          <Route path="/dashboard/finance" element={<FinancePage />} />
        </Route>

        {/* Department / Procurement Manager Dashboard */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={["manager", "department_manager", "procurement_manager"]}
            />
          }
        >
          <Route path="/manager/dashboard" element={<ManagerPage />} />
          <Route path="/dashboard/manager" element={<ManagerPage />} />
          <Route path="/dashboard/procurement-manager" element={<ManagerPage />} />
        </Route>

        {/* Organization Admin / Procurement Specialist / Auditor Dashboard */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "organization_admin",
                "procurement_specialist",
                "auditor",
              ]}
            />
          }
        >
          <Route path="/admin/dashboard" element={<AdminPage />} />
          <Route path="/dashboard/admin" element={<AdminPage />} />
          <Route path="/dashboard/procurement" element={<AdminPage />} />
          <Route path="/dashboard/audit" element={<AdminPage />} />
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}