import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LandingPage from "./pages/LandingPage.jsx";
import Login from "./pages/Login.jsx";
import EmployeePage from "./pages/EmployeePage.jsx";
import FinancePage from "./pages/FinancePage.jsx";
import ManagerPage from "./pages/ManagerPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
          <Route path="/employee/dashboard" element={<EmployeePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["finance"]} />}>
          <Route path="/finance/dashboard" element={<FinancePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["manager"]} />}>
          <Route path="/manager/dashboard" element={<ManagerPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin/dashboard" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}