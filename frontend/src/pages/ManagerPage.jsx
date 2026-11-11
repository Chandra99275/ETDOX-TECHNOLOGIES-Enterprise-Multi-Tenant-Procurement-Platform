
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  Eye,
  Check,
  Ban,
  RefreshCw,
  User,
  Building2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Backend is mounted at /api/v1.
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

const getToken = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("accessToken") ||
  sessionStorage.getItem("authToken") ||
  sessionStorage.getItem("token") ||
  "";

const getArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.requests)) return response.data.requests;

  return [];
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
};

const getStatus = (request) =>
  String(
    request.status ||
      request.requestStatus ||
      request.request_status ||
      "PENDING_MANAGER"
  )
    .toUpperCase()
    .replaceAll(" ", "_");

const getEmployee = (request) => {
  const employee = request.employee || request.requester || request.user || {};

  const nestedName = [
    employee.firstName || employee.first_name,
    employee.lastName || employee.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    request.employeeName ||
    request.employee_name ||
    employee.name ||
    employee.fullName ||
    employee.full_name ||
    nestedName ||
    request.createdByName ||
    request.created_by_name ||
    "Employee"
  );
};

const getProduct = (request) =>
  request.productName ||
  request.product_name ||
  request.title ||
  request.itemName ||
  request.item_name ||
  "Product request";

const getAmount = (request) => {
  const amount =
    request.totalAmount ??
    request.total_amount ??
    request.amount ??
    Number(request.quantity || 0) *
      Number(request.unitPrice || request.unit_price || 0);

  return Number(amount || 0);
};

const getRequestId = (request) =>
  request.id || request.requestId || request.request_id;

const getSupplier = (request) =>
  request.supplier ||
  request.supplierName ||
  request.supplier_name ||
  "—";

const getDepartment = (request) =>
  request.department ||
  request.departmentName ||
  request.department_name ||
  request.department?.name ||
  "—";

const getRequestDate = (request) =>
  request.createdAt ||
  request.created_at ||
  request.submittedAt ||
  request.submitted_at;

const MANAGER_PENDING_STATUSES = [
  "PENDING_MANAGER",
  "SUBMITTED",
  "MANAGER_PENDING",
];

const FINANCE_PENDING_STATUSES = [
  "MANAGER_APPROVED",
  "PENDING_FINANCE",
];

const APPROVED_STATUSES = [
  "MANAGER_APPROVED",
  "FINANCE_APPROVED",
  "APPROVED",
  "COMPLETED",
];

const REJECTED_STATUSES = [
  "MANAGER_REJECTED",
  "FINANCE_REJECTED",
  "REJECTED",
];

