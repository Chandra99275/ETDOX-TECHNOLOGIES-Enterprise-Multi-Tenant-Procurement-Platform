
import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Wallet,
  Building2,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  UserPlus,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const getArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
};

const getStatus = (request) =>
  String(request.status || request.requestStatus || "PENDING")
    .toUpperCase()
    .replaceAll(" ", "_");

const getEmployee = (request) =>
  request.employeeName ||
  request.employee?.name ||
  request.requester?.name ||
  request.user?.name ||
  request.createdByName ||
  "Employee";

const getProduct = (request) =>
  request.productName ||
  request.product_name ||
  request.title ||
  request.itemName ||
  "Product request";

const getAmount = (request) =>
  Number(
    request.totalAmount ??
      request.total_amount ??
      request.amount ??
      Number(request.quantity || 0) *
        Number(request.unitPrice || request.unit_price || 0)
  );

export default function AdminPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Overview");
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminName, setAdminName] = useState("Administrator");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const headers = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };

  const apiRequest = async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${response.status})`
      );
    }

    return data;
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/procurement/requests"),
        apiRequest("/budgets"),
        apiRequest("/users"),
        apiRequest("/auth/me"),
      ]);

      if (results[0].status === "fulfilled") {
        setRequests(
          getArray(results[0].value, ["requests", "items", "results"])
        );
      } else {
        setRequests([]);
      }

      if (results[1].status === "fulfilled") {
        setBudgets(
          getArray(results[1].value, ["budgets", "items", "results"])
        );
      } else {
        setBudgets([]);
      }

      if (results[2].status === "fulfilled") {
        setUsers(getArray(results[2].value, ["users", "items", "results"]));
      } else {
        setUsers([]);
      }

      if (results[3].status === "fulfilled") {
        const result = results[3].value;
        const user =
          result?.user || result?.data?.user || result?.data || result;

        if (user?.name || user?.fullName) {
          setAdminName(user.name || user.fullName);
        }
      }

      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length === results.length) {
        setError("Unable to connect to the admin APIs. Check your backend.");
      } else if (failures.length > 0) {
        setError(
          "Some dashboard information could not be loaded. Check your API routes and permissions."
        );
      }
    } catch (err) {
      setError(err.message || "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    loadDashboard();
  }, []);

  const pendingRequests = useMemo(
    () =>
      requests.filter((r) =>
        [
          "PENDING",
          "SUBMITTED",
          "PENDING_MANAGER",
          "MANAGER_PENDING",
          "PENDING_FINANCE",
          "MANAGER_APPROVED",
        ].includes(getStatus(r))
      ),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter((r) =>
        ["APPROVED", "FINANCE_APPROVED", "COMPLETED"].includes(getStatus(r))
      ),
    [requests]
  );

  const rejectedRequests = useMemo(
    () =>
      requests.filter((r) =>
        ["REJECTED", "MANAGER_REJECTED", "FINANCE_REJECTED"].includes(
          getStatus(r)
        )
      ),
    [requests]
  );

  const totalBudget = useMemo(
    () =>
      budgets.reduce(
        (sum, b) =>
          sum +
          Number(
            b.allocated ??
              b.totalBudget ??
              b.total_budget ??
              b.amount ??
              0
          ),
        0
      ),
    [budgets]
  );

  const totalSpent = useMemo(
    () =>
      budgets.reduce(
        (sum, b) =>
          sum +
          Number(b.spent ?? b.used ?? b.committed ?? 0),
        0
      ),
    [budgets]
  );

  const filteredRequests = useMemo(() => {
    let list = [...requests];

    if (statusFilter !== "ALL") {
      list = list.filter((r) => getStatus(r) === statusFilter);
    }

    const query = search.toLowerCase().trim();

    if (query) {
      list = list.filter((r) =>
        [
          getEmployee(r),
          getProduct(r),
          r.supplier || r.supplierName || "",
          r.department || r.departmentName || "",
          r.id || r.requestId || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    return list;
  }, [requests, statusFilter, search]);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return users;

    return users.filter((user) =>
      [
        user.name,
        user.fullName,
        user.email,
        user.role,
        user.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  const statusStyle = (status) => {
    if (
      ["APPROVED", "FINANCE_APPROVED", "COMPLETED"].includes(status)
    ) {
      return "approved";
    }

    if (
      ["REJECTED", "MANAGER_REJECTED", "FINANCE_REJECTED"].includes(status)
    ) {
      return "rejected";
    }

    return "pending";
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "All Requests", icon: ClipboardList },
    { name: "Employees", icon: Users },
    { name: "Budgets", icon: Wallet },
  ];

  const userRoleCount = (role) =>
    users.filter(
      (u) => String(u.role || "").toLowerCase() === role.toLowerCase()
    ).length;

  return (
    <div className="admin-app">
      <style>{`
        * { box-sizing: border-box; }
        .admin-app {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }
        .admin-sidebar {
          width: 250px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #111c35;
          color: white;
          padding: 25px 16px;
        }
        .admin-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px 30px;
          font-size: 21px;
          font-weight: 800;
        }
        .admin-brand-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #3675f5;
        }
        .admin-nav-label {
          padding: 10px 12px;
          color: #8492ae;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .admin-nav {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 12px;
          margin: 3px 0;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #aebbd2;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }
        .admin-nav.active, .admin-nav:hover {
          background: #263b65;
          color: white;
        }
        .admin-sidebar-bottom {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #2b3955;
        }
        .admin-main {
          flex: 1;
          min-width: 0;
          padding: 28px 34px;
        }
        .admin-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 28px;
        }
        .admin-heading h1 {
          margin: 0 0 7px;
          font-size: 25px;
          color: #172033;
        }
        .admin-heading p {
          margin: 0;
          color: #8490a4;
          font-size: 13px;
        }
        .admin-top-actions {
          display: flex;
          align-items: center;
          gap: 13px;
        }
        .admin-icon-btn {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 1px solid #e5e9f1;
          border-radius: 10px;
          background: white;
          color: #59677e;
          cursor: pointer;
        }
        .admin-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 12px;
          border: 1px solid #e7ebf2;
          border-radius: 11px;
          background: white;
        }
        .admin-avatar {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #3675f5;
          color: white;
          font-weight: 700;
        }
        .admin-profile strong { display: block; font-size: 12px; }
        .admin-profile small { color: #8a96a8; font-size: 10px; }
        .admin-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 22px;
        }
        .admin-stat {
          padding: 19px;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          background: white;
        }
        .admin-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #7d899c;
          font-size: 12px;
          font-weight: 600;
        }
        .admin-stat-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #edf3ff;
          color: #3675f5;
        }
        .admin-stat h2 {
          margin: 13px 0 5px;
          font-size: 25px;
        }
        .admin-stat small { color: #929daf; font-size: 11px; }
        .admin-secondary-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 22px;
        }
        .admin-secondary-card {
          padding: 18px 20px;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          background: white;
        }
        .admin-secondary-card h3 {
          margin: 0 0 8px;
          font-size: 13px;
          color: #64728a;
        }
        .admin-secondary-card strong {
          display: block;
          font-size: 22px;
          margin-bottom: 6px;
        }
        .admin-progress {
          height: 7px;
          overflow: hidden;
          border-radius: 20px;
          background: #edf0f5;
        }
        .admin-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #3675f5;
        }
        .admin-panel {
          overflow: hidden;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          background: white;
        }
        .admin-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 21px;
          border-bottom: 1px solid #edf0f5;
        }
        .admin-panel-head h2 { margin: 0 0 5px; font-size: 16px; }
        .admin-panel-head p { margin: 0; color: #929daf; font-size: 11px; }
        .admin-controls { display: flex; flex-wrap: wrap; gap: 10px; }
        .admin-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          background: white;
        }
        .admin-search input {
          width: 180px;
          padding: 10px 0;
          border: 0;
          outline: 0;
          font-size: 12px;
        }
        .admin-select {
          padding: 9px 11px;
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          background: white;
          color: #526078;
          font-size: 12px;
          outline: 0;
        }
        .admin-table-wrap { overflow-x: auto; }
        .admin-table {
          width: 100%;
          min-width: 750px;
          border-collapse: collapse;
        }
        .admin-table th {
          padding: 13px 16px;
          background: #fafbfd;
          border-bottom: 1px solid #edf0f5;
          color: #8b96a8;
          font-size: 10px;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: .6px;
        }
        .admin-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #f0f2f6;
          color: #536078;
          font-size: 12px;
        }
        .admin-table tr:last-child td { border-bottom: 0; }
        .admin-person { display: flex; align-items: center; gap: 9px; }
        .admin-person-avatar {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #edf3ff;
          color: #3675f5;
          font-weight: 700;
        }
        .admin-person strong { display: block; color: #27344a; font-size: 12px; margin-bottom: 4px; }
        .admin-person small { display: block; color: #9aa4b4; font-size: 10px; }
        .admin-status {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }
        .admin-status.pending { background: #fff5df; color: #b77a13; }
        .admin-status.approved { background: #e6f8ef; color: #16844e; }
        .admin-status.rejected { background: #ffe9e9; color: #cf4444; }
        .admin-action {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 1px solid #e5e9f1;
          border-radius: 7px;
          background: white;
          color: #64728a;
          cursor: pointer;
        }
        .admin-empty, .admin-loading {
          padding: 55px 20px;
          text-align: center;
          color: #8995a8;
          font-size: 13px;
        }
        .admin-empty svg { margin-bottom: 10px; }
        .admin-alert {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 17px;
          padding: 12px 15px;
          border-radius: 9px;
          font-size: 12px;
        }
        .admin-alert.error { color: #b52c35; background: #fff0f0; }
        .admin-alert.success { color: #13764a; background: #e9f8f0; }
        .admin-budget-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          padding: 20px;
        }
        .admin-budget-card {
          padding: 17px;
          border: 1px solid #edf0f5;
          border-radius: 11px;
        }
        .admin-budget-card h3 { margin: 0 0 8px; font-size: 13px; }
        .admin-budget-card p { margin: 0 0 13px; color: #8d98aa; font-size: 11px; }
        .admin-budget-card strong { display: block; margin-bottom: 10px; font-size: 19px; }
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(13, 24, 44, .55);
        }
        .admin-modal {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          border-radius: 15px;
          background: white;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
        }
        .admin-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .admin-modal-head h2 { margin: 0; font-size: 18px; }
        .admin-close {
          width: 31px;
          height: 31px;
          border: 0;
          border-radius: 8px;
          background: #f1f3f7;
          cursor: pointer;
        }
        .admin-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .admin-detail {
          min-width: 0;
          padding: 12px;
          border: 1px solid #edf0f5;
          border-radius: 9px;
        }
        .admin-detail small { display: block; margin-bottom: 6px; color: #929daf; font-size: 10px; }
        .admin-detail strong { color: #27344a; font-size: 12px; overflow-wrap: anywhere; }
        .admin-mobile-menu { display: none; }
        @media(max-width: 1050px) {
          .admin-stats { grid-template-columns: repeat(2, 1fr); }
          .admin-budget-grid { grid-template-columns: repeat(2, 1fr); }
          .admin-main { padding: 22px; }
        }
        @media(max-width: 700px) {
          .admin-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 80;
            transform: translateX(-100%);
            transition: transform .2s ease;
          }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { padding: 18px 13px; }
          .admin-mobile-menu { display: grid; }
          .admin-heading h1 { font-size: 20px; }
          .admin-profile { display: none; }
          .admin-stats { gap: 9px; }
          .admin-stat { padding: 13px; }
          .admin-stat h2 { font-size: 21px; }
          .admin-secondary-stats { grid-template-columns: 1fr; }
          .admin-panel-head { align-items: flex-start; flex-direction: column; }
          .admin-search input { width: 130px; }
          .admin-budget-grid { grid-template-columns: 1fr; }
          .admin-details { grid-template-columns: 1fr; }
        }
      `}</style>

      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <Building2 size={21} />
          </div>
          ETDOX
        </div>

        <div className="admin-nav-label">ADMINISTRATION</div>

        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={`admin-nav ${
                activeTab === item.name ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(item.name);
                setSearch("");
                setStatusFilter("ALL");
                setSidebarOpen(false);
              }}
            >
              <Icon size={17} />
              {item.name}
            </button>
          );
        })}

        <div className="admin-sidebar-bottom">
          <button className="admin-nav" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="admin-icon-btn admin-mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="admin-heading">
              <h1>
                {activeTab === "Overview"
                  ? "Admin Dashboard"
                  : activeTab}
              </h1>
              <p>Manage organization procurement and monitor operations.</p>
            </div>
          </div>

          <div className="admin-top-actions">
            <button
              className="admin-icon-btn"
              title="Refresh dashboard"
              onClick={loadDashboard}
            >
              <RefreshCw size={16} />
            </button>

            <button className="admin-icon-btn" title="Notifications">
              <Bell size={17} />
            </button>

            <div className="admin-profile">
              <div className="admin-avatar">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{adminName}</strong>
                <small>Administrator</small>
              </div>
              <ChevronDown size={14} color="#8490a4" />
            </div>
          </div>
        </header>

        {error && (
          <div className="admin-alert error">
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError("")}
              style={{ marginLeft: "auto", border: 0, background: "none", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="admin-alert success">
            <CheckCircle2 size={16} />
            {success}
            <button
              onClick={() => setSuccess("")}
              style={{ marginLeft: "auto", border: 0, background: "none", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {activeTab === "Overview" && (
          <>
            <section className="admin-stats">
              <div className="admin-stat">
                <div className="admin-stat-top">
                  Total Employees
                  <span className="admin-stat-icon">
                    <Users size={18} />
                  </span>
                </div>
                <h2>{users.length}</h2>
                <small>Users returned by the users API</small>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-top">
                  Total Requests
                  <span className="admin-stat-icon">
                    <ClipboardList size={18} />
                  </span>
                </div>
                <h2>{requests.length}</h2>
                <small>Organization procurement requests</small>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-top">
                  Pending Requests
                  <span className="admin-stat-icon">
                    <Clock size={18} />
                  </span>
                </div>
                <h2>{pendingRequests.length}</h2>
                <small>Requests awaiting a decision</small>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-top">
                  Approved Requests
                  <span className="admin-stat-icon">
                    <CheckCircle2 size={18} />
                  </span>
                </div>
                <h2>{approvedRequests.length}</h2>
                <small>Approved or completed requests</small>
              </div>
            </section>

            <section className="admin-secondary-stats">
              <div className="admin-secondary-card">
                <h3>Total Allocated Budget</h3>
                <strong>{formatCurrency(totalBudget)}</strong>
                <div className="admin-progress">
                  <span
                    style={{
                      width: `${
                        totalBudget > 0
                          ? Math.min((totalSpent / totalBudget) * 100, 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <small style={{ color: "#929daf", fontSize: 10 }}>
                  {formatCurrency(totalSpent)} used / committed
                </small>
              </div>

              <div className="admin-secondary-card">
                <h3>Rejected Requests</h3>
                <strong>{rejectedRequests.length}</strong>
                <small style={{ color: "#929daf", fontSize: 10 }}>
                  Rejected across manager and finance stages
                </small>
              </div>
            </section>
          </>
        )}

        {activeTab === "Overview" && (
          <section className="admin-panel" style={{ marginBottom: 22 }}>
            <div className="admin-panel-head">
              <div>
                <h2>Recent Procurement Requests</h2>
                <p>Latest requests across the organization.</p>
              </div>
              <button
                className="admin-icon-btn"
                title="View all requests"
                onClick={() => setActiveTab("All Requests")}
              >
                <Eye size={16} />
              </button>
            </div>

            {loading ? (
              <div className="admin-loading">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="admin-empty">
                <ClipboardList size={32} />
                <p>No procurement requests found.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Product</th>
                      <th>Department</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 6).map((request, index) => {
                      const status = getStatus(request);

                      return (
                        <tr key={request.id || request.requestId || index}>
                          <td>
                            <div className="admin-person">
                              <div className="admin-person-avatar">
                                {getEmployee(request).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{getEmployee(request)}</strong>
                                <small>{request.employeeEmail || "Employee"}</small>
                              </div>
                            </div>
                          </td>
                          <td>{getProduct(request)}</td>
                          <td>
                            {request.department ||
                              request.departmentName ||
                              "—"}
                          </td>
                          <td>{formatCurrency(getAmount(request))}</td>
                          <td>
                            {formatDate(
                              request.createdAt || request.created_at
                            )}
                          </td>
                          <td>
                            <span
                              className={`admin-status ${statusStyle(status)}`}
                            >
                              {status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            <button
                              className="admin-action"
                              onClick={() => setSelectedRequest(request)}
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "All Requests" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>All Procurement Requests</h2>
                <p>Monitor requests submitted by employees.</p>
              </div>

              <div className="admin-controls">
                <div className="admin-search">
                  <Search size={15} color="#8d98aa" />
                  <input
                    placeholder="Search requests..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="admin-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING_MANAGER">Pending Manager</option>
                  <option value="MANAGER_APPROVED">Manager Approved</option>
                  <option value="MANAGER_REJECTED">Manager Rejected</option>
                  <option value="PENDING_FINANCE">Pending Finance</option>
                  <option value="FINANCE_APPROVED">Finance Approved</option>
                  <option value="FINANCE_REJECTED">Finance Rejected</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">Loading requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="admin-empty">
                <ClipboardList size={32} />
                <p>No matching requests found.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Product</th>
                      <th>Supplier</th>
                      <th>Department</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request, index) => {
                      const status = getStatus(request);

                      return (
                        <tr key={request.id || request.requestId || index}>
                          <td>
                            <div className="admin-person">
                              <div className="admin-person-avatar">
                                {getEmployee(request).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{getEmployee(request)}</strong>
                                <small>{request.employeeEmail || "Employee"}</small>
                              </div>
                            </div>
                          </td>
                          <td>{getProduct(request)}</td>
                          <td>
                            {request.supplier || request.supplierName || "—"}
                          </td>
                          <td>
                            {request.department ||
                              request.departmentName ||
                              "—"}
                          </td>
                          <td>{formatCurrency(getAmount(request))}</td>
                          <td>
                            <span
                              className={`admin-status ${statusStyle(status)}`}
                            >
                              {status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            <button
                              className="admin-action"
                              onClick={() => setSelectedRequest(request)}
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "Employees" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>Organization Users</h2>
                <p>View users and their assigned roles.</p>
              </div>

              <div className="admin-search">
                <Search size={15} color="#8d98aa" />
                <input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">
                <Users size={32} />
                <p>No users found.</p>
                <small>
                  Verify that your backend exposes the users endpoint.
                </small>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id || user.userId || index}>
                        <td>
                          <div className="admin-person">
                            <div className="admin-person-avatar">
                              {(user.name || user.fullName || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <strong>
                                {user.name || user.fullName || "Unnamed user"}
                              </strong>
                              <small>{user.employeeId || user.id || "—"}</small>
                            </div>
                          </div>
                        </td>
                        <td>{user.email || "—"}</td>
                        <td>{user.department || "—"}</td>
                        <td>{user.role || "—"}</td>
                        <td>
                          <span
                            className={`admin-status ${
                              user.isActive === false ||
                              user.active === false
                                ? "rejected"
                                : "approved"
                            }`}
                          >
                            {user.isActive === false || user.active === false
                              ? "INACTIVE"
                              : "ACTIVE"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="admin-action"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "Budgets" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>Organization Budgets</h2>
                <p>View allocated and used budget information.</p>
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">Loading budgets...</div>
            ) : budgets.length === 0 ? (
              <div className="admin-empty">
                <Wallet size={32} />
                <p>No budgets found.</p>
              </div>
            ) : (
              <div className="admin-budget-grid">
                {budgets.map((budget, index) => {
                  const allocated = Number(
                    budget.allocated ??
                      budget.totalBudget ??
                      budget.total_budget ??
                      budget.amount ??
                      0
                  );
                  const spent = Number(
                    budget.spent ?? budget.used ?? budget.committed ?? 0
                  );
                  const percentage =
                    allocated > 0
                      ? Math.min((spent / allocated) * 100, 100)
                      : 0;

                  return (
                    <div
                      className="admin-budget-card"
                      key={budget.id || index}
                    >
                      <h3>
                        {budget.department ||
                          budget.departmentName ||
                          budget.name ||
                          `Budget ${index + 1}`}
                      </h3>
                      <p>
                        {budget.fiscalYear ||
                          budget.fiscal_year ||
                          "Current fiscal year"}
                      </p>
                      <strong>{formatCurrency(allocated)}</strong>
                      <div className="admin-progress">
                        <span style={{ width: `${percentage}%` }} />
                      </div>
                      <p style={{ marginTop: 10, marginBottom: 0 }}>
                        Used: {formatCurrency(spent)} ({percentage.toFixed(0)}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {selectedRequest && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedRequest(null)}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>Procurement Request Details</h2>
              <button
                className="admin-close"
                onClick={() => setSelectedRequest(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="admin-details">
              <div className="admin-detail">
                <small>Employee</small>
                <strong>{getEmployee(selectedRequest)}</strong>
              </div>
              <div className="admin-detail">
                <small>Product</small>
                <strong>{getProduct(selectedRequest)}</strong>
              </div>
              <div className="admin-detail">
                <small>Supplier</small>
                <strong>
                  {selectedRequest.supplier ||
                    selectedRequest.supplierName ||
                    "—"}
                </strong>
              </div>
              <div className="admin-detail">
                <small>Department</small>
                <strong>
                  {selectedRequest.department ||
                    selectedRequest.departmentName ||
                    "—"}
                </strong>
              </div>
              <div className="admin-detail">
                <small>Quantity</small>
                <strong>{selectedRequest.quantity ?? "—"}</strong>
              </div>
              <div className="admin-detail">
                <small>Total Amount</small>
                <strong>{formatCurrency(getAmount(selectedRequest))}</strong>
              </div>
              <div className="admin-detail">
                <small>Status</small>
                <strong>{getStatus(selectedRequest).replaceAll("_", " ")}</strong>
              </div>
              <div className="admin-detail">
                <small>Submitted Date</small>
                <strong>
                  {formatDate(
                    selectedRequest.createdAt ||
                      selectedRequest.created_at
                  )}
                </strong>
              </div>
            </div>

            <div className="admin-detail" style={{ marginTop: 12 }}>
              <small>Justification</small>
              <strong>
                {selectedRequest.justification ||
                  selectedRequest.description ||
                  selectedRequest.reason ||
                  "No description provided."}
              </strong>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedUser(null)}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>User Details</h2>
              <button
                className="admin-close"
                onClick={() => setSelectedUser(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="admin-details">
              <div className="admin-detail">
                <small>Name</small>
                <strong>
                  {selectedUser.name || selectedUser.fullName || "—"}
                </strong>
              </div>
              <div className="admin-detail">
                <small>Email</small>
                <strong>{selectedUser.email || "—"}</strong>
              </div>
              <div className="admin-detail">
                <small>Role</small>
                <strong>{selectedUser.role || "—"}</strong>
              </div>
              <div className="admin-detail">
                <small>Department</small>
                <strong>{selectedUser.department || "—"}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
