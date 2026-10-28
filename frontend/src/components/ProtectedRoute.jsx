import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

const ROLE_DASHBOARDS = {
  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",
  employee: "/employee/dashboard",
  requester: "/employee/dashboard",
  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",
  procurement_manager: "/manager/dashboard",
  procurement_specialist: "/admin/dashboard",
  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",
  auditor: "/admin/dashboard",
  supplier_user: "/employee/dashboard",
};

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getUserRoles(user) {
  const roles = [];
  if (user?.role) roles.push(normalizeRole(user.role));
  if (user?.roleName) roles.push(normalizeRole(user.roleName));
  if (Array.isArray(user?.roles)) {
    user.roles.forEach((r) => {
      const val = typeof r === "string" ? r : r?.name;
      if (val) roles.push(normalizeRole(val));
    });
  }
  return Array.from(new Set(roles));
}

export default function ProtectedRoute({ allowedRoles = [] }) {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const storedToken =
          localStorage.getItem("token") ||
          localStorage.getItem("accessToken") ||
          sessionStorage.getItem("token");

        const headers = {
          Accept: "application/json",
        };

        if (storedToken) {
          headers.Authorization = `Bearer ${storedToken}`;
        }

        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          headers,
          credentials: "include", // Cookie verification
        });

        if (!res.ok) {
          throw new Error("Session invalid");
        }

        const data = await res.json();
        const user = data.user || data.data?.user;

        if (isMounted && user) {
          setCurrentUser(user);
          localStorage.setItem("user", JSON.stringify(user));
        }
      } catch {
        if (isMounted) {
          // If network failed but user was already cached in local dev, allow fallback
          const cached = localStorage.getItem("user");
          if (!cached) {
            setCurrentUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8faff",
          color: "#3156d9",
        }}
      >
        <LoaderCircle size={36} className="spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const userRoles = getUserRoles(currentUser);

  if (userRoles.length === 0) {
    return <Navigate to="/login" replace />;
  }

  const normalizedAllowed = allowedRoles.map(normalizeRole);

  const hasAccess =
    normalizedAllowed.length === 0 ||
    userRoles.some((r) => normalizedAllowed.includes(r));

  if (!hasAccess) {
    const primaryRole = userRoles[0];
    const correctDashboard = ROLE_DASHBOARDS[primaryRole] || "/login";
    return <Navigate to={correctDashboard} replace />;
  }

  return <Outlet />;
}
