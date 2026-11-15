
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LayoutDashboard, ClipboardList, CheckCircle2, XCircle, Clock,
  Search, Bell, LogOut, Menu, X, Eye, Check, Ban, RefreshCw,
  Building2, AlertCircle, ChevronDown, Download, Filter,
  BarChart3, FileCheck2, TrendingUp, Wallet,
  CalendarDays, ShieldCheck, ArrowUpRight,
  CircleDollarSign, Activity, SlidersHorizontal
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./ManagerPage.css";

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

const createRequestId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `manager-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.tasks)) return response.tasks;
  if (Array.isArray(response?.requests)) return response.requests;

  return [];
};

const formatCurrency = (value, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `₹${Number(value || 0).toLocaleString("en-IN")}`;
  }
};

const formatCompactCurrency = (value) => {
  const amount = Number(value || 0);

  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;

  return formatCurrency(amount);
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const getStatus = (request) =>
  String(
    request?.status ||
    request?.requestStatus ||
    request?.request_status ||
    "PENDING_MANAGER"
  ).toUpperCase().replaceAll(" ", "_");

const getEmployee = (request) => {
  const employee =
    request?.employee ||
    request?.requester ||
    request?.user ||
    {};

  const nestedName = [
    employee.firstName || employee.first_name,
    employee.lastName || employee.last_name,
  ].filter(Boolean).join(" ");

  return (
    request?.employeeName ||
    request?.employee_name ||
    employee.name ||
    employee.fullName ||
    employee.full_name ||
    nestedName ||
    request?.createdByName ||
    request?.created_by_name ||
    "Employee"
  );
};

const getProduct = (request) =>
  request?.productName ||
  request?.product_name ||
  request?.title ||
  request?.itemName ||
  request?.item_name ||
  "Product request";

const getAmount = (request) => {
  const directAmount =
    request?.totalAmount ??
    request?.total_amount ??
    request?.amount;

  if (directAmount !== undefined && directAmount !== null) {
    return Number(directAmount) || 0;
  }

  return (
    Number(request?.quantity || 0) *
    Number(request?.unitPrice || request?.unit_price || 0)
  );
};

const getRequestId = (request) =>
  request?.id ||
  request?.requestId ||
  request?.request_id ||
  request?.purchase_request_id;

const getTaskId = (task) =>
  task?.id ||
  task?.task_id ||
  task?.taskId ||
  task?.workflow_task_id;

const getTaskResourceId = (task) =>
  task?.resource_id ||
  task?.resourceId ||
  task?.purchase_request_id ||
  task?.purchaseRequestId;

const getTaskStatus = (task) =>
  String(task?.status || task?.task_status || "")
    .toUpperCase()
    .replaceAll(" ", "_");

const isActiveTask = (task) =>
  ["PENDING", "OPEN", "ASSIGNED", "IN_PROGRESS"].includes(
    getTaskStatus(task)
  );

const isPurchaseRequestTask = (task) => {
  const type = String(
    task?.resource_type ||
    task?.resourceType ||
    ""
  ).toLowerCase().replaceAll("-", "_");

  return (
    !type ||
    [
      "purchase_request",
      "purchase_requests",
      "procurement_request",
      "procurement_requests",
      "purchaserequest",
    ].includes(type)
  );
};

const getSupplier = (request) =>
  request?.supplierName ||
  request?.supplier_name ||
  (typeof request?.supplier === "object"
    ? request?.supplier?.name
    : request?.supplier) ||
  "—";

const getDepartment = (request) => {
  const department = request?.department;

  if (department && typeof department === "object") {
    return department.name || "—";
  }

  return (
    department ||
    request?.departmentName ||
    request?.department_name ||
    "—"
  );
};

const getRequestDate = (request) =>
  request?.createdAt ||
  request?.created_at ||
  request?.submittedAt ||
  request?.submitted_at;

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

const STATUS_OPTIONS = [
  "PENDING_MANAGER",
  "SUBMITTED",
  "MANAGER_PENDING",
  "IN_APPROVAL",
  "MANAGER_APPROVED",
  "MANAGER_REJECTED",
  "PENDING_FINANCE",
  "FINANCE_APPROVED",
  "FINANCE_REJECTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
];

const NAV_ITEMS = [
  { name: "Overview", icon: LayoutDashboard, section: "WORKSPACE" },
  { name: "All Requests", icon: ClipboardList, section: "WORKSPACE" },
  { name: "Pending Approvals", icon: Clock, section: "WORKSPACE" },
  { name: "Approval History", icon: FileCheck2, section: "WORKSPACE" },
  { name: "Analytics", icon: BarChart3, section: "INSIGHTS" },
];

export default function ManagerPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);

  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [managerName, setManagerName] = useState("Manager");
  const [showFilters, setShowFilters] = useState(false);

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const token = getToken();
    const requestId = createRequestId();

    if (!token) {
      const authError = new Error(
        "Your session has expired. Please log in again."
      );
      authError.status = 401;
      throw authError;
    }

    let response;

    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Request-ID": requestId,
          ...options.headers,
        },
      });
    } catch (networkError) {
      const err = new Error(
        `Cannot connect to ETDOX backend. ${networkError.message}`
      );
      err.endpoint = endpoint;
      throw err;
    }

    const responseText = await response.text();

    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { rawResponse: responseText };
    }

    if (!response.ok) {
      const err = new Error(
        data.message ||
        data.error ||
        data.details ||
        data.rawResponse ||
        `Request failed with status ${response.status}`
      );

      err.status = response.status;
      err.endpoint = endpoint;
      err.requestId = requestId;
      err.serverRequestId =
        response.headers.get("x-request-id") ||
        data.requestId ||
        data.request_id ||
        null;
      err.response = data;

      if (response.status === 401) {
        err.message = "Session expired. Please log in again.";
      }

      if (response.status === 403) {
        err.message =
          data.message ||
          "Access denied. Your account needs the required manager approval permissions.";
      }

      throw err;
    }

    return data;
  }, []);

  const logout = useCallback(() => {
    [
      "token",
      "accessToken",
      "authToken",
      "user",
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    navigate("/login");
  }, [navigate]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/procurement/requests"),
        apiRequest("/workflows/tasks/pending?limit=100&offset=0"),
        apiRequest("/auth/me"),
      ]);

      const [requestResult, taskResult, userResult] = results;

      if (requestResult.status === "fulfilled") {
        const loadedRequests = getArray(
          requestResult.value,
          ["requests", "items", "results"]
        );

        setRequests(loadedRequests);
      } else {
        setRequests([]);

        setError(
          `Unable to load procurement requests: ${
            requestResult.reason?.message || "Unknown error"
          }`
        );

        if (requestResult.reason?.status === 401) {
          logout();
        }
      }

      if (taskResult.status === "fulfilled") {
        const tasks = getArray(
          taskResult.value,
          ["tasks", "items", "results", "pendingTasks"]
        );

        const activeTasks = tasks.filter((task) =>
          isActiveTask(task) &&
          isPurchaseRequestTask(task) &&
          Boolean(getTaskId(task)) &&
          Boolean(getTaskResourceId(task))
        );

        setPendingTasks(activeTasks);
      } else {
        setPendingTasks([]);

        setError((old) =>
          [
            old,
            `Unable to load approval tasks: ${
              taskResult.reason?.message || "Unknown error"
            }`,
          ].filter(Boolean).join(" | ")
        );

        if (taskResult.reason?.status === 401) {
          logout();
        }
      }

      if (userResult.status === "fulfilled") {
        const response = userResult.value;

        const user =
          response?.user ||
          response?.data?.user ||
          response?.data ||
          response;

        const name =
          user?.name ||
          user?.fullName ||
          user?.full_name ||
          [
            user?.firstName || user?.first_name,
            user?.lastName || user?.last_name,
          ].filter(Boolean).join(" ");

        if (name) {
          setManagerName(name);
        }
      } else if (userResult.reason?.status === 401) {
        logout();
      }
    } catch (err) {
      setError(err.message || "Unable to load manager dashboard.");

      if (
        err.status === 401 ||
        /session expired|log in again/i.test(err.message)
      ) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [apiRequest, logout]);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    loadDashboard();
  }, [loadDashboard, navigate]);

  const managerPending = useMemo(() => {
    const requestMap = new Map(
      requests
        .filter((request) => getRequestId(request))
        .map((request) => [
          String(getRequestId(request)),
          request,
        ])
    );

    return pendingTasks.map((task) => {
      const resourceId = String(getTaskResourceId(task));
      const workflowTaskId = getTaskId(task);
      const existing = requestMap.get(resourceId);

      return {
        ...(existing || {}),
        id: existing
          ? getRequestId(existing)
          : resourceId,
        request_number:
          existing?.request_number ||
          task.request_number ||
          task.resource_number,
        total_amount:
          existing?.total_amount ??
          task.total_amount ??
          task.amount,
        currency:
          existing?.currency ||
          task.currency ||
          "INR",
        requester_id:
          existing?.requester_id ||
          task.requester_id,
        status:
          existing?.status ||
          "IN_APPROVAL",
        workflowTaskId,
        workflowTask: task,
      };
    });
  }, [requests, pendingTasks]);

  const requestsWithTasks = useMemo(() => {
    const taskMap = new Map(
      pendingTasks.map((task) => [
        String(getTaskResourceId(task)),
        task,
      ])
    );

    const enriched = requests.map((request) => {
      const task = taskMap.get(
        String(getRequestId(request))
      );

      return task
        ? {
            ...request,
            workflowTaskId: getTaskId(task),
            workflowTask: task,
          }
        : request;
    });

    const existingIds = new Set(
      enriched.map((request) =>
        String(getRequestId(request))
      )
    );

    return [
      ...enriched,
      ...managerPending.filter(
        (request) =>
          !existingIds.has(String(getRequestId(request)))
      ),
    ];
  }, [requests, pendingTasks, managerPending]);

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

  const totalSpend = useMemo(
    () =>
      requests.reduce(
        (sum, request) => sum + getAmount(request),
        0
      ),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    let list = requestsWithTasks;

    if (activeTab === "Pending Approvals") {
      list = managerPending;
    } else if (activeTab === "Approval History") {
      list = requestsWithTasks.filter((request) =>
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
      list = list.filter((request) =>
        [
          getEmployee(request),
          getProduct(request),
          getSupplier(request),
          getDepartment(request),
          getRequestId(request),
          request.request_number,
          request.employeeEmail,
          request.employee_email,
          request.requester?.email,
          request.description,
          request.justification,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "amount-high") {
        return getAmount(b) - getAmount(a);
      }

      if (sortBy === "amount-low") {
        return getAmount(a) - getAmount(b);
      }

      const diff =
        new Date(getRequestDate(b) || 0) -
        new Date(getRequestDate(a) || 0);

      return sortBy === "oldest" ? -diff : diff;
    });
  }, [
    requestsWithTasks,
    activeTab,
    statusFilter,
    search,
    managerPending,
    sortBy,
  ]);

  const openDecision = (request, action) => {
    const taskId =
      request.workflowTaskId ||
      getTaskId(request.workflowTask);

    if (!taskId) {
      setError(
        "No active manager approval task is assigned to this request. Check workflow task assignment and manager permissions."
      );
      return;
    }

    setSelectedRequest({
      ...request,
      workflowTaskId: taskId,
    });

    setDecision(action);
    setReason("");
    setError("");
    setSuccess("");
  };

  const submitDecision = async () => {
    if (!selectedRequest || !decision || submitting) {
      return;
    }

    if (decision === "reject" && !reason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    const taskId = selectedRequest.workflowTaskId;

    if (!taskId) {
      setError(
        "Workflow task ID is missing. Refresh and try again."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const action =
      decision === "approve"
        ? "approve"
        : "reject";

    try {
      await apiRequest(
        `/workflows/tasks/${encodeURIComponent(taskId)}/actions`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            comment: reason.trim(),
          }),
        }
      );

      setSelectedRequest(null);
      setDecision("");
      setReason("");

      setSuccess(
        action === "approve"
          ? "Request approved successfully. The workflow should advance to the next approval stage."
          : "Request rejected successfully."
      );

      await loadDashboard();
    } catch (err) {
      setError(
        `${err.message || "Unable to submit manager decision."}` +
        `${err.status ? ` (HTTP ${err.status})` : ""}` +
        `${
          err.serverRequestId
            ? ` | Server Request ID: ${err.serverRequestId}`
            : ""
        }`
      );
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

  const exportCsv = () => {
    const columns = [
      "Request ID",
      "Employee",
      "Product",
      "Supplier",
      "Department",
      "Amount",
      "Date",
      "Status",
    ];

    const rows = filteredRequests.map((request) => [
      getRequestId(request),
      getEmployee(request),
      getProduct(request),
      getSupplier(request),
      getDepartment(request),
      getAmount(request),
      formatDate(getRequestDate(request)),
      getStatus(request),
    ]);

    const escape = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [columns, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download =
      `etdox-manager-requests-${new Date().toISOString().slice(0, 10)}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  };

  const statusStyle = (status) => {
    if (APPROVED_STATUSES.includes(status)) return "approved";
    if (REJECTED_STATUSES.includes(status)) return "rejected";
    if (FINANCE_PENDING_STATUSES.includes(status)) return "finance";
    return "pending";
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setStatusFilter("ALL");
    setSearch("");
    setSidebarOpen(false);
  };

  const statusBreakdown = useMemo(() => {
    const groups = [
      {
        label: "Awaiting manager",
        value: managerPending.length,
        color: "blue",
      },
      {
        label: "Forwarded to finance",
        value: financePending.length,
        color: "violet",
      },
      {
        label: "Approved / completed",
        value: approvedRequests.length,
        color: "green",
      },
      {
        label: "Rejected",
        value: rejectedRequests.length,
        color: "red",
      },
    ];

    const max = Math.max(
      ...groups.map((item) => item.value),
      1
    );

    return groups.map((item) => ({
      ...item,
      width: `${(item.value / max) * 100}%`,
    }));
  }, [
    managerPending,
    financePending,
    approvedRequests,
    rejectedRequests,
  ]);

  const monthlyActivity = useMemo(() => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      const key =
        `${date.getFullYear()}-${date.getMonth()}`;

      const count = requests.filter((request) => {
        const created = new Date(getRequestDate(request));

        return (
          !Number.isNaN(created.getTime()) &&
          `${created.getFullYear()}-${created.getMonth()}` === key
        );
      }).length;

      months.push({
        label: date.toLocaleDateString("en-IN", {
          month: "short",
        }),
        count,
      });
    }

    const max = Math.max(
      ...months.map((month) => month.count),
      1
    );

    return months.map((month) => ({
      ...month,
      height: Math.max(
        (month.count / max) * 100,
        month.count ? 8 : 3
      ),
    }));
  }, [requests]);

  const pageSubtitle = {
    Overview:
      "Monitor procurement activity and approval performance.",
    "All Requests":
      "View and manage procurement requests across your organization.",
    "Pending Approvals":
      "Review requests waiting for your decision.",
    "Approval History":
      "Track decisions made throughout the approval workflow.",
    Analytics:
      "Understand request volumes, approvals and procurement spend.",
  }[activeTab];

  return (
    <div className="manager-app">
      {sidebarOpen && (
        <button
          className="manager-sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`manager-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="manager-brand">
          <div className="manager-brand-icon">
            <Building2 size={21} />
          </div>
          <span>ETDOX</span>
          <span className="manager-brand-tag">WORKSPACE</span>
        </div>

        <div className="manager-org-card">
          <div className="manager-org-icon">
            <ShieldCheck size={17} />
          </div>
          <div>
            <strong>Organization</strong>
            <small>Procurement workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>

        {["WORKSPACE", "INSIGHTS"].map((section) => (
          <div className="manager-nav-section" key={section}>
            <div className="manager-nav-label">{section}</div>

            {NAV_ITEMS.filter(
              (item) => item.section === section
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;

              return (
                <button
                  key={item.name}
                  className={`manager-nav ${isActive ? "active" : ""}`}
                  onClick={() => handleTabChange(item.name)}
                >
                  <Icon size={17} />
                  <span>{item.name}</span>

                  {item.name === "Pending Approvals" &&
                    managerPending.length > 0 && (
                      <span className="manager-nav-count">
                        {managerPending.length}
                      </span>
                    )}

                  {isActive && (
                    <span className="manager-nav-active-dot" />
                  )}
                </button>
              );
            })}
          </div>
        ))}

        <div className="manager-sidebar-help">
          <div className="manager-help-icon">
            <Activity size={17} />
          </div>

          <strong>Approval workspace</strong>

          <p>
            Keep procurement moving with timely reviews and decisions.
          </p>

          <button onClick={loadDashboard} disabled={loading}>
            <RefreshCw size={13} /> Sync workspace
          </button>
        </div>

        <div className="manager-sidebar-bottom">
          <div className="manager-sidebar-user">
            <div className="manager-avatar">
              {managerName.charAt(0).toUpperCase()}
            </div>

            <div className="manager-sidebar-user-info">
              <strong>{managerName}</strong>
              <small>Manager access</small>
            </div>

            <button
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="manager-main">
        <header className="manager-topbar">
          <div className="manager-heading-wrap">
            <button
              className="manager-icon-btn manager-mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen
                ? <X size={18} />
                : <Menu size={18} />}
            </button>

            <div className="manager-heading">
              <div className="manager-breadcrumb">
                ETDOX <span>/</span> Manager workspace <span>/</span>{" "}
                {activeTab}
              </div>

              <h1>{activeTab}</h1>
              <p>{pageSubtitle}</p>
            </div>
          </div>

          <div className="manager-top-actions">
            <div className="manager-live-indicator">
              <span /> Workspace
            </div>

            <button
              className="manager-icon-btn"
              title="Refresh dashboard"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "manager-spin" : ""}
              />
            </button>

            <button
              className="manager-icon-btn manager-notification-btn"
              title="Notifications"
              type="button"
            >
              <Bell size={17} />

              {managerPending.length > 0 && (
                <span className="manager-notification-dot" />
              )}
            </button>

            <div className="manager-profile">
              <div className="manager-avatar">
                {managerName.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{managerName}</strong>
                <small>Procurement Manager</small>
              </div>

              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        {error && (
          <div className="manager-alert error">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="manager-alert success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
            <button
              onClick={() => setSuccess("")}
              aria-label="Close success"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {activeTab === "Overview" && (
          <>
            <section className="manager-welcome">
              <div>
                <span className="manager-welcome-eyebrow">
                  <Activity size={13} /> PROCUREMENT CONTROL CENTER
                </span>

                <h2>
                  Good to see you, {managerName.split(" ")[0]}.
                </h2>

                <p>
                  Here's what's happening with procurement across your
                  organization.
                </p>
              </div>

              <div className="manager-welcome-date">
                <CalendarDays size={16} />
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </section>

            <section className="manager-stats">
              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Pending my approval</span>
                  <span className="manager-stat-icon blue">
                    <Clock size={18} />
                  </span>
                </div>

                <h2>{managerPending.length}</h2>

                <small>
                  <span className="manager-stat-dot blue-dot" />
                  Requests awaiting review
                </small>

                <button
                  onClick={() =>
                    handleTabChange("Pending Approvals")
                  }
                >
                  Review queue <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Forwarded to finance</span>
                  <span className="manager-stat-icon violet">
                    <Wallet size={18} />
                  </span>
                </div>

                <h2>{financePending.length}</h2>

                <small>
                  <span className="manager-stat-dot violet-dot" />
                  Manager-approved requests
                </small>

                <button
                  onClick={() => {
                    setActiveTab("All Requests");
                    setStatusFilter("MANAGER_APPROVED");
                  }}
                >
                  View requests <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Approved requests</span>
                  <span className="manager-stat-icon green">
                    <CheckCircle2 size={18} />
                  </span>
                </div>

                <h2>{approvedRequests.length}</h2>

                <small>
                  <span className="manager-stat-dot green-dot" />
                  Approved or completed
                </small>

                <button
                  onClick={() =>
                    handleTabChange("Approval History")
                  }
                >
                  View history <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Total request value</span>
                  <span className="manager-stat-icon orange">
                    <CircleDollarSign size={18} />
                  </span>
                </div>

                <h2 className="manager-stat-currency">
                  {formatCompactCurrency(totalSpend)}
                </h2>

                <small>
                  <span className="manager-stat-dot orange-dot" />
                  Across loaded requests
                </small>

                <button
                  onClick={() => handleTabChange("Analytics")}
                >
                  View analytics <ArrowUpRight size={13} />
                </button>
              </div>
            </section>

            <section className="manager-overview-grid">
              <div className="manager-chart-card">
                <div className="manager-card-heading">
                  <div>
                    <span className="manager-card-eyebrow">
                      REQUEST ACTIVITY
                    </span>
                    <h3>Monthly request volume</h3>
                    <p>Requests created over the last six months</p>
                  </div>

                  <span className="manager-card-icon">
                    <TrendingUp size={18} />
                  </span>
                </div>

                <div className="manager-bar-chart">
                  {monthlyActivity.map((month) => (
                    <div
                      className="manager-bar-column"
                      key={month.label}
                    >
                      <strong>{month.count}</strong>

                      <div className="manager-bar-track">
                        <div
                          className="manager-bar-fill"
                          style={{ height: `${month.height}%` }}
                        />
                      </div>

                      <small>{month.label}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="manager-chart-card manager-status-card">
                <div className="manager-card-heading">
                  <div>
                    <span className="manager-card-eyebrow">
                      WORKFLOW OVERVIEW
                    </span>
                    <h3>Request status</h3>
                    <p>Current distribution by workflow stage</p>
                  </div>

                  <span className="manager-card-icon">
                    <BarChart3 size={18} />
                  </span>
                </div>

                <div className="manager-status-list">
                  {statusBreakdown.map((item) => (
                    <div
                      className="manager-status-row"
                      key={item.label}
                    >
                      <div className="manager-status-row-top">
                        <span>
                          <i className={`manager-legend-dot ${item.color}`} />
                          {item.label}
                        </span>
                        <strong>{item.value}</strong>
                      </div>

                      <div className="manager-status-track">
                        <div
                          className={`manager-status-fill ${item.color}`}
                          style={{ width: item.width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === "Analytics" && (
          <>
            <section className="manager-stats">
              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Total requests</span>
                  <span className="manager-stat-icon blue">
                    <ClipboardList size={18} />
                  </span>
                </div>
                <h2>{requests.length}</h2>
                <small>Requests returned by the API</small>
              </div>

              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Approval rate</span>
                  <span className="manager-stat-icon green">
                    <TrendingUp size={18} />
                  </span>
                </div>
                <h2>
                  {requests.length
                    ? `${Math.round(
                        (approvedRequests.length / requests.length) * 100
                      )}%`
                    : "0%"}
                </h2>
                <small>Approved / completed share</small>
              </div>

              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Rejected</span>
                  <span className="manager-stat-icon red">
                    <XCircle size={18} />
                  </span>
                </div>
                <h2>{rejectedRequests.length}</h2>
                <small>Rejected requests</small>
              </div>

              <div className="manager-stat">
                <div className="manager-stat-top">
                  <span>Request value</span>
                  <span className="manager-stat-icon orange">
                    <Wallet size={18} />
                  </span>
                </div>
                <h2 className="manager-stat-currency">
                  {formatCompactCurrency(totalSpend)}
                </h2>
                <small>Total value of loaded requests</small>
              </div>
            </section>

            <section className="manager-overview-grid manager-analytics-grid">
              <div className="manager-chart-card">
                <div className="manager-card-heading">
                  <div>
                    <span className="manager-card-eyebrow">
                      MONTHLY TREND
                    </span>
                    <h3>Request volume</h3>
                    <p>Six-month request creation trend</p>
                  </div>

                  <span className="manager-card-icon">
                    <TrendingUp size={18} />
                  </span>
                </div>

                <div className="manager-bar-chart manager-large-chart">
                  {monthlyActivity.map((month) => (
                    <div
                      className="manager-bar-column"
                      key={month.label}
                    >
                      <strong>{month.count}</strong>

                      <div className="manager-bar-track">
                        <div
                          className="manager-bar-fill"
                          style={{ height: `${month.height}%` }}
                        />
                      </div>

                      <small>{month.label}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="manager-chart-card">
                <div className="manager-card-heading">
                  <div>
                    <span className="manager-card-eyebrow">
                      STATUS DISTRIBUTION
                    </span>
                    <h3>Workflow breakdown</h3>
                    <p>Request counts by approval stage</p>
                  </div>

                  <span className="manager-card-icon">
                    <Activity size={18} />
                  </span>
                </div>

                <div className="manager-status-list manager-analytics-status">
                  {statusBreakdown.map((item) => (
                    <div
                      className="manager-status-row"
                      key={item.label}
                    >
                      <div className="manager-status-row-top">
                        <span>
                          <i className={`manager-legend-dot ${item.color}`} />
                          {item.label}
                        </span>
                        <strong>{item.value}</strong>
                      </div>

                      <div className="manager-status-track">
                        <div
                          className={`manager-status-fill ${item.color}`}
                          style={{ width: item.width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="manager-panel manager-analytics-summary">
              <div className="manager-panel-head">
                <div>
                  <h2>Procurement summary</h2>
                  <p>
                    Key figures calculated from the currently loaded requests.
                  </p>
                </div>
              </div>

              <div className="manager-summary-grid">
                <div>
                  <span>Average request value</span>
                  <strong>
                    {formatCurrency(
                      requests.length
                        ? totalSpend / requests.length
                        : 0
                    )}
                  </strong>
                </div>

                <div>
                  <span>Pending manager tasks</span>
                  <strong>{managerPending.length}</strong>
                </div>

                <div>
                  <span>Sent to finance</span>
                  <strong>{financePending.length}</strong>
                </div>

                <div>
                  <span>Rejected requests</span>
                  <strong>{rejectedRequests.length}</strong>
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab !== "Analytics" && (
          <section className="manager-panel">
            <div className="manager-panel-head">
              <div>
                <span className="manager-card-eyebrow">
                  {activeTab === "Pending Approvals"
                    ? "ACTION REQUIRED"
                    : "PROCUREMENT MANAGEMENT"}
                </span>

                <h2>
                  {activeTab === "Overview"
                    ? "Recent procurement requests"
                    : activeTab === "Pending Approvals"
                    ? "Requests awaiting your approval"
                    : activeTab === "Approval History"
                    ? "Approval history"
                    : "All procurement requests"}
                </h2>

                <p>
                  {activeTab === "Pending Approvals"
                    ? "Approve or reject requests assigned to your manager workflow."
                    : activeTab === "Approval History"
                    ? "Review previously approved and rejected requests."
                    : "Search, filter and review requests submitted by employees."}
                </p>
              </div>

              <div className="manager-panel-actions">
                <button
                  className="manager-secondary-btn"
                  onClick={loadDashboard}
                  disabled={loading}
                >
                  <RefreshCw
                    size={14}
                    className={loading ? "manager-spin" : ""}
                  />
                  Refresh
                </button>

                <button
                  className="manager-export-btn"
                  onClick={exportCsv}
                  disabled={!filteredRequests.length}
                >
                  <Download size={15} /> Export CSV
                </button>
              </div>
            </div>

            <div className="manager-toolbar">
              <div className="manager-search">
                <Search size={16} />

                <input
                  placeholder="Search employee, product, supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="manager-toolbar-right">
                <button
                  className={`manager-filter-toggle ${
                    showFilters ? "selected" : ""
                  }`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal size={15} /> Filters
                </button>

                <select
                  className="manager-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort requests"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="amount-high">Amount: high to low</option>
                  <option value="amount-low">Amount: low to high</option>
                </select>
              </div>
            </div>

            {showFilters && (
              <div className="manager-filter-panel">
                <label htmlFor="manager-status-filter">
                  <Filter size={14} /> Filter by status
                </label>

                <select
                  id="manager-status-filter"
                  className="manager-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All statuses</option>

                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSearch("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}

            {loading ? (
              <div className="manager-loading">
                <RefreshCw
                  size={24}
                  className="manager-spin"
                />
                <p>Loading procurement workspace...</p>
                <small>
                  Fetching requests and approval tasks
                </small>
              </div>
            ) : !filteredRequests.length ? (
              <div className="manager-empty">
                <div className="manager-empty-icon">
                  <ClipboardList size={28} />
                </div>

                <h3>No requests found</h3>

                <p>
                  There are no requests matching your current search or filters.
                </p>

                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    loadDashboard();
                  }}
                >
                  <RefreshCw size={14} /> Reset and refresh
                </button>
              </div>
            ) : (
              <div className="manager-table-wrap">
                <table className="manager-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Product / Item</th>
                      <th>Supplier</th>
                      <th>Department</th>
                      <th>Amount</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRequests.map((request, index) => {
                      const status = getStatus(request);
                      const taskId =
                        request.workflowTaskId ||
                        getTaskId(request.workflowTask);

                      const isPending = Boolean(taskId);

                      return (
                        <tr
                          key={getRequestId(request) || index}
                        >
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
                                    request.request_number ||
                                    "Employee"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="manager-product">
                              <strong>{getProduct(request)}</strong>
                              <small>
                                Quantity: {request.quantity ?? "—"}
                              </small>
                            </div>
                          </td>

                          <td>{getSupplier(request)}</td>
                          <td>{getDepartment(request)}</td>

                          <td>
                            <strong className="manager-amount">
                              {formatCurrency(
                                getAmount(request),
                                request.currency || "INR"
                              )}
                            </strong>
                          </td>

                          <td>
                            {formatDate(getRequestDate(request))}
                          </td>

                          <td>
                            <span
                              className={`manager-status ${statusStyle(status)}`}
                            >
                              <i />
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
                                  setSuccess("");
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

            <div className="manager-panel-foot">
              <span>
                Showing <strong>{filteredRequests.length}</strong>{" "}
                request{filteredRequests.length === 1 ? "" : "s"}
              </span>

              <span className="manager-foot-note">
                Data from your ETDOX organization workspace
              </span>
            </div>
          </section>
        )}
      </main>

      {selectedRequest && (
        <div
          className="manager-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="manager-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-modal-title"
          >
            <div className="manager-modal-head">
              <div>
                <span className="manager-modal-eyebrow">
                  ETDOX / PROCUREMENT REQUEST
                </span>

                <h2 id="manager-modal-title">
                  {decision
                    ? decision === "approve"
                      ? "Approve request"
                      : "Reject request"
                    : "Request details"}
                </h2>

                <p>
                  {selectedRequest.request_number ||
                    `Request #${String(
                      getRequestId(selectedRequest) || ""
                    ).slice(0, 8)}`}
                </p>
              </div>

              <button
                className="manager-close"
                disabled={submitting}
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={17} />
              </button>
            </div>

            <div className="manager-modal-status">
              <span
                className={`manager-status ${statusStyle(
                  getStatus(selectedRequest)
                )}`}
              >
                <i />
                {getStatus(selectedRequest).replaceAll("_", " ")}
              </span>

              <span className="manager-modal-amount">
                {formatCurrency(
                  getAmount(selectedRequest),
                  selectedRequest.currency || "INR"
                )}
              </span>
            </div>

            <div className="manager-details">
              <div className="manager-detail">
                <small>Employee</small>
                <strong>{getEmployee(selectedRequest)}</strong>
              </div>

              <div className="manager-detail">
                <small>Product / Item</small>
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
                <small>Unit price</small>
                <strong>
                  {formatCurrency(
                    selectedRequest.unitPrice ??
                      selectedRequest.unit_price,
                    selectedRequest.currency || "INR"
                  )}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Total amount</small>
                <strong>
                  {formatCurrency(
                    getAmount(selectedRequest),
                    selectedRequest.currency || "INR"
                  )}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Submitted date</small>
                <strong>
                  {formatDate(getRequestDate(selectedRequest))}
                </strong>
              </div>

              <div className="manager-detail manager-detail-wide">
                <small>Request ID</small>
                <strong>
                  {getRequestId(selectedRequest) || "—"}
                </strong>
              </div>
            </div>

            <div className="manager-description">
              <small>Justification / Description</small>
              <p>
                {selectedRequest.justification ||
                  selectedRequest.description ||
                  selectedRequest.reason ||
                  "No description provided."}
              </p>
            </div>

            {decision && (
              <div className={`manager-decision-note ${decision}`}>
                <div className="manager-decision-note-title">
                  {decision === "approve"
                    ? <CheckCircle2 size={17} />
                    : <AlertCircle size={17} />}

                  <strong>
                    {decision === "approve"
                      ? "Approval confirmation"
                      : "Rejection reason"}
                  </strong>
                </div>

                <p>
                  {decision === "approve"
                    ? "Confirming will approve this manager task and advance the request to the next workflow stage."
                    : "A rejection reason is required. This comment will be submitted with your rejection."}
                </p>

                <label htmlFor="manager-reason">
                  {decision === "reject"
                    ? "Reason for rejection *"
                    : "Approval note (optional)"}
                </label>

                <textarea
                  id="manager-reason"
                  className="manager-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    decision === "reject"
                      ? "Explain why this procurement request is being rejected..."
                      : "Add an optional note for the next approval stage..."
                  }
                  disabled={submitting}
                  maxLength={4000}
                />

                <small className="manager-character-count">
                  {reason.length}/4000 characters
                </small>
              </div>
            )}

            <div className="manager-modal-actions">
              <button
                className="manager-btn light"
                disabled={submitting}
                onClick={closeModal}
              >
                Cancel
              </button>

              {!decision &&
                (
                  selectedRequest.workflowTaskId ||
                  getTaskId(selectedRequest.workflowTask)
                ) && (
                  <>
                    <button
                      className="manager-btn red-outline"
                      onClick={() =>
                        openDecision(selectedRequest, "reject")
                      }
                    >
                      <Ban size={14} /> Reject
                    </button>

                    <button
                      className="manager-btn green"
                      onClick={() =>
                        openDecision(selectedRequest, "approve")
                      }
                    >
                      <Check size={14} /> Approve
                    </button>
                  </>
                )}

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
                      <RefreshCw
                        size={14}
                        className="manager-spin"
                      />
                      Processing...
                    </>
                  ) : decision === "approve" ? (
                    <>
                      <Check size={14} />
                      Confirm approval
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      Confirm rejection
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
