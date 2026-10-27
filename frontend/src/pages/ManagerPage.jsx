import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ClipboardCheck,
  CalendarDays,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock3,
  CheckCircle2,
  CircleAlert,
  Plus,
  MoreHorizontal,
  ChevronDown,
  Target,
  BriefcaseBusiness,
  RefreshCw,
  Package,
  IndianRupee,
  FileText,
  Eye,
  Filter,
  UserRound,
  Building2,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import "./ManagerPage.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const productivityData = [
  { day: "Mon", completed: 18, planned: 22 },
  { day: "Tue", completed: 24, planned: 25 },
  { day: "Wed", completed: 20, planned: 23 },
  { day: "Thu", completed: 29, planned: 28 },
  { day: "Fri", completed: 25, planned: 30 },
  { day: "Sat", completed: 12, planned: 15 },
  { day: "Sun", completed: 8, planned: 10 },
];

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Team", icon: Users },
  { label: "Projects", icon: FolderKanban },
  { label: "Tasks", icon: ClipboardCheck },
  { label: "Approvals", icon: CheckCircle2 },
  { label: "Calendar", icon: CalendarDays },
  { label: "Settings", icon: Settings },
];

const formatMoney = (amount, currency = "INR") => {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || "INR"} ${value.toLocaleString("en-IN")}`;
  }
};

const formatDate = (date) => {
  if (!date) return "Not specified";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return String(date);

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (status) =>
  String(status || "PENDING_MANAGER")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const statusLabel = (status) => {
  const labels = {
    PENDING_MANAGER: "Pending manager approval",
    PENDING_FINANCE: "Pending finance approval",
    APPROVED: "Approved",
    REJECTED_MANAGER: "Rejected by manager",
    REJECTED_FINANCE: "Rejected by finance",
    COMPLETED: "Completed",
    PENDING: "Pending",
    IN_PROGRESS: "In progress",
    REVIEW: "Under review",
  };

  const normalized = normalizeStatus(status);

  return (
    labels[normalized] ||
    String(status || "Unknown").replace(/_/g, " ")
  );
};

const getToken = () =>
  sessionStorage.getItem("authToken") ||
  sessionStorage.getItem("token") ||
  "";

const getSavedUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getRequestId = (request) =>
  request?.id ?? request?._id ?? request?.requestId;

const getRequesterName = (request) =>
  request?.requesterName ||
  request?.employeeName ||
  request?.requestedBy?.name ||
  request?.employee?.name ||
  request?.user?.name ||
  request?.requester?.name ||
  "Employee";

const getRequesterEmail = (request) =>
  request?.requesterEmail ||
  request?.employeeEmail ||
  request?.requestedBy?.email ||
  request?.employee?.email ||
  request?.user?.email ||
  request?.requester?.email ||
  "";

const getProductName = (request) =>
  request?.productName || request?.itemName || request?.title || "Product request";

const getRequestAmount = (request) =>
  Number(
    request?.totalAmount ??
      request?.total ??
      request?.estimatedTotal ??
      Number(request?.quantity || 0) * Number(request?.unitPrice || 0)
  );

const getDepartment = (request) =>
  request?.department ||
  request?.departmentName ||
  request?.requestedBy?.department ||
  "Not specified";

const getBudgetId = (request) =>
  request?.budgetId?._id ||
  request?.budgetId?.id ||
  request?.budgetId ||
  "";

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);

  let className = "manager-status";

  if (normalized.includes("APPROVED") || normalized === "COMPLETED") {
    className += " status-completed";
  } else if (normalized.includes("REJECTED")) {
    className += " status-rejected";
  } else if (
    normalized.includes("PENDING") ||
    normalized === "REVIEW"
  ) {
    className += " status-pending";
  } else {
    className += " status-progress";
  }

  return (
    <span className={className}>
      {normalized.includes("REJECTED") ? (
        <XCircle size={13} />
      ) : normalized.includes("APPROVED") ||
        normalized === "COMPLETED" ? (
        <CheckCircle2 size={13} />
      ) : (
        <Clock3 size={13} />
      )}
      {statusLabel(status)}
    </span>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="manager-no-approvals">
      <Package size={35} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default function ManagerPage() {
  const [activePage, setActivePage] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [requestFilter, setRequestFilter] = useState("ALL");
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(getSavedUser);

  const [tasks] = useState([
    {
      id: 101,
      title: "Complete client dashboard UI",
      project: "ETDOX Portal",
      assignee: "Ananya Reddy",
      priority: "High",
      due: "Oct 22, 2026",
      status: "In Progress",
    },
    {
      id: 102,
      title: "Integrate payment API",
      project: "Finance Platform",
      assignee: "Rahul Sharma",
      priority: "High",
      due: "Oct 21, 2026",
      status: "In Progress",
    },
    {
      id: 103,
      title: "Review mobile wireframes",
      project: "Mobile Experience",
      assignee: "Priya Kumar",
      priority: "Medium",
      due: "Oct 23, 2026",
      status: "Review",
    },
    {
      id: 104,
      title: "Run regression testing",
      project: "ETDOX Portal",
      assignee: "Arjun Rao",
      priority: "Medium",
      due: "Oct 24, 2026",
      status: "Pending",
    },
    {
      id: 105,
      title: "Finish authentication module",
      project: "Finance Platform",
      assignee: "Sneha Patel",
      priority: "Low",
      due: "Oct 20, 2026",
      status: "Completed",
    },
  ]);

  const [teamMembers] = useState([
    { id: 1, name: "Ananya Reddy", role: "Frontend Developer", initials: "AR", color: "violet", tasks: 8, completed: 6, status: "Available" },
    { id: 2, name: "Rahul Sharma", role: "Backend Developer", initials: "RS", color: "blue", tasks: 10, completed: 7, status: "Busy" },
    { id: 3, name: "Priya Kumar", role: "UI/UX Designer", initials: "PK", color: "pink", tasks: 6, completed: 5, status: "Available" },
    { id: 4, name: "Arjun Rao", role: "QA Engineer", initials: "AR", color: "green", tasks: 7, completed: 4, status: "In meeting" },
    { id: 5, name: "Sneha Patel", role: "Full Stack Developer", initials: "SP", color: "orange", tasks: 9, completed: 8, status: "Available" },
  ]);

  const [projects] = useState([
    { name: "ETDOX Portal", client: "Internal platform", progress: 78, color: "violet", status: "On track", due: "Oct 30, 2026" },
    { name: "Finance Platform", client: "Finance department", progress: 56, color: "blue", status: "In progress", due: "Nov 05, 2026" },
    { name: "Mobile Experience", client: "Customer experience", progress: 34, color: "orange", status: "At risk", due: "Nov 12, 2026" },
  ]);

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }, []);

  const apiRequest = useCallback(async (path, options = {}) => {
    const token = getToken();

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (response.status === 401) {
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok) {
      const message =
        typeof data === "object"
          ? data.message || data.error || `Request failed (${response.status})`
          : data || `Request failed (${response.status})`;

      throw new Error(message);
    }

    return data;
  }, []);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/api/procurement/requests"),
        apiRequest("/api/procurement/budgets"),
        apiRequest("/api/auth/me"),
      ]);

      const requestResult = results[0];
      const budgetResult = results[1];
      const userResult = results[2];

      if (requestResult.status === "fulfilled") {
        const payload = requestResult.value;
        const list = Array.isArray(payload)
          ? payload
          : payload.requests || payload.data || [];

        setRequests(Array.isArray(list) ? list : []);
      } else {
        throw new Error(
          `Could not load employee requests: ${requestResult.reason?.message || "Unknown error"}`
        );
      }

      if (budgetResult.status === "fulfilled") {
        const payload = budgetResult.value;
        const list = Array.isArray(payload)
          ? payload
          : payload.budgets || payload.data || [];

        setBudgets(Array.isArray(list) ? list : []);
      } else {
        setBudgets([]);
        console.error("Budget API error:", budgetResult.reason);
      }

      if (userResult.status === "fulfilled") {
        const payload = userResult.value;
        const user = payload.user || payload.data || payload;

        if (user && typeof user === "object") {
          setCurrentUser(user);
          sessionStorage.setItem("user", JSON.stringify(user));
        }
      } else {
        console.error("Could not load user profile:", userResult.reason);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load procurement data. Check your backend connection."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    loadDashboard();

    // Load current server data when the manager opens this page.
  }, [loadDashboard]);

  const allRequests = useMemo(() => requests, [requests]);

  const pendingManagerRequests = useMemo(
    () =>
      allRequests.filter(
        (request) =>
          normalizeStatus(request.status) === "PENDING_MANAGER"
      ),
    [allRequests]
  );

  const pendingFinanceRequests = useMemo(
    () =>
      allRequests.filter(
        (request) =>
          normalizeStatus(request.status) === "PENDING_FINANCE"
      ),
    [allRequests]
  );

  const approvedRequests = useMemo(
    () =>
      allRequests.filter(
        (request) =>
          normalizeStatus(request.status) === "APPROVED"
      ),
    [allRequests]
  );

  const rejectedRequests = useMemo(
    () =>
      allRequests.filter((request) =>
        normalizeStatus(request.status).includes("REJECTED")
      ),
    [allRequests]
  );

  const totalRequestedValue = useMemo(
    () =>
      allRequests.reduce(
        (sum, request) => sum + getRequestAmount(request),
        0
      ),
    [allRequests]
  );

  const pendingApprovalValue = useMemo(
    () =>
      pendingManagerRequests.reduce(
        (sum, request) => sum + getRequestAmount(request),
        0
      ),
    [pendingManagerRequests]
  );

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allRequests.filter((request) => {
      const searchable = [
        getRequestId(request),
        getRequesterName(request),
        getRequesterEmail(request),
        getProductName(request),
        request.description,
        request.supplier,
        getDepartment(request),
        request.justification,
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || searchable.includes(term);

      const status = normalizeStatus(request.status);

      const matchesFilter =
        requestFilter === "ALL" ||
        (requestFilter === "PENDING_MANAGER" &&
          status === "PENDING_MANAGER") ||
        (requestFilter === "PENDING_FINANCE" &&
          status === "PENDING_FINANCE") ||
        (requestFilter === "APPROVED" && status === "APPROVED") ||
        (requestFilter === "REJECTED" &&
          status.includes("REJECTED"));

      return matchesSearch && matchesFilter;
    });
  }, [allRequests, searchTerm, requestFilter]);

  const uniqueEmployees = useMemo(() => {
    const employees = new Map();

    allRequests.forEach((request) => {
      const email = getRequesterEmail(request);
      const name = getRequesterName(request);
      const key = email || name;

      if (!employees.has(key)) {
        employees.set(key, {
          key,
          name,
          email,
          department: getDepartment(request),
          requests: 0,
          total: 0,
        });
      }

      const employee = employees.get(key);
      employee.requests += 1;
      employee.total += getRequestAmount(request);
    });

    return Array.from(employees.values());
  }, [allRequests]);

  async function handleManagerDecision(request, decision) {
    const id = getRequestId(request);

    if (!id) {
      showNotice("This request has no ID. Check your backend response.");
      return;
    }

    const approved = decision === "APPROVE";

    const comment = window.prompt(
      approved
        ? "Optional approval comment:"
        : "Please enter a reason for rejecting this request:",
      approved ? "Approved by manager." : ""
    );

    if (comment === null) return;

    if (!approved && !comment.trim()) {
      showNotice("Please provide a rejection reason.");
      return;
    }

    setProcessingId(id);
    setError("");

    try {
      const result = await apiRequest(
        `/api/procurement/requests/${encodeURIComponent(id)}/manager-decision`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision: approved ? "APPROVE" : "REJECT",
            comment: comment.trim(),
          }),
        }
      );

      if (result.request) {
        setRequests((current) =>
          current.map((item) =>
            String(getRequestId(item)) === String(id)
              ? { ...item, ...result.request }
              : item
          )
        );
      }

      await loadDashboard(true);

      showNotice(
        approved
          ? "Request approved and sent for Finance review."
          : "Request rejected successfully."
      );

      setSelectedRequest(null);
    } catch (err) {
      setError(err.message || "Could not process the manager decision.");
    } finally {
      setProcessingId(null);
    }
  }

  function exportRequests() {
    const header = [
      "Request ID",
      "Employee",
      "Email",
      "Department",
      "Product",
      "Supplier",
      "Quantity",
      "Unit Price",
      "Total Amount",
      "Status",
      "Date",
    ];

    const rows = filteredRequests.map((request) => [
      getRequestId(request),
      getRequesterName(request),
      getRequesterEmail(request),
      getDepartment(request),
      getProductName(request),
      request.supplier || "",
      request.quantity || 0,
      request.unitPrice || 0,
      getRequestAmount(request),
      statusLabel(request.status),
      request.createdAt || request.created_at || "",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "etdox-employee-procurement-requests.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function renderRequestTable(compact = false) {
    const visibleRequests = compact
      ? filteredRequests.slice(0, 5)
      : filteredRequests;

    return (
      <div className="manager-table-wrap">
        <table className="manager-table">
          <thead>
            <tr>
              <th>Employee / Request</th>
              <th>Product</th>
              <th>Department</th>
              <th>Amount</th>
              <th>Status</th>
              {!compact && <th>Action</th>}
            </tr>
          </thead>

          <tbody>
            {visibleRequests.map((request) => {
              const id = getRequestId(request);
              const status = normalizeStatus(request.status);
              const canReview = status === "PENDING_MANAGER";

              return (
                <tr key={id}>
                  <td>
                    <div className="manager-task-title">
                      <strong>{getRequesterName(request)}</strong>
                      <span>
                        {id ? `Request #${String(id).slice(-8)}` : "Request"}
                      </span>
                      {getRequesterEmail(request) && (
                        <span>{getRequesterEmail(request)}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="manager-task-title">
                      <strong>{getProductName(request)}</strong>
                      <span>
                        Qty: {Number(request.quantity || 0)}
                        {request.supplier
                          ? ` · ${request.supplier}`
                          : ""}
                      </span>
                    </div>
                  </td>

                  <td>{getDepartment(request)}</td>

                  <td>
                    <strong>
                      {formatMoney(
                        getRequestAmount(request),
                        request.currency || "INR"
                      )}
                    </strong>
                  </td>

                  <td>
                    <StatusBadge status={request.status} />
                  </td>

                  {!compact && (
                    <td>
                      <div className="manager-row-actions">
                        <button
                          className="manager-secondary-button"
                          onClick={() => setSelectedRequest(request)}
                          title="View request details"
                        >
                          <Eye size={14} /> Details
                        </button>

                        {canReview && (
                          <>
                            <button
                              className="manager-approve-button"
                              disabled={processingId === id}
                              onClick={() =>
                                handleManagerDecision(request, "APPROVE")
                              }
                            >
                              {processingId === id ? (
                                <RefreshCw size={14} />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              Approve
                            </button>

                            <button
                              className="manager-reject-button"
                              disabled={processingId === id}
                              onClick={() =>
                                handleManagerDecision(request, "REJECT")
                              }
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {visibleRequests.length === 0 && (
              <tr>
                <td colSpan={compact ? 5 : 6} className="manager-empty">
                  No employee procurement requests match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderTeam() {
    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Employees and Procurement Activity</h2>
            <p>
              Employees who have submitted procurement requests through the
              employee portal.
            </p>
          </div>
          <span className="manager-count-pill">
            {uniqueEmployees.length} employees
          </span>
        </div>

        {uniqueEmployees.length === 0 ? (
          <EmptyState
            title="No employee requests yet"
            message="Employees will appear here after they submit procurement requests."
          />
        ) : (
          <div className="manager-team-grid">
            {uniqueEmployees.map((employee, index) => (
              <article className="manager-member-card" key={employee.key}>
                <div className="manager-member-top">
                  <div
                    className={`manager-avatar avatar-${
                      ["violet", "blue", "green", "pink", "orange"][
                        index % 5
                      ]
                    }`}
                  >
                    {employee.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="manager-count-pill">
                    {employee.requests} requests
                  </span>
                </div>

                <h3>{employee.name}</h3>
                <p>{employee.email || employee.department}</p>

                <div className="manager-member-footer">
                  <span>Requested value</span>
                  <strong>{formatMoney(employee.total)}</strong>
                </div>

                <button
                  className="manager-full-width-button"
                  onClick={() => {
                    setSearchTerm(employee.email || employee.name);
                    setRequestFilter("ALL");
                    setActivePage("Approvals");
                  }}
                >
                  View requests <ArrowUpRight size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderProjects() {
    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Project Portfolio</h2>
            <p>
              Sample project tracking. Connect a project API to persist these
              records.
            </p>
          </div>
        </div>

        <div className="manager-project-list">
          {projects.map((project) => (
            <article className="manager-project-card" key={project.name}>
              <div className={`manager-project-icon project-${project.color}`}>
                <BriefcaseBusiness size={21} />
              </div>

              <div className="manager-project-main">
                <div className="manager-project-heading">
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.client}</p>
                  </div>
                  <span className="manager-project-status">
                    {project.status}
                  </span>
                </div>

                <div className="manager-project-progress-label">
                  <span>Overall progress</span>
                  <strong>{project.progress}%</strong>
                </div>

                <div
                  className={`manager-progress-track progress-${project.color}`}
                >
                  <span style={{ width: `${project.progress}%` }} />
                </div>

                <div className="manager-project-footer">
                  <span>
                    <CalendarDays size={14} /> Due {project.due}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderTasks() {
    const filteredTasks = tasks.filter((task) =>
      `${task.title} ${task.project} ${task.assignee}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );

    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Team Tasks</h2>
            <p>
              Demonstration task data. Procurement requests are loaded from
              your backend.
            </p>
          </div>
        </div>

        <div className="manager-table-wrap">
          <table className="manager-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Due date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className="manager-task-title">
                      <strong>{task.title}</strong>
                      <span>{task.project}</span>
                    </div>
                  </td>
                  <td>{task.assignee}</td>
                  <td>{task.priority}</td>
                  <td>{task.due}</td>
                  <td>
                    <StatusBadge status={task.status} />
                  </td>
                </tr>
              ))}

              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="manager-empty">
                    No matching tasks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderApprovals() {
    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Employee Procurement Requests</h2>
            <p>
              Review product orders submitted by employees. Approved requests
              move to Finance for approval.
            </p>
          </div>

          <button
            className="manager-secondary-button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="manager-request-summary">
          <article>
            <span>All requests</span>
            <strong>{allRequests.length}</strong>
          </article>
          <article>
            <span>Awaiting manager</span>
            <strong>{pendingManagerRequests.length}</strong>
          </article>
          <article>
            <span>Awaiting finance</span>
            <strong>{pendingFinanceRequests.length}</strong>
          </article>
          <article>
            <span>Approved</span>
            <strong>{approvedRequests.length}</strong>
          </article>
        </div>

        <div className="manager-table-toolbar">
          <label className="manager-search">
            <Search size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee, product, supplier..."
            />
          </label>

          <select
            className="manager-filter-select"
            value={requestFilter}
            onChange={(event) => setRequestFilter(event.target.value)}
            aria-label="Filter employee requests"
          >
            <option value="ALL">All requests</option>
            <option value="PENDING_MANAGER">Awaiting manager</option>
            <option value="PENDING_FINANCE">Awaiting finance</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            className="manager-secondary-button"
            onClick={exportRequests}
          >
            <FileText size={15} /> Export CSV
          </button>
        </div>

        {loading ? (
          <EmptyState
            title="Loading employee requests"
            message="Fetching the latest procurement requests from the server."
          />
        ) : (
          renderRequestTable()
        )}

        <div className="manager-approval-guidance">
          <ShieldCheck size={18} />
          <div>
            <strong>Approval workflow</strong>
            <p>
              Manager approval sends the request to Finance. Finance approval
              is required before an invoice can be created. Rejected requests
              cannot proceed through the workflow.
            </p>
          </div>
        </div>
      </section>
    );
  }

  function renderCalendar() {
    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Team Calendar</h2>
            <p>Sample upcoming milestones and activities.</p>
          </div>
          <CalendarDays size={22} />
        </div>

        {[
          {
            day: "21",
            month: "OCT",
            title: "Payment API delivery",
            detail: "Finance Platform · Rahul Sharma",
            type: "deadline",
          },
          {
            day: "22",
            month: "OCT",
            title: "Dashboard UI review",
            detail: "ETDOX Portal · Ananya Reddy",
            type: "meeting",
          },
          {
            day: "24",
            month: "OCT",
            title: "Regression testing",
            detail: "ETDOX Portal · Arjun Rao",
            type: "deadline",
          },
          {
            day: "30",
            month: "OCT",
            title: "ETDOX Portal milestone",
            detail: "Project milestone · All team",
            type: "milestone",
          },
        ].map((event) => (
          <div className="manager-event-row" key={event.title}>
            <div className="manager-event-date">
              <strong>{event.day}</strong>
              <span>{event.month}</span>
            </div>
            <div className="manager-event-info">
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </div>
            <span className={`manager-event-type event-${event.type}`}>
              {event.type}
            </span>
          </div>
        ))}
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Manager Settings</h2>
            <p>Your current session and procurement overview.</p>
          </div>
          <Settings size={22} />
        </div>

        {[
          ["Signed-in user", currentUser.name || "Manager"],
          ["Email", currentUser.email || "Not available"],
          ["Role", currentUser.role || "manager"],
          ["Backend API", API_BASE],
          ["Requests loaded", String(allRequests.length)],
          ["Data source", "ETDOX procurement API"],
        ].map(([label, value]) => (
          <div className="manager-setting-row" key={label}>
            <div>
              <strong>{label}</strong>
              <p>{value}</p>
            </div>
            <span>Active</span>
          </div>
        ))}
      </section>
    );
  }

  function renderOverview() {
    const completedTasks = tasks.filter(
      (task) => task.status === "Completed"
    ).length;

    const openTasks = tasks.length - completedTasks;

    return (
      <>
        <section className="manager-welcome">
          <div className="manager-welcome-copy">
            <span className="manager-eyebrow">MANAGEMENT WORKSPACE</span>
            <h2>Great teams build great results.</h2>
            <p>
              Review employee procurement requests, track approvals, and
              coordinate purchasing across ETDOX.
            </p>
            <button
              className="manager-primary-button"
              onClick={() => setActivePage("Approvals")}
            >
              Review employee requests <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="manager-welcome-art">
            <div className="manager-art-orbit orbit-one" />
            <div className="manager-art-orbit orbit-two" />
            <div className="manager-art-icon">
              <Users size={42} />
            </div>
            <div className="manager-art-chip">
              <Package size={15} /> Procurement workflow
            </div>
          </div>
        </section>

        <section className="manager-stats-grid">
          <article className="manager-stat-card">
            <div className="manager-stat-heading">
              <span>Total employee requests</span>
              <div className="manager-stat-icon violet">
                <Package size={20} />
              </div>
            </div>
            <strong className="manager-stat-value">{allRequests.length}</strong>
            <div className="manager-stat-foot">
              <span>Loaded from backend</span>
            </div>
            <div className="manager-mini-track">
              <span style={{ width: allRequests.length ? "100%" : "0%" }} />
            </div>
          </article>

          <article className="manager-stat-card">
            <div className="manager-stat-heading">
              <span>Awaiting your approval</span>
              <div className="manager-stat-icon orange">
                <Clock3 size={20} />
              </div>
            </div>
            <strong className="manager-stat-value">
              {pendingManagerRequests.length}
            </strong>
            <div className="manager-stat-foot">
              <span className="manager-warning">
                <CircleAlert size={14} /> Needs review
              </span>
              <button onClick={() => setActivePage("Approvals")}>
                Review <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="manager-mini-track mini-orange">
              <span
                style={{
                  width: `${
                    allRequests.length
                      ? (pendingManagerRequests.length / allRequests.length) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </article>

          <article className="manager-stat-card">
            <div className="manager-stat-heading">
              <span>Waiting for Finance</span>
              <div className="manager-stat-icon blue">
                <IndianRupee size={20} />
              </div>
            </div>
            <strong className="manager-stat-value">
              {pendingFinanceRequests.length}
            </strong>
            <div className="manager-stat-foot">
              <span>Manager-approved requests</span>
            </div>
            <div className="manager-mini-track mini-blue">
              <span
                style={{
                  width: `${
                    allRequests.length
                      ? (pendingFinanceRequests.length / allRequests.length) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </article>

          <article className="manager-stat-card">
            <div className="manager-stat-heading">
              <span>Requested purchase value</span>
              <div className="manager-stat-icon green">
                <TrendingUp size={20} />
              </div>
            </div>
            <strong className="manager-stat-value manager-stat-money">
              {formatMoney(totalRequestedValue)}
            </strong>
            <div className="manager-stat-foot">
              <span>All request statuses</span>
            </div>
            <div className="manager-mini-track mini-green">
              <span style={{ width: totalRequestedValue ? "100%" : "0%" }} />
            </div>
          </article>
        </section>

        <section className="manager-charts-grid">
          <div className="manager-panel">
            <div className="manager-section-heading">
              <div>
                <h2>Team Productivity</h2>
                <p>Sample daily tasks versus planned tasks.</p>
              </div>
              <span className="manager-chart-period">
                This week <ChevronDown size={14} />
              </span>
            </div>

            <div className="manager-chart-legend">
              <span>
                <i className="legend-completed" /> Completed
              </span>
              <span>
                <i className="legend-planned" /> Planned
              </span>
            </div>

            <div className="manager-chart">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={productivityData}>
                  <defs>
                    <linearGradient
                      id="managerCompletedFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#685eea"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="#685eea"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#edf0f6"
                  />

                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9298aa", fontSize: 11 }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9298aa", fontSize: 11 }}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e9ebf3",
                      fontSize: 12,
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="planned"
                    name="Planned"
                    stroke="#b4b0f7"
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />

                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#685eea"
                    fill="url(#managerCompletedFill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="manager-panel manager-workload-panel">
            <div className="manager-section-heading">
              <div>
                <h2>Procurement Summary</h2>
                <p>Current request approval distribution.</p>
              </div>
              <button
                className="manager-more-button"
                onClick={() => loadDashboard(true)}
                aria-label="Refresh procurement data"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="manager-workload-total">
              <strong>{pendingManagerRequests.length}</strong>
              <span>Awaiting manager review</span>
            </div>

            <div className="manager-workload-legend">
              <div>
                <i className="workload-pending-dot" />
                <span>Manager review</span>
                <strong>{pendingManagerRequests.length}</strong>
              </div>
              <div>
                <i className="workload-progress-dot" />
                <span>Finance review</span>
                <strong>{pendingFinanceRequests.length}</strong>
              </div>
              <div>
                <i className="workload-completed-dot" />
                <span>Approved</span>
                <strong>{approvedRequests.length}</strong>
              </div>
            </div>

            <button
              className="manager-full-width-button"
              onClick={() => setActivePage("Approvals")}
            >
              Open procurement requests <ArrowUpRight size={15} />
            </button>
          </div>
        </section>

        <section className="manager-panel manager-task-panel">
          <div className="manager-section-heading">
            <div>
              <h2>Latest Employee Requests</h2>
              <p>Recent procurement requests from your employees.</p>
            </div>
            <button
              className="manager-text-button"
              onClick={() => setActivePage("Approvals")}
            >
              View all requests <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="manager-table-toolbar">
            <label className="manager-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search employee or product..."
              />
            </label>

            <button
              className="manager-secondary-button"
              onClick={exportRequests}
            >
              <FileText size={15} /> Export CSV
            </button>
          </div>

          {loading ? (
            <EmptyState
              title="Loading requests"
              message="Contacting the procurement API."
            />
          ) : (
            renderRequestTable(true)
          )}
        </section>

        <section className="manager-panel manager-approvals-panel">
          <div className="manager-section-heading">
            <div>
              <h2>Requests Awaiting Your Decision</h2>
              <p>
                These requests are waiting for manager approval before Finance
                review.
              </p>
            </div>
            <span className="manager-count-pill">
              {pendingManagerRequests.length} pending
            </span>
          </div>

          {pendingManagerRequests.length === 0 ? (
            <EmptyState
              title="You're all caught up"
              message="No employee requests currently need manager approval."
            />
          ) : (
            pendingManagerRequests.slice(0, 4).map((request) => {
              const id = getRequestId(request);

              return (
                <div className="manager-approval-row" key={id}>
                  <div className="manager-avatar avatar-violet">
                    {getRequesterName(request)
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="manager-approval-info">
                    <strong>{getRequesterName(request)}</strong>
                    <span>{getProductName(request)}</span>
                    <small>
                      {formatMoney(
                        getRequestAmount(request),
                        request.currency || "INR"
                      )}{" "}
                      · {getDepartment(request)}
                    </small>
                  </div>

                  <div className="manager-approval-actions">
                    <button
                      className="manager-reject-button"
                      disabled={processingId === id}
                      onClick={() =>
                        handleManagerDecision(request, "REJECT")
                      }
                    >
                      Reject
                    </button>
                    <button
                      className="manager-approve-button"
                      disabled={processingId === id}
                      onClick={() =>
                        handleManagerDecision(request, "APPROVE")
                      }
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </>
    );
  }

  function renderBudgetPage() {
    return (
      <section className="manager-panel">
        <div className="manager-section-heading">
          <div>
            <h2>Department Budgets</h2>
            <p>
              Budget allocations and available balances returned by the
              procurement API.
            </p>
          </div>

          <button
            className="manager-secondary-button"
            onClick={() => loadDashboard(true)}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {budgets.length === 0 ? (
          <EmptyState
            title="No budget information available"
            message="Check that GET /api/procurement/budgets returns a budgets array."
          />
        ) : (
          <div className="manager-team-grid">
            {budgets.map((budget, index) => {
              const allocated = Number(budget.allocated || 0);
              const spent = Number(budget.spent || 0);
              const committed = Number(budget.committed || 0);
              const available = Number(
                budget.available ?? allocated - spent - committed
              );

              const usedPercent = allocated
                ? Math.min(
                    100,
                    ((spent + committed) / allocated) * 100
                  )
                : 0;

              return (
                <article
                  className="manager-member-card"
                  key={budget.id || budget._id || budget.department || index}
                >
                  <div className="manager-member-top">
                    <div className="manager-stat-icon blue">
                      <Building2 size={20} />
                    </div>
                    <span className="manager-count-pill">
                      {Math.round(usedPercent)}% used
                    </span>
                  </div>

                  <h3>{budget.department || "Department"}</h3>
                  <p>Department procurement budget</p>

                  <div className="manager-project-progress-label">
                    <span>Allocated</span>
                    <strong>
                      {formatMoney(allocated, budget.currency || "INR")}
                    </strong>
                  </div>

                  <div className="manager-progress-track progress-blue">
                    <span style={{ width: `${usedPercent}%` }} />
                  </div>

                  <div className="manager-member-footer">
                    <span>Spent</span>
                    <strong>
                      {formatMoney(spent, budget.currency || "INR")}
                    </strong>
                  </div>

                  <div className="manager-member-footer">
                    <span>Committed</span>
                    <strong>
                      {formatMoney(committed, budget.currency || "INR")}
                    </strong>
                  </div>

                  <div className="manager-member-footer">
                    <span>Available</span>
                    <strong>
                      {formatMoney(available, budget.currency || "INR")}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderContent() {
    switch (activePage) {
      case "Team":
        return renderTeam();

      case "Projects":
        return renderProjects();

      case "Tasks":
        return renderTasks();

      case "Approvals":
        return renderApprovals();

      case "Calendar":
        return renderCalendar();

      case "Settings":
        return renderSettings();

      case "Budgets":
        return renderBudgetPage();

      default:
        return renderOverview();
    }
  }

  function logout() {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  }

  return (
    <div className="manager-dashboard">
      {mobileMenuOpen && (
        <button
          className="manager-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`manager-sidebar ${
          mobileMenuOpen ? "manager-sidebar-open" : ""
        }`}
      >
        <div className="manager-brand">
          <div className="manager-brand-mark">E</div>
          <div className="manager-brand-copy">
            <strong>ETDOX</strong>
            <span>MANAGEMENT WORKSPACE</span>
          </div>
          <button
            className="manager-close-menu"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="manager-sidebar-label">WORKSPACE</div>

        <nav className="manager-nav">
          {[
            ...navItems,
            { label: "Budgets", icon: IndianRupee },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`manager-nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.label);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "Approvals" &&
                  pendingManagerRequests.length > 0 && (
                    <span className="manager-nav-count">
                      {pendingManagerRequests.length}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        <div className="manager-sidebar-bottom">
          <div className="manager-help-card">
            <div className="manager-help-icon">
              <Target size={19} />
            </div>
            <strong>Keep purchasing on track</strong>
            <p>
              Review employee orders and help departments move through
              approvals.
            </p>
            <button onClick={() => setActivePage("Approvals")}>
              Review requests <ArrowUpRight size={13} />
            </button>
          </div>

          <button className="manager-logout" onClick={logout}>
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      <main className="manager-main">
        <header className="manager-topbar">
          <div className="manager-topbar-left">
            <button
              className="manager-menu-button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div>
              <div className="manager-breadcrumb">
                Workspace <span>/</span> Manager <span>/</span> {activePage}
              </div>
              <h1>{activePage}</h1>
            </div>
          </div>

          <div className="manager-topbar-right">
            <div className="manager-topbar-date">
              <CalendarDays size={16} />
              <span>
                {new Date().toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            <button
              className="manager-notification"
              aria-label="Pending manager approvals"
              onClick={() => setActivePage("Approvals")}
            >
              <Bell size={19} />
              {pendingManagerRequests.length > 0 && <span />}
            </button>

            <div className="manager-user-profile">
              <div className="manager-user-avatar">
                {(currentUser.name || "Manager")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <strong>{currentUser.name || "Manager"}</strong>
                <span>{currentUser.role || "manager"}</span>
              </div>
            </div>
          </div>
        </header>

        {notice && (
          <div className="manager-toast" role="status">
            <CheckCircle2 size={17} />
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {error && (
          <div className="manager-api-error" role="alert">
            <CircleAlert size={19} />
            <div>
              <strong>Procurement API error</strong>
              <p>{error}</p>
              <small>
                Verify that the backend is running on {API_BASE} and that the
                required API routes are registered.
              </small>
            </div>
            <button
              className="manager-secondary-button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        <div className="manager-page-content">
          {renderContent()}
        </div>

        <footer className="manager-footer">
          <span>© 2026 ETDOX. All rights reserved.</span>
          <span>Manager Workspace · Procurement API</span>
        </footer>
      </main>

      {selectedRequest && (
        <div
          className="manager-modal-overlay"
          onClick={() => setSelectedRequest(null)}
          role="presentation"
        >
          <section
            className="manager-request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-request-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manager-section-heading">
              <div>
                <h2 id="manager-request-modal-title">Procurement Request</h2>
                <p>
                  Request ID: {getRequestId(selectedRequest)}
                </p>
              </div>

              <button
                className="manager-more-button"
                aria-label="Close details"
                onClick={() => setSelectedRequest(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="manager-request-detail-grid">
              <div>
                <span>Employee</span>
                <strong>{getRequesterName(selectedRequest)}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {getRequesterEmail(selectedRequest) || "Not provided"}
                </strong>
              </div>

              <div>
                <span>Department</span>
                <strong>{getDepartment(selectedRequest)}</strong>
              </div>

              <div>
                <span>Product</span>
                <strong>{getProductName(selectedRequest)}</strong>
              </div>

              <div>
                <span>Supplier</span>
                <strong>{selectedRequest.supplier || "Not specified"}</strong>
              </div>

              <div>
                <span>Quantity</span>
                <strong>{Number(selectedRequest.quantity || 0)}</strong>
              </div>

              <div>
                <span>Unit price</span>
                <strong>
                  {formatMoney(
                    selectedRequest.unitPrice,
                    selectedRequest.currency || "INR"
                  )}
                </strong>
              </div>

              <div>
                <span>Total requested</span>
                <strong>
                  {formatMoney(
                    getRequestAmount(selectedRequest),
                    selectedRequest.currency || "INR"
                  )}
                </strong>
              </div>

              <div>
                <span>Submitted</span>
                <strong>
                  {formatDate(
                    selectedRequest.createdAt ||
                      selectedRequest.created_at
                  )}
                </strong>
              </div>

              <div>
                <span>Budget ID</span>
                <strong>{getBudgetId(selectedRequest) || "Not assigned"}</strong>
              </div>
            </div>

            <div className="manager-request-detail-text">
              <span>Description</span>
              <p>
                {selectedRequest.description || "No description provided."}
              </p>
            </div>

            <div className="manager-request-detail-text">
              <span>Business justification</span>
              <p>
                {selectedRequest.justification ||
                  "No justification provided."}
              </p>
            </div>

            <div className="manager-request-detail-text">
              <span>Current status</span>
              <p>
                <StatusBadge status={selectedRequest.status} />
              </p>
            </div>

            {normalizeStatus(selectedRequest.status) ===
              "PENDING_MANAGER" && (
              <div className="manager-modal-actions">
                <button
                  className="manager-reject-button"
                  disabled={
                    processingId === getRequestId(selectedRequest)
                  }
                  onClick={() =>
                    handleManagerDecision(selectedRequest, "REJECT")
                  }
                >
                  <XCircle size={15} /> Reject request
                </button>

                <button
                  className="manager-approve-button"
                  disabled={
                    processingId === getRequestId(selectedRequest)
                  }
                  onClick={() =>
                    handleManagerDecision(selectedRequest, "APPROVE")
                  }
                >
                  <CheckCircle2 size={15} /> Approve request
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
