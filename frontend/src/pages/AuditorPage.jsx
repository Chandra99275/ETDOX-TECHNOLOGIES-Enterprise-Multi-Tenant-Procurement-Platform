
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  ClipboardList,
  FileSearch,
  Search,
  RefreshCw,
  LogOut,
  Bell,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Clock3,
  User,
  Building2,
  FileText,
  Eye,
  Filter,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Menu,
  X,
  Download,
  LockKeyhole,
  Database,
} from "lucide-react";

import "./AuditorPage.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  sessionStorage.getItem("token") ||
  "";

const readUser = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    return stored.user || stored.data?.user || stored.data || stored;
  } catch {
    return {};
  }
};

const getArray = (payload) => {
  if (Array.isArray(payload)) return payload;

  return (
    payload?.data?.items ||
    payload?.data?.rows ||
    payload?.data?.events ||
    payload?.data?.requests ||
    payload?.items ||
    payload?.rows ||
    payload?.events ||
    payload?.requests ||
    payload?.data ||
    []
  );
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatus = (item) =>
  String(
    item?.status ||
      item?.action ||
      item?.event_type ||
      item?.eventType ||
      "recorded"
  ).replaceAll("_", " ");

const getActor = (item) =>
  item?.actor_name ||
  item?.actorName ||
  item?.user_name ||
  item?.userName ||
  item?.performed_by ||
  item?.user?.name ||
  item?.actor?.name ||
  "System";

const getDescription = (item) =>
  item?.description ||
  item?.details ||
  item?.message ||
  item?.event_name ||
  item?.eventName ||
  item?.action ||
  "Activity recorded";

const getRecordId = (item) =>
  item?.entity_id ||
  item?.entityId ||
  item?.resource_id ||
  item?.resourceId ||
  item?.request_id ||
  item?.requestId ||
  item?.id ||
  "—";

const getSeverity = (item) => {
  const value = String(
    item?.severity || item?.risk_level || item?.riskLevel || ""
  ).toLowerCase();

  if (["critical", "high", "error", "failed"].includes(value)) {
    return "high";
  }

  if (["medium", "warning"].includes(value)) {
    return "medium";
  }

  return "normal";
};

const AuditorPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [auditLogs, setAuditLogs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [user, setUser] = useState(readUser);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    }),
    []
  );

  const apiGet = useCallback(
    async (endpoint) => {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "GET",
        headers: authHeaders,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            `Request failed with status ${response.status}`
        );
      }

      return payload;
    },
    [authHeaders]
  );

  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setAuditError("");
      setRequestError("");

      const [userResult, auditResult, requestResult] =
        await Promise.allSettled([
          apiGet("/auth/me"),
          apiGet("/audit/events?limit=100&offset=0"),
          apiGet("/procurement/requests?limit=100&offset=0"),
        ]);

      if (userResult.status === "fulfilled") {
        const responseUser =
          userResult.value?.data?.user ||
          userResult.value?.user ||
          userResult.value?.data ||
          userResult.value;

        if (responseUser && typeof responseUser === "object") {
          setUser(responseUser);
        }
      }

      if (auditResult.status === "fulfilled") {
        setAuditLogs(getArray(auditResult.value));
      } else {
        setAuditLogs([]);
        setAuditError(auditResult.reason?.message || "Unable to load audit logs.");
      }

      if (requestResult.status === "fulfilled") {
        setRequests(getArray(requestResult.value));
      } else {
        setRequests([]);
        setRequestError(
          requestResult.reason?.message || "Unable to load procurement records."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [apiGet]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = () => {
    [
      "token",
      "accessToken",
      "authToken",
      "user",
      "refreshToken",
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    window.location.href = "/login";
  };

  const allRecords = useMemo(() => {
    return auditLogs.map((item, index) => ({
      ...item,
      _key: item.id || item.event_id || `audit-${index}`,
      _type: "audit",
    }));
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allRecords.filter((item) => {
      const searchable = [
        getActor(item),
        getDescription(item),
        getStatus(item),
        getRecordId(item),
        item?.entity_type,
        item?.entityType,
        item?.module,
        item?.ip_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const severity = getSeverity(item);
      const matchesStatus =
        statusFilter === "all" ||
        getStatus(item).toLowerCase().includes(statusFilter) ||
        severity === statusFilter;

      const eventDate = new Date(
        item?.created_at || item?.createdAt || item?.timestamp || 0
      );

      let matchesDate = true;

      if (dateFilter === "today") {
        matchesDate =
          eventDate.toDateString() === new Date().toDateString();
      } else if (dateFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = eventDate >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        matchesDate = eventDate >= monthAgo;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [allRecords, search, statusFilter, dateFilter]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((item) => {
      const searchable = [
        item?.id,
        item?.request_number,
        item?.requestNumber,
        item?.title,
        item?.product_name,
        item?.productName,
        item?.supplier_name,
        item?.supplierName,
        item?.status,
        item?.department_name,
        item?.departmentName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        String(item?.status || "")
          .toLowerCase()
          .includes(statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const highRiskCount = auditLogs.filter(
    (item) => getSeverity(item) === "high"
  ).length;

  const todayCount = auditLogs.filter((item) => {
    const date = new Date(
      item?.created_at || item?.createdAt || item?.timestamp || 0
    );

    return date.toDateString() === new Date().toDateString();
  }).length;

  const uniqueActors = new Set(auditLogs.map(getActor)).size;

  const getRequestName = (item) =>
    item?.request_number ||
    item?.requestNumber ||
    item?.product_name ||
    item?.productName ||
    item?.title ||
    `Request ${String(item?.id || "").slice(0, 8)}`;

  const getRequestAmount = (item) => {
    const amount =
      item?.total_amount ??
      item?.totalAmount ??
      item?.estimated_amount ??
      item?.estimatedAmount ??
      item?.amount;

    if (amount === undefined || amount === null) return "—";

    return Number(amount).toLocaleString("en-IN", {
      style: "currency",
      currency: item?.currency || "INR",
      maximumFractionDigits: 2,
    });
  };

  const getUserName = () =>
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    user?.email ||
    "Auditor";

  const getInitials = () => {
    const name = getUserName();

    return name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  };

  const exportAuditLogs = () => {
    if (!filteredLogs.length) return;

    const columns = [
      "Date",
      "Actor",
      "Action",
      "Description",
      "Record ID",
      "Severity",
    ];

    const rows = filteredLogs.map((item) => [
      formatDate(
        item?.created_at || item?.createdAt || item?.timestamp
      ),
      getActor(item),
      getStatus(item),
      getDescription(item),
      getRecordId(item),
      getSeverity(item),
    ]);

    const escapeCSV = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `etdox-audit-logs-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  };

  const renderAuditTable = () => (
    <div className="auditor-table-wrapper">
      <table className="auditor-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Performed By</th>
            <th>Record ID</th>
            <th>Severity</th>
            <th>Date & Time</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {filteredLogs.map((item) => (
            <tr key={item._key}>
              <td>
                <div className="auditor-activity-cell">
                  <span className="auditor-activity-icon">
                    <Activity size={16} />
                  </span>
                  <div>
                    <strong>{getStatus(item)}</strong>
                    <small>{getDescription(item)}</small>
                  </div>
                </div>
              </td>

              <td>
                <div className="auditor-user-cell">
                  <span className="auditor-mini-avatar">
                    {getActor(item).charAt(0).toUpperCase()}
                  </span>
                  {getActor(item)}
                </div>
              </td>

              <td className="auditor-id-cell">
                {String(getRecordId(item)).slice(0, 14)}
              </td>

              <td>
                <span className={`auditor-severity ${getSeverity(item)}`}>
                  {getSeverity(item)}
                </span>
              </td>

              <td className="auditor-date-cell">
                {formatDate(
                  item?.created_at || item?.createdAt || item?.timestamp
                )}
              </td>

              <td>
                <button
                  className="auditor-icon-button"
                  title="View audit details"
                  onClick={() => setSelectedRecord(item)}
                >
                  <Eye size={17} />
                </button>
              </td>
            </tr>
          ))}

          {!loading && filteredLogs.length === 0 && (
            <tr>
              <td colSpan="6">
                <div className="auditor-empty">
                  <FileSearch size={30} />
                  <strong>No audit records found</strong>
                  <span>Try changing your search or filters.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderRequestsTable = () => (
    <div className="auditor-table-wrapper">
      <table className="auditor-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Department</th>
            <th>Supplier</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Created</th>
            <th>Review</th>
          </tr>
        </thead>

        <tbody>
          {filteredRequests.map((item, index) => (
            <tr key={item.id || item.request_id || index}>
              <td>
                <div className="auditor-request-cell">
                  <FileText size={17} />
                  <div>
                    <strong>{getRequestName(item)}</strong>
                    <small>
                      {String(item?.id || item?.request_id || "—").slice(0, 16)}
                    </small>
                  </div>
                </div>
              </td>

              <td>
                {item?.department_name ||
                  item?.departmentName ||
                  item?.department ||
                  "—"}
              </td>

              <td>
                {item?.supplier_name ||
                  item?.supplierName ||
                  item?.supplier ||
                  "—"}
              </td>

              <td className="auditor-amount">
                {getRequestAmount(item)}
              </td>

              <td>
                <span
                  className={`auditor-status ${String(
                    item?.status || "unknown"
                  )
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {item?.status || "Unknown"}
                </span>
              </td>

              <td className="auditor-date-cell">
                {formatDate(item?.created_at || item?.createdAt)}
              </td>

              <td>
                <button
                  className="auditor-icon-button"
                  title="Inspect request"
                  onClick={() =>
                    setSelectedRecord({
                      ...item,
                      _recordType: "Procurement Request",
                    })
                  }
                >
                  <Eye size={17} />
                </button>
              </td>
            </tr>
          ))}

          {!loading && filteredRequests.length === 0 && (
            <tr>
              <td colSpan="7">
                <div className="auditor-empty">
                  <ClipboardList size={30} />
                  <strong>No procurement records found</strong>
                  <span>Try changing your search or filters.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="auditor-layout">
      {sidebarOpen && (
        <button
          className="auditor-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`auditor-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="auditor-brand">
          <div className="auditor-brand-mark">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2>ETDOX</h2>
            <span>TECHNOLOGIES</span>
          </div>
          <button
            className="auditor-close-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="auditor-workspace-label">AUDIT WORKSPACE</div>

        <nav className="auditor-nav">
          <button
            className={`auditor-nav-item ${
              activeTab === "overview" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("overview");
              setSidebarOpen(false);
            }}
          >
            <LayoutDashboard size={19} />
            <span>Overview</span>
          </button>

          <button
            className={`auditor-nav-item ${
              activeTab === "logs" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("logs");
              setSidebarOpen(false);
            }}
          >
            <Activity size={19} />
            <span>Audit Logs</span>
            <span className="auditor-nav-count">{auditLogs.length}</span>
          </button>

          <button
            className={`auditor-nav-item ${
              activeTab === "requests" ? "active" : ""
            }`}
            onClick={() => {
              setActiveTab("requests");
              setSidebarOpen(false);
            }}
          >
            <ClipboardList size={19} />
            <span>Procurement Records</span>
          </button>
        </nav>

        <div className="auditor-sidebar-divider" />

        <div className="auditor-workspace-label">COMPLIANCE</div>

        <div className="auditor-compliance-card">
          <div className="auditor-compliance-icon">
            <LockKeyhole size={18} />
          </div>
          <strong>Read-only access</strong>
          <p>
            Your auditor account can inspect records and activity without
            changing procurement data.
          </p>
        </div>

        <div className="auditor-sidebar-bottom">
          <div className="auditor-profile">
            <div className="auditor-avatar">{getInitials()}</div>
            <div className="auditor-profile-info">
              <strong>{getUserName()}</strong>
              <span>Auditor</span>
            </div>
            <button
              className="auditor-logout-button"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="auditor-main">
        <header className="auditor-topbar">
          <div className="auditor-topbar-left">
            <button
              className="auditor-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="auditor-breadcrumb">
              <span>ETDOX</span>
              <ChevronRight size={15} />
              <strong>Auditor Workspace</strong>
            </div>
          </div>

          <div className="auditor-topbar-right">
            <div className="auditor-secure-label">
              <span className="auditor-secure-dot" />
              Secure session
            </div>

            <button
              className="auditor-refresh-button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "auditor-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <div className="auditor-topbar-user">
              <div className="auditor-avatar small">{getInitials()}</div>
              <div>
                <strong>{getUserName()}</strong>
                <span>Auditor</span>
              </div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        <div className="auditor-content">
          <section className="auditor-page-heading">
            <div>
              <div className="auditor-eyebrow">
                <ShieldCheck size={15} />
                AUDIT & COMPLIANCE
              </div>
              <h1>
                {activeTab === "overview"
                  ? "Audit Overview"
                  : activeTab === "logs"
                  ? "Audit Logs"
                  : "Procurement Records"}
              </h1>
              <p>
                Monitor procurement activity, inspect records, and review
                organizational compliance.
              </p>
            </div>

            <div className="auditor-heading-actions">
              <div className="auditor-date-display">
                <CalendarDays size={16} />
                {new Date().toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>

              {activeTab === "logs" && (
                <button
                  className="auditor-export-button"
                  onClick={exportAuditLogs}
                  disabled={!filteredLogs.length}
                >
                  <Download size={17} />
                  Export CSV
                </button>
              )}
            </div>
          </section>

          {(auditError || requestError) && (
            <div className="auditor-warning">
              <AlertCircle size={18} />
              <div>
                <strong>Some dashboard data could not be loaded.</strong>
                {auditError && <p>Audit logs: {auditError}</p>}
                {requestError && <p>Procurement records: {requestError}</p>}
              </div>
              <button onClick={() => loadDashboard(true)}>Retry</button>
            </div>
          )}

          {activeTab === "overview" && (
            <>
              <section className="auditor-stats-grid">
                <div className="auditor-stat-card">
                  <div className="auditor-stat-top">
                    <span>Total Audit Events</span>
                    <div className="auditor-stat-icon blue">
                      <Activity size={20} />
                    </div>
                  </div>
                  <strong>{loading ? "—" : auditLogs.length}</strong>
                  <small>Recorded activity events</small>
                </div>

                <div className="auditor-stat-card">
                  <div className="auditor-stat-top">
                    <span>Today's Events</span>
                    <div className="auditor-stat-icon purple">
                      <Clock3 size={20} />
                    </div>
                  </div>
                  <strong>{loading ? "—" : todayCount}</strong>
                  <small>Events recorded today</small>
                </div>

                <div className="auditor-stat-card">
                  <div className="auditor-stat-top">
                    <span>High-Risk Events</span>
                    <div className="auditor-stat-icon red">
                      <AlertCircle size={20} />
                    </div>
                  </div>
                  <strong>{loading ? "—" : highRiskCount}</strong>
                  <small>Based on available severity data</small>
                </div>

                <div className="auditor-stat-card">
                  <div className="auditor-stat-top">
                    <span>Procurement Records</span>
                    <div className="auditor-stat-icon green">
                      <Database size={20} />
                    </div>
                  </div>
                  <strong>{loading ? "—" : requests.length}</strong>
                  <small>Records available for inspection</small>
                </div>
              </section>

              <section className="auditor-overview-grid">
                <div className="auditor-panel auditor-activity-panel">
                  <div className="auditor-panel-heading">
                    <div>
                      <h3>Recent Audit Activity</h3>
                      <p>Latest recorded actions across the platform</p>
                    </div>
                    <button
                      className="auditor-text-button"
                      onClick={() => setActiveTab("logs")}
                    >
                      View all <ChevronRight size={16} />
                    </button>
                  </div>

                  {loading ? (
                    <div className="auditor-loading">Loading audit activity...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="auditor-empty">
                      <Activity size={30} />
                      <strong>No audit activity available</strong>
                      <span>
                        Audit events will appear here when the audit API
                        returns records.
                      </span>
                    </div>
                  ) : (
                    <div className="auditor-recent-list">
                      {auditLogs.slice(0, 6).map((item, index) => (
                        <div
                          className="auditor-recent-item"
                          key={item.id || item.event_id || index}
                        >
                          <div className="auditor-timeline-marker">
                            <span />
                          </div>
                          <div className="auditor-recent-details">
                            <strong>{getDescription(item)}</strong>
                            <span>
                              {getActor(item)} · {getStatus(item)}
                            </span>
                          </div>
                          <time>
                            {formatDate(
                              item?.created_at ||
                                item?.createdAt ||
                                item?.timestamp
                            )}
                          </time>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="auditor-panel auditor-summary-panel">
                  <div className="auditor-panel-heading">
                    <div>
                      <h3>Audit Summary</h3>
                      <p>Current loaded dataset</p>
                    </div>
                    <ShieldCheck size={20} className="auditor-summary-icon" />
                  </div>

                  <div className="auditor-summary-row">
                    <span>Unique actors</span>
                    <strong>{loading ? "—" : uniqueActors}</strong>
                  </div>
                  <div className="auditor-summary-row">
                    <span>Audit events</span>
                    <strong>{loading ? "—" : auditLogs.length}</strong>
                  </div>
                  <div className="auditor-summary-row">
                    <span>Procurement records</span>
                    <strong>{loading ? "—" : requests.length}</strong>
                  </div>

                  <div className="auditor-readonly-note">
                    <LockKeyhole size={17} />
                    <div>
                      <strong>Read-only workspace</strong>
                      <span>
                        No write or approval actions are available in this
                        dashboard.
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="auditor-panel auditor-records-panel">
                <div className="auditor-panel-heading">
                  <div>
                    <h3>Recent Procurement Records</h3>
                    <p>Latest requests available for audit inspection</p>
                  </div>
                  <button
                    className="auditor-text-button"
                    onClick={() => setActiveTab("requests")}
                  >
                    View records <ChevronRight size={16} />
                  </button>
                </div>

                {loading ? (
                  <div className="auditor-loading">
                    Loading procurement records...
                  </div>
                ) : requests.length === 0 ? (
                  <div className="auditor-empty">
                    <ClipboardList size={30} />
                    <strong>No procurement records available</strong>
                    <span>Records will appear here when the API returns data.</span>
                  </div>
                ) : (
                  renderRequestsTable()
                )}
              </section>
            </>
          )}

          {activeTab === "logs" && (
            <section className="auditor-panel">
              <div className="auditor-panel-heading auditor-log-heading">
                <div>
                  <h3>Audit Event Register</h3>
                  <p>
                    Review system activity and trace actions across records.
                  </p>
                </div>
                <span className="auditor-record-count">
                  {filteredLogs.length} records
                </span>
              </div>

              <div className="auditor-filter-bar">
                <div className="auditor-search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search actor, action, record ID..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="auditor-filter-control">
                  <Filter size={16} />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All events</option>
                    <option value="high">High severity</option>
                    <option value="medium">Medium severity</option>
                    <option value="normal">Normal severity</option>
                    <option value="created">Created</option>
                    <option value="updated">Updated</option>
                    <option value="deleted">Deleted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="auditor-filter-control">
                  <CalendarDays size={16} />
                  <select
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value)}
                  >
                    <option value="all">All dates</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 days</option>
                    <option value="month">Last 30 days</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="auditor-loading">Loading audit logs...</div>
              ) : (
                renderAuditTable()
              )}
            </section>
          )}

          {activeTab === "requests" && (
            <section className="auditor-panel">
              <div className="auditor-panel-heading auditor-log-heading">
                <div>
                  <h3>Procurement Register</h3>
                  <p>
                    Inspect purchase requests without changing their status.
                  </p>
                </div>
                <span className="auditor-record-count">
                  {filteredRequests.length} records
                </span>
              </div>

              <div className="auditor-filter-bar">
                <div className="auditor-search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search requests, suppliers, departments..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="auditor-filter-control">
                  <Filter size={16} />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="draft">Draft</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="auditor-loading">
                  Loading procurement records...
                </div>
              ) : (
                renderRequestsTable()
              )}
            </section>
          )}

          <footer className="auditor-footer">
            <span>© {new Date().getFullYear()} ETDOX Technologies</span>
            <span>
              <LockKeyhole size={13} /> Secure audit workspace
            </span>
          </footer>
        </div>
      </main>

      {selectedRecord && (
        <div
          className="auditor-modal-backdrop"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="auditor-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auditor-modal-header">
              <div>
                <span className="auditor-eyebrow">RECORD INSPECTION</span>
                <h3>
                  {selectedRecord._recordType || "Audit Event Details"}
                </h3>
              </div>
              <button
                className="auditor-icon-button"
                onClick={() => setSelectedRecord(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="auditor-detail-content">
              {Object.entries(selectedRecord)
                .filter(([key]) => !key.startsWith("_"))
                .map(([key, value]) => (
                  <div className="auditor-detail-row" key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <strong>
                      {value && typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "—")}
                    </strong>
                  </div>
                ))}
            </div>

            <div className="auditor-modal-footer">
              <span>
                <Eye size={15} /> Inspection only — no changes can be made.
              </span>
              <button
                className="auditor-modal-close"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditorPage;