export default function ManagerPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [managerName, setManagerName] = useState("Manager");

  // API helper.
  // The token is retrieved for every request so updated login sessions are used.
  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          data.details ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  }, []);

  // Load procurement requests and manager profile.
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [requestResult, userResult] = await Promise.all([
        apiRequest("/procurement/requests"),
        apiRequest("/auth/me").catch(() => null),
      ]);

      // Controller returns:
      // { success, message, data: requests, requests, pagination }
      const requestList = getArray(requestResult, [
        "requests",
        "items",
        "results",
      ]);

      setRequests(requestList);

      const user =
        userResult?.user ||
        userResult?.data?.user ||
        userResult?.data ||
        userResult;

      if (user && typeof user === "object") {
        const fullName =
          user.name ||
          user.fullName ||
          user.full_name ||
          [user.firstName || user.first_name, user.lastName || user.last_name]
            .filter(Boolean)
            .join(" ");

        if (fullName) {
          setManagerName(fullName);
        }
      }
    } catch (err) {
      const message = err.message || "Unable to load manager dashboard.";

      setError(message);

      if (
        message.toLowerCase().includes("session expired") ||
        message.toLowerCase().includes("log in again")
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");

        sessionStorage.removeItem("token");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("authToken");

        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [apiRequest, navigate]);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    loadDashboard();
  }, [loadDashboard, navigate]);

  // Requests awaiting manager approval.
  const managerPending = useMemo(
    () =>
      requests.filter((request) =>
        MANAGER_PENDING_STATUSES.includes(getStatus(request))
      ),
    [requests]
  );

  // Requests approved by manager and awaiting finance.
  const financePending = useMemo(
    () =>
      requests.filter((request) =>
        FINANCE_PENDING_STATUSES.includes(getStatus(request))
      ),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter((request) =>
        APPROVED_STATUSES.includes(getStatus(request))
      ),
    [requests]
  );

  const rejectedRequests = useMemo(
    () =>
      requests.filter((request) =>
        REJECTED_STATUSES.includes(getStatus(request))
      ),
    [requests]
  );

  // Search and status filters.
  const filteredRequests = useMemo(() => {
    let list = requests;

    if (activeTab === "Pending Requests") {
      list = managerPending;
    } else if (activeTab === "Approval History") {
      list = requests.filter((request) =>
        [
          ...APPROVED_STATUSES,
          ...REJECTED_STATUSES,
        ].includes(getStatus(request))
      );
    }

    if (statusFilter !== "ALL") {
      list = list.filter(
        (request) => getStatus(request) === statusFilter
      );
    }

    const query = search.toLowerCase().trim();

    if (query) {
      list = list.filter((request) => {
        const searchableText = [
          getEmployee(request),
          getProduct(request),
          getSupplier(request),
          getDepartment(request),
          getRequestId(request),
          request.employeeEmail,
          request.employee_email,
          request.requester?.email,
          request.description,
          request.justification,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    return list;
  }, [requests, activeTab, statusFilter, search, managerPending]);

  // Open approval/rejection modal.
  const openDecision = (request, action) => {
    setSelectedRequest(request);
    setDecision(action);
    setReason("");
    setError("");
    setSuccess("");
  };

  // Submit manager decision.
  const submitDecision = async () => {
    if (!selectedRequest || !decision || submitting) return;

    if (decision === "reject" && !reason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    const id = getRequestId(selectedRequest);

    if (!id) {
      setError("Request ID is missing.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const approved = decision === "approve";

      // IMPORTANT:
      // Your procurement.controller.js reads only:
      // req.body.decision
      // req.body.comment
      //
      // Do not send status or reason as separate fields.
      await apiRequest(
        `/procurement/requests/${encodeURIComponent(
          id
        )}/manager-decision`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision: approved ? "approve" : "reject",
            comment: reason.trim(),
          }),
        }
      );

      setSelectedRequest(null);
      setDecision("");
      setReason("");

      setSuccess(
        approved
          ? "Request approved and forwarded to Finance."
          : "Request rejected successfully."
      );

      await loadDashboard();
    } catch (err) {
      setError(err.message || "Unable to submit manager decision.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;

    setSelectedRequest(null);
    setDecision("");
    setReason("");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");

    navigate("/login");
  };

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Pending Requests", icon: ClipboardList },
    { name: "Approval History", icon: CheckCircle2 },
  ];

  const statusStyle = (status) => {
    if (APPROVED_STATUSES.includes(status)) return "approved";

    if (REJECTED_STATUSES.includes(status)) return "rejected";

    if (FINANCE_PENDING_STATUSES.includes(status)) return "finance";

    return "pending";
  };

  const isManagerPending = (request) =>
    MANAGER_PENDING_STATUSES.includes(getStatus(request));

  return (
    <div className="manager-app">
      <style>{`
        * { box-sizing: border-box; }

        .manager-app {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }

        .manager-sidebar {
          width: 250px;
          background: #111c35;
          color: white;
          padding: 25px 16px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .manager-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px 30px;
          font-size: 21px;
          font-weight: 800;
        }

        .manager-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #3675f5;
        }

        .manager-nav-label {
          color: #8492ae;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          padding: 10px 12px;
        }

        .manager-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          border: 0;
          border-radius: 9px;
          padding: 13px 12px;
          margin: 3px 0;
          background: transparent;
          color: #aebbd2;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }

        .manager-nav.active,
        .manager-nav:hover {
          background: #263b65;
          color: white;
        }

        .manager-sidebar-bottom {
          margin-top: auto;
          border-top: 1px solid #2b3955;
          padding-top: 16px;
        }

        .manager-main {
          min-width: 0;
          flex: 1;
          padding: 28px 34px;
        }

        .manager-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 28px;
        }

        .manager-heading h1 {
          margin: 0 0 7px;
          font-size: 25px;
          color: #172033;
        }

        .manager-heading p {
          margin: 0;
          color: #8490a4;
          font-size: 13px;
        }

        .manager-top-actions {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .manager-icon-btn {
          border: 1px solid #e5e9f1;
          background: white;
          border-radius: 10px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #59677e;
        }

        .manager-icon-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .manager-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #e7ebf2;
          padding: 7px 12px;
          border-radius: 11px;
        }

        .manager-avatar {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: white;
          background: #3675f5;
          font-weight: 700;
        }

        .manager-profile strong {
          display: block;
          font-size: 12px;
        }

        .manager-profile small {
          color: #8a96a8;
          font-size: 10px;
        }

        .manager-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 25px;
        }

        .manager-stat {
          background: white;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          padding: 19px;
        }

        .manager-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #7d899c;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
        }

        .manager-stat-icon {
          width: 37px;
          height: 37px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #edf3ff;
          color: #3675f5;
          flex-shrink: 0;
        }

        .manager-stat h2 {
          margin: 13px 0 5px;
          font-size: 25px;
        }

        .manager-stat small {
          color: #929daf;
          font-size: 11px;
        }

        .manager-panel {
          background: white;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          overflow: hidden;
        }

        .manager-panel-head {
          padding: 19px 21px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom: 1px solid #edf0f5;
        }

        .manager-panel-head h2 {
          margin: 0 0 5px;
          font-size: 16px;
        }

        .manager-panel-head p {
          margin: 0;
          color: #929daf;
          font-size: 11px;
        }

        .manager-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .manager-search {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          padding: 0 10px;
          background: white;
        }

        .manager-search input {
          width: 180px;
          border: 0;
          outline: 0;
          padding: 10px 0;
          font-size: 12px;
        }

        .manager-select {
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          padding: 9px 11px;
          background: white;
          color: #526078;
          font-size: 12px;
          outline: 0;
        }

        .manager-table-wrap {
          overflow-x: auto;
        }

        .manager-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        .manager-table th {
          padding: 13px 16px;
          text-align: left;
          color: #8b96a8;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .6px;
          background: #fafbfd;
          border-bottom: 1px solid #edf0f5;
        }

        .manager-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #f0f2f6;
          font-size: 12px;
          color: #536078;
        }

        .manager-table tr:last-child td {
          border-bottom: 0;
        }

        .manager-person {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .manager-person-avatar {
          width: 31px;
          height: 31px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: #edf3ff;
          color: #3675f5;
          font-weight: 700;
          flex-shrink: 0;
        }

        .manager-person strong,
        .manager-product strong {
          display: block;
          color: #27344a;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .manager-person small,
        .manager-product small {
          display: block;
          color: #9aa4b4;
          font-size: 10px;
        }

        .manager-status {
          display: inline-block;
          border-radius: 20px;
          padding: 6px 9px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .manager-status.pending {
          background: #fff5df;
          color: #b77a13;
        }

        .manager-status.approved {
          background: #e6f8ef;
          color: #16844e;
        }

        .manager-status.rejected {
          background: #ffe9e9;
          color: #cf4444;
        }

        .manager-status.finance {
          background: #e9efff;
          color: #456bd3;
        }

        .manager-actions {
          display: flex;
          gap: 6px;
        }

        .manager-action {
          border: 1px solid #e5e9f1;
          background: white;
          color: #64728a;
          border-radius: 7px;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .manager-action.approve {
          color: #16844e;
        }

        .manager-action.reject {
          color: #cf4444;
        }

        .manager-action:hover {
          background: #f5f7fb;
        }

        .manager-action:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .manager-empty,
        .manager-loading {
          padding: 55px 20px;
          text-align: center;
          color: #8995a8;
          font-size: 13px;
        }

        .manager-empty svg {
          margin-bottom: 10px;
        }

        .manager-alert {
          padding: 12px 15px;
          border-radius: 9px;
          margin-bottom: 17px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .manager-alert.error {
          color: #b52c35;
          background: #fff0f0;
        }

        .manager-alert.success {
          color: #13764a;
          background: #e9f8f0;
        }

        .manager-btn {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .manager-btn.primary {
          background: #3675f5;
          color: white;
        }

        .manager-btn.green {
          background: #16844e;
          color: white;
        }

        .manager-btn.red {
          background: #d94a4a;
          color: white;
        }

        .manager-btn.light {
          background: #f0f3f8;
          color: #59677e;
        }

        .manager-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .manager-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(13, 24, 44, .55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 100;
        }

        .manager-modal {
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 15px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
        }

        .manager-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .manager-modal-head h2 {
          margin: 0;
          font-size: 18px;
        }

        .manager-close {
          border: 0;
          background: #f1f3f7;
          width: 31px;
          height: 31px;
          border-radius: 8px;
          cursor: pointer;
        }

        .manager-close:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .manager-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        .manager-detail {
          padding: 12px;
          border: 1px solid #edf0f5;
          border-radius: 9px;
          min-width: 0;
        }

        .manager-detail small {
          display: block;
          color: #929daf;
          font-size: 10px;
          margin-bottom: 6px;
        }

        .manager-detail strong {
          font-size: 12px;
          color: #27344a;
          overflow-wrap: anywhere;
        }

        .manager-reason {
          width: 100%;
          min-height: 90px;
          resize: vertical;
          border: 1px solid #e1e6ef;
          border-radius: 9px;
          padding: 12px;
          font: inherit;
          font-size: 12px;
          outline: 0;
        }

        .manager-reason:focus {
          border-color: #3675f5;
        }

        .manager-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 18px;
          flex-wrap: wrap;
        }

        .manager-mobile-menu {
          display: none;
        }

        @media(max-width: 1050px) {
          .manager-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .manager-main {
            padding: 22px;
          }
        }

        @media(max-width: 700px) {
          .manager-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 80;
            transform: translateX(-100%);
            transition: transform .2s ease;
          }

          .manager-sidebar.open {
            transform: translateX(0);
          }

          .manager-main {
            padding: 18px 13px;
          }

          .manager-mobile-menu {
            display: grid;
          }

          .manager-heading h1 {
            font-size: 20px;
          }

          .manager-profile {
            display: none;
          }

          .manager-stats {
            gap: 9px;
          }

          .manager-stat {
            padding: 13px;
          }

          .manager-stat h2 {
            font-size: 21px;
          }

          .manager-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .manager-search input {
            width: 130px;
          }

          .manager-details {
            grid-template-columns: 1fr;
          }

          .manager-topbar {
            align-items: flex-start;
          }

          .manager-top-actions {
            gap: 7px;
          }
        }
      `}</style>

      {/* Sidebar */}
      <aside className={`manager-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="manager-brand">
          <div className="manager-brand-icon">
            <Building2 size={21} />
          </div>
          ETDOX
        </div>

        <div className="manager-nav-label">WORKSPACE</div>

        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={`manager-nav ${
                activeTab === item.name ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(item.name);
                setStatusFilter("ALL");
                setSidebarOpen(false);
              }}
            >
              <Icon size={17} />

              {item.name}

              {item.name === "Pending Requests" &&
                managerPending.length > 0 && (
                  <span style={{ marginLeft: "auto" }}>
                    {managerPending.length}
                  </span>
                )}
            </button>
          );
        })}

        <div className="manager-sidebar-bottom">
          <button className="manager-nav" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main dashboard */}
      <main className="manager-main">
        <header className="manager-topbar">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              className="manager-icon-btn manager-mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="manager-heading">
              <h1>
                {activeTab === "Overview"
                  ? "Manager Dashboard"
                  : activeTab}
              </h1>

              <p>
                Review employee procurement requests and make decisions.
              </p>
            </div>
          </div>

          <div className="manager-top-actions">
            <button
              className="manager-icon-btn"
              title="Refresh"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "manager-spin" : ""}
              />
            </button>

            <button
              className="manager-icon-btn"
              title="Notifications"
              type="button"
            >
              <Bell size={17} />
            </button>

            <div className="manager-profile">
              <div className="manager-avatar">
                {managerName.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{managerName}</strong>
                <small>Manager</small>
              </div>

              <ChevronDown size={14} color="#8490a4" />
            </div>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div className="manager-alert error">
            <AlertCircle size={16} />

            <span>{error}</span>

            <button
              onClick={() => setError("")}
              style={{
                marginLeft: "auto",
                border: 0,
                background: "none",
                cursor: "pointer",
              }}
              aria-label="Close error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="manager-alert success">
            <CheckCircle2 size={16} />

            <span>{success}</span>

            <button
              onClick={() => setSuccess("")}
              style={{
                marginLeft: "auto",
                border: 0,
                background: "none",
                cursor: "pointer",
              }}
              aria-label="Close success message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Overview statistics */}
        {activeTab === "Overview" && (
          <section className="manager-stats">
            <div className="manager-stat">
              <div className="manager-stat-top">
                Pending My Approval

                <span className="manager-stat-icon">
                  <Clock size={18} />
                </span>
              </div>

              <h2>{managerPending.length}</h2>

              <small>Requests awaiting manager review</small>
            </div>

            <div className="manager-stat">
              <div className="manager-stat-top">
                Forwarded to Finance

                <span className="manager-stat-icon">
                  <CheckCircle2 size={18} />
                </span>
              </div>

              <h2>{financePending.length}</h2>

              <small>Approved by manager</small>
            </div>

            <div className="manager-stat">
              <div className="manager-stat-top">
                Approved Requests

                <span className="manager-stat-icon">
                  <ClipboardList size={18} />
                </span>
              </div>

              <h2>{approvedRequests.length}</h2>

              <small>Manager-approved or completed</small>
            </div>

            <div className="manager-stat">
              <div className="manager-stat-top">
                Rejected Requests

                <span className="manager-stat-icon">
                  <XCircle size={18} />
                </span>
              </div>

              <h2>{rejectedRequests.length}</h2>

              <small>Requests rejected</small>
            </div>
          </section>
        )}

        {/* Procurement request table */}
        <section className="manager-panel">
          <div className="manager-panel-head">
            <div>
              <h2>
                {activeTab === "Overview"
                  ? "Employee Procurement Requests"
                  : activeTab}
              </h2>

              <p>
                {activeTab === "Pending Requests"
                  ? "Review requests that require your approval."
                  : activeTab === "Approval History"
                  ? "Previously reviewed procurement requests."
                  : "Requests submitted by employees in your organization."}
              </p>
            </div>

            <div className="manager-controls">
              <div className="manager-search">
                <Search size={15} color="#8d98aa" />

                <input
                  placeholder="Search requests..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <select
                className="manager-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING_MANAGER">Pending Manager</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="MANAGER_PENDING">Manager Pending</option>
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
            <div className="manager-loading">
              <RefreshCw size={22} />
              <p>Loading procurement requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="manager-empty">
              <ClipboardList size={35} />

              <p>No procurement requests found.</p>

              <small>
                Employee requests will appear here when they are successfully
                submitted.
              </small>
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Product</th>
                    <th>Supplier</th>
                    <th>Department</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request, index) => {
                    const status = getStatus(request);
                    const isPending = isManagerPending(request);

                    return (
                      <tr key={getRequestId(request) || index}>
                        <td>
                          <div className="manager-person">
                            <div className="manager-person-avatar">
                              {getEmployee(request)
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>{getEmployee(request)}</strong>

                              <small>
                                {request.employeeId ||
                                  request.employee_id ||
                                  request.employee?.employeeId ||
                                  request.requester?.email ||
                                  request.employeeEmail ||
                                  request.employee_email ||
                                  "Employee"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="manager-product">
                            <strong>{getProduct(request)}</strong>

                            <small>
                              Qty: {request.quantity ?? "—"}
                            </small>
                          </div>
                        </td>

                        <td>{getSupplier(request)}</td>

                        <td>{getDepartment(request)}</td>

                        <td>
                          <strong style={{ color: "#27344a" }}>
                            {formatCurrency(getAmount(request))}
                          </strong>
                        </td>

                        <td>{formatDate(getRequestDate(request))}</td>

                        <td>
                          <span
                            className={`manager-status ${statusStyle(
                              status
                            )}`}
                          >
                            {status.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td>
                          <div className="manager-actions">
                            <button
                              className="manager-action"
                              title="View details"
                              onClick={() => {
                                setSelectedRequest(request);
                                setDecision("");
                                setReason("");
                                setError("");
                              }}
                            >
                              <Eye size={15} />
                            </button>

                            {isPending && (
                              <>
                                <button
                                  className="manager-action approve"
                                  title="Approve request"
                                  onClick={() =>
                                    openDecision(request, "approve")
                                  }
                                >
                                  <Check size={15} />
                                </button>

                                <button
                                  className="manager-action reject"
                                  title="Reject request"
                                  onClick={() =>
                                    openDecision(request, "reject")
                                  }
                                >
                                  <Ban size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Request details and decision modal */}
      {selectedRequest && (
        <div
          className="manager-modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="manager-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manager-modal-head">
              <h2>
                {decision
                  ? decision === "approve"
                    ? "Approve Request"
                    : "Reject Request"
                  : "Request Details"}
              </h2>

              <button
                className="manager-close"
                disabled={submitting}
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={17} />
              </button>
            </div>

            <div className="manager-details">
              <div className="manager-detail">
                <small>Employee</small>
                <strong>{getEmployee(selectedRequest)}</strong>
              </div>

              <div className="manager-detail">
                <small>Product</small>
                <strong>{getProduct(selectedRequest)}</strong>
              </div>

              <div className="manager-detail">
                <small>Supplier</small>
                <strong>{getSupplier(selectedRequest)}</strong>
              </div>

              <div className="manager-detail">
                <small>Department</small>
                <strong>{getDepartment(selectedRequest)}</strong>
              </div>

              <div className="manager-detail">
                <small>Quantity</small>
                <strong>{selectedRequest.quantity ?? "—"}</strong>
              </div>

              <div className="manager-detail">
                <small>Unit Price</small>
                <strong>
                  {formatCurrency(
                    selectedRequest.unitPrice ??
                      selectedRequest.unit_price
                  )}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Total Amount</small>
                <strong>
                  {formatCurrency(getAmount(selectedRequest))}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Submitted Date</small>
                <strong>
                  {formatDate(getRequestDate(selectedRequest))}
                </strong>
              </div>
            </div>

            <div
              className="manager-detail"
              style={{ marginTop: 13 }}
            >
              <small>Justification / Description</small>

              <strong>
                {selectedRequest.justification ||
                  selectedRequest.description ||
                  selectedRequest.reason ||
                  "No description provided."}
              </strong>
            </div>

            {decision && (
              <div style={{ marginTop: 17 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {decision === "reject"
                    ? "Rejection reason (required)"
                    : "Approval note (optional)"}
                </label>

                <textarea
                  className="manager-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    decision === "reject"
                      ? "Enter why this request is being rejected..."
                      : "Add an optional note for Finance..."
                  }
                  disabled={submitting}
                />
              </div>
            )}

            <div className="manager-modal-actions">
              <button
                className="manager-btn light"
                disabled={submitting}
                onClick={closeModal}
              >
                Close
              </button>

              {decision && (
                <button
                  className={`manager-btn ${
                    decision === "approve" ? "green" : "red"
                  }`}
                  disabled={
                    submitting ||
                    (decision === "reject" && !reason.trim())
                  }
                  onClick={submitDecision}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} />
                      Processing...
                    </>
                  ) : decision === "approve" ? (
                    <>
                      <Check size={14} />
                      Approve & Forward to Finance
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      Reject Request
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
