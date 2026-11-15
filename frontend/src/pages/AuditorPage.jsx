
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ShieldCheck, ClipboardList, FileSearch, Search,
  RefreshCw, LogOut, ChevronDown, ChevronRight, CalendarDays, Clock3,
  User, Building2, FileText, Eye, Filter, AlertCircle, CheckCircle2,
  XCircle, Activity, Menu, X, Download, LockKeyhole, Database,
  BarChart3, FileSpreadsheet, Users, TrendingUp, ShieldAlert,
  CircleCheck, CircleDollarSign, ArrowUpRight, ListFilter, Server,
  Settings, Bell, SearchCheck, ScrollText
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
  const data = payload?.data;

  if (Array.isArray(data)) return data;

  return (
    data?.items || data?.rows || data?.events || data?.requests ||
    payload?.items || payload?.rows || payload?.events ||
    payload?.requests || []
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

const getDateValue = (item) =>
  item?.created_at || item?.createdAt || item?.timestamp ||
  item?.updated_at || item?.updatedAt;

const getStatus = (item) =>
  String(
    item?.status || item?.action || item?.event_type ||
    item?.eventType || "recorded"
  ).replaceAll("_", " ");

const getActor = (item) =>
  item?.actor_name || item?.actorName || item?.user_name ||
  item?.userName || item?.performed_by || item?.user?.name ||
  item?.actor?.name || "System";

const getDescription = (item) =>
  item?.description || item?.details || item?.message ||
  item?.event_name || item?.eventName || item?.action ||
  "Activity recorded";

const getRecordId = (item) =>
  item?.entity_id || item?.entityId || item?.resource_id ||
  item?.resourceId || item?.request_id || item?.requestId ||
  item?.id || "—";

const getSeverity = (item) => {
  const value = String(
    item?.severity || item?.risk_level || item?.riskLevel || ""
  ).toLowerCase();

  if (["critical", "high", "error", "failed"].includes(value)) return "high";
  if (["medium", "warning"].includes(value)) return "medium";
  return "normal";
};

const getRequestName = (item) =>
  item?.request_number || item?.requestNumber ||
  item?.product_name || item?.productName || item?.title ||
  `Request ${String(item?.id || "").slice(0, 8)}`;

const getRequestAmount = (item) => {
  const amount =
    item?.total_amount ?? item?.totalAmount ??
    item?.estimated_amount ?? item?.estimatedAmount ?? item?.amount;

  if (amount === undefined || amount === null) return "—";

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "—";

  return numericAmount.toLocaleString("en-IN", {
    style: "currency",
    currency: item?.currency || "INR",
    maximumFractionDigits: 2,
  });
};

const getRequestNumericAmount = (item) => {
  const value =
    item?.total_amount ?? item?.totalAmount ??
    item?.estimated_amount ?? item?.estimatedAmount ?? item?.amount;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safeText = (value) =>
  value === null || value === undefined ? "—" : String(value);

const getTabTitle = (tab) => ({
  overview: "Audit Overview",
  logs: "Audit Logs",
  requests: "Procurement Records",
  analytics: "Audit Analytics",
  compliance: "Compliance Center",
  reports: "Reports & Exports",
}[tab] || "Audit Overview");

const AuditorPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [auditLogs, setAuditLogs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [user, setUser] = useState(readUser);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const apiGet = useCallback(async (endpoint) => {
    const token = getToken();

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload?.message || payload?.error ||
        `Request failed with status ${response.status}`
      );
    }

    return payload;
  }, []);

  const loadDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setAuditError("");
    setRequestError("");

    const [userResult, auditResult, requestResult] =
      await Promise.allSettled([
        apiGet("/auth/me"),
        apiGet("/audit?limit=100&offset=0"),
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
      setAuditError(
        auditResult.reason?.message || "Unable to load audit logs."
      );
    }

    if (requestResult.status === "fulfilled") {
      setRequests(getArray(requestResult.value));
    } else {
      setRequestError(
        requestResult.reason?.message || "Unable to load procurement records."
      );
    }

    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [apiGet]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = () => {
    [
      "token", "accessToken", "authToken", "user", "refreshToken",
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    window.location.href = "/login";
  };

  const getUserName = () =>
    user?.full_name || user?.fullName || user?.name ||
    user?.email || "Auditor";

  const getInitials = () =>
    getUserName()
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");

  const allRecords = useMemo(
    () => auditLogs.map((item, index) => ({
      ...item,
      _key: item.id || item.event_id || `audit-${index}`,
    })),
    [auditLogs]
  );

  const isWithinDateFilter = (item) => {
    if (dateFilter === "all") return true;

    const value = getDateValue(item);
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) return false;

    const now = new Date();

    if (dateFilter === "today") {
      return date.toDateString() === now.toDateString();
    }

    const days = dateFilter === "week" ? 7 : 30;
    const from = new Date();
    from.setDate(from.getDate() - days);
    return date >= from && date <= now;
  };

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allRecords.filter((item) => {
      const searchable = [
        getActor(item), getDescription(item), getStatus(item),
        getRecordId(item), item?.entity_type, item?.entityType,
        item?.resource_type, item?.resourceType, item?.module,
        item?.ip_address,
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const severity = getSeverity(item);

      const matchesStatus =
        statusFilter === "all" ||
        getStatus(item).toLowerCase().includes(statusFilter) ||
        severity === statusFilter;

      return matchesSearch && matchesStatus && isWithinDateFilter(item);
    });
  }, [allRecords, search, statusFilter, dateFilter]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((item) => {
      const searchable = [
        item?.id, item?.request_number, item?.requestNumber,
        item?.title, item?.product_name, item?.productName,
        item?.supplier_name, item?.supplierName, item?.status,
        item?.department_name, item?.departmentName,
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        String(item?.status || "").toLowerCase().includes(statusFilter);

      return matchesSearch && matchesStatus && isWithinDateFilter(item);
    });
  }, [requests, search, statusFilter, dateFilter]);

  const todayCount = auditLogs.filter((item) => {
    const value = getDateValue(item);
    return value && new Date(value).toDateString() === new Date().toDateString();
  }).length;

  const highRiskCount = auditLogs.filter(
    (item) => getSeverity(item) === "high"
  ).length;

  const mediumRiskCount = auditLogs.filter(
    (item) => getSeverity(item) === "medium"
  ).length;

  const uniqueActors = new Set(auditLogs.map(getActor)).size;

  const totalRequestValue = requests.reduce(
    (total, item) => total + getRequestNumericAmount(item), 0
  );

  const requestStatuses = useMemo(() => {
    const counts = {};
    requests.forEach((item) => {
      const status = String(item?.status || "Unknown");
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [requests]);

  const actionStats = useMemo(() => {
    const counts = {};
    auditLogs.forEach((item) => {
      const action = getStatus(item).toLowerCase();
      counts[action] = (counts[action] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [auditLogs]);

  const trendStats = useMemo(() => {
    const days = [];

    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);

      const count = auditLogs.filter((item) => {
        const value = getDateValue(item);
        if (!value) return false;
        const eventDate = new Date(value);
        return !Number.isNaN(eventDate.getTime()) &&
          eventDate.toDateString() === date.toDateString();
      }).length;

      days.push({
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        count,
      });
    }

    return days;
  }, [auditLogs]);

  const maxTrend = Math.max(1, ...trendStats.map((item) => item.count));
  const maxAction = Math.max(1, ...actionStats.map((item) => item[1]));
  const maxRequestStatus = Math.max(1, ...requestStatuses.map((item) => item[1]));

  const exportCSV = (records, filename, columns, mapRow) => {
    if (!records.length) return;

    const escapeCSV = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [columns, ...records.map(mapRow)]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditLogs = () => exportCSV(
    filteredLogs,
    `etdox-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Date", "Actor", "Action", "Description", "Record ID", "Severity"],
    (item) => [
      formatDate(getDateValue(item)),
      getActor(item),
      getStatus(item),
      getDescription(item),
      getRecordId(item),
      getSeverity(item),
    ]
  );

  const exportRequests = () => exportCSV(
    filteredRequests,
    `etdox-procurement-records-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Request", "Department", "Supplier", "Amount", "Status", "Created", "ID"],
    (item) => [
      getRequestName(item),
      item?.department_name || item?.departmentName || item?.department || "—",
      item?.supplier_name || item?.supplierName || item?.supplier || "—",
      getRequestAmount(item),
      item?.status || "Unknown",
      formatDate(getDateValue(item)),
      item?.id || item?.request_id || "—",
    ]
  );

  const navGroups = [
    {
      label: "WORKSPACE",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "logs", label: "Audit Logs", icon: ScrollText, count: auditLogs.length },
        { id: "requests", label: "Procurement", icon: ClipboardList, count: requests.length },
      ],
    },
    {
      label: "INTELLIGENCE",
      items: [
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "compliance", label: "Compliance Center", icon: ShieldCheck },
        { id: "reports", label: "Reports & Exports", icon: FileSpreadsheet },
      ],
    },
  ];

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setSearch("");
    setStatusFilter("all");
    setDateFilter("all");
  };

  const renderAuditTable = (records = filteredLogs) => (
    <div className="auditor-table-wrapper">
      <table className="auditor-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Performed By</th>
            <th>Record ID</th>
            <th>Severity</th>
            <th>Date & Time</th>
            <th>Inspect</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item, index) => (
            <tr key={item._key || item.id || index}>
              <td>
                <div className="auditor-activity-cell">
                  <span className="auditor-activity-icon"><Activity size={16} /></span>
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
              <td className="auditor-id-cell">{String(getRecordId(item)).slice(0, 14)}</td>
              <td><span className={`auditor-severity ${getSeverity(item)}`}>{getSeverity(item)}</span></td>
              <td className="auditor-date-cell">{formatDate(getDateValue(item))}</td>
              <td>
                <button className="auditor-icon-button" onClick={() => setSelectedRecord({ ...item, _recordType: "Audit Event" })} title="Inspect event">
                  <Eye size={17} />
                </button>
              </td>
            </tr>
          ))}
          {!loading && records.length === 0 && (
            <tr><td colSpan="6"><EmptyState icon={FileSearch} title="No audit records found" text="Try changing your search or filters." /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderRequestsTable = (records = filteredRequests) => (
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
            <th>Inspect</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item, index) => (
            <tr key={item.id || item.request_id || index}>
              <td>
                <div className="auditor-request-cell">
                  <FileText size={17} />
                  <div>
                    <strong>{getRequestName(item)}</strong>
                    <small>{String(item?.id || item?.request_id || "—").slice(0, 16)}</small>
                  </div>
                </div>
              </td>
              <td>{item?.department_name || item?.departmentName || item?.department || "—"}</td>
              <td>{item?.supplier_name || item?.supplierName || item?.supplier || "—"}</td>
              <td className="auditor-amount">{getRequestAmount(item)}</td>
              <td>
                <span className={`auditor-status ${String(item?.status || "unknown").toLowerCase().replaceAll(" ", "-")}`}>
                  {item?.status || "Unknown"}
                </span>
              </td>
              <td className="auditor-date-cell">{formatDate(getDateValue(item))}</td>
              <td>
                <button className="auditor-icon-button" onClick={() => setSelectedRecord({ ...item, _recordType: "Procurement Request" })} title="Inspect request">
                  <Eye size={17} />
                </button>
              </td>
            </tr>
          ))}
          {!loading && records.length === 0 && (
            <tr><td colSpan="7"><EmptyState icon={ClipboardList} title="No procurement records found" text="Try changing your search or filters." /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderFilters = (placeholder) => (
    <div className="auditor-filter-bar">
      <div className="auditor-search-box">
        <Search size={18} />
        <input
          type="search"
          placeholder={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}
      </div>

      <div className="auditor-filter-control">
        <ListFilter size={16} />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses / events</option>
          <option value="high">High severity</option>
          <option value="medium">Medium severity</option>
          <option value="normal">Normal severity</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      <div className="auditor-filter-control">
        <CalendarDays size={16} />
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="auditor-layout">
      {sidebarOpen && <button className="auditor-mobile-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <aside className={`auditor-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="auditor-brand">
          <div className="auditor-brand-mark"><ShieldCheck size={24} /></div>
          <div><h2>ETDOX</h2><span>TECHNOLOGIES</span></div>
          <button className="auditor-close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={20} /></button>
        </div>

        <div className="auditor-workspace-label">AUDIT WORKSPACE</div>

        <nav className="auditor-nav">
          {navGroups.map((group) => (
            <div className="auditor-nav-group" key={group.label}>
              <span className="auditor-nav-group-label">{group.label}</span>
              {group.items.map(({ id, label, icon: Icon, count }) => (
                <button key={id} className={`auditor-nav-item ${activeTab === id ? "active" : ""}`} onClick={() => changeTab(id)}>
                  <Icon size={18} />
                  <span>{label}</span>
                  {count !== undefined && <span className="auditor-nav-count">{count}</span>}
                  {activeTab === id && <span className="auditor-nav-active-mark" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="auditor-sidebar-divider" />

        <div className="auditor-workspace-label">SECURITY STATUS</div>
        <div className="auditor-compliance-card">
          <div className="auditor-compliance-icon"><LockKeyhole size={18} /></div>
          <strong>Read-only access</strong>
          <p>Your auditor account can inspect available records without changing procurement data.</p>
          <div className="auditor-security-status"><span /> Tenant-scoped session</div>
        </div>

        <div className="auditor-sidebar-bottom">
          <div className="auditor-profile">
            <div className="auditor-avatar">{getInitials()}</div>
            <div className="auditor-profile-info"><strong>{getUserName()}</strong><span>Auditor account</span></div>
            <button className="auditor-logout-button" onClick={handleLogout} title="Logout"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <main className="auditor-main">
        <header className="auditor-topbar">
          <div className="auditor-topbar-left">
            <button className="auditor-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div className="auditor-breadcrumb"><span>ETDOX</span><ChevronRight size={15} /><strong>{getTabTitle(activeTab)}</strong></div>
          </div>

          <div className="auditor-topbar-right">
            <div className="auditor-secure-label"><span className="auditor-secure-dot" /> Secure session</div>
            <button className="auditor-refresh-button" onClick={() => loadDashboard(true)} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "auditor-spin" : ""} /><span>{refreshing ? "Refreshing" : "Refresh"}</span>
            </button>
            <div className="auditor-topbar-user">
              <div className="auditor-avatar small">{getInitials()}</div>
              <div><strong>{getUserName()}</strong><span>Auditor</span></div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        <div className="auditor-content">
          <section className="auditor-page-heading">
            <div>
              <div className="auditor-eyebrow"><ShieldCheck size={15} /> AUDIT & COMPLIANCE</div>
              <h1>{getTabTitle(activeTab)}</h1>
              <p>Monitor procurement activity, inspect records, and review organizational compliance.</p>
              <div className="auditor-heading-meta">
                <span><LockKeyhole size={13} /> Read-only environment</span>
                {lastUpdated && <span><Clock3 size={13} /> Updated {lastUpdated.toLocaleTimeString("en-IN")}</span>}
              </div>
            </div>
            <div className="auditor-heading-actions">
              <div className="auditor-date-display"><CalendarDays size={16} />{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              {activeTab === "logs" && <button className="auditor-export-button" onClick={exportAuditLogs} disabled={!filteredLogs.length}><Download size={17} /> Export CSV</button>}
              {activeTab === "requests" && <button className="auditor-export-button" onClick={exportRequests} disabled={!filteredRequests.length}><Download size={17} /> Export CSV</button>}
            </div>
          </section>

          {(auditError || requestError) && (
            <div className="auditor-warning">
              <AlertCircle size={19} />
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
              <section className="auditor-welcome-banner">
                <div className="auditor-welcome-copy">
                  <span className="auditor-welcome-tag"><ShieldCheck size={14} /> COMPLIANCE WORKSPACE</span>
                  <h2>Good day, {getUserName().split(" ")[0]}.</h2>
                  <p>Your audit workspace is ready. Review recorded activities and inspect procurement records with read-only access.</p>
                </div>
                <div className="auditor-welcome-art"><div className="auditor-art-orbit orbit-one" /><div className="auditor-art-orbit orbit-two" /><div className="auditor-art-shield"><ShieldCheck size={48} /></div></div>
              </section>

              <section className="auditor-stats-grid">
                <StatCard label="Total Audit Events" value={loading ? "—" : auditLogs.length} note="Loaded audit records" icon={Activity} tone="blue" />
                <StatCard label="Today's Events" value={loading ? "—" : todayCount} note="Events recorded today" icon={Clock3} tone="purple" />
                <StatCard label="High-Risk Events" value={loading ? "—" : highRiskCount} note="Explicit severity data" icon={ShieldAlert} tone="red" />
                <StatCard label="Procurement Records" value={loading ? "—" : requests.length} note="Loaded request records" icon={Database} tone="green" />
              </section>

              <section className="auditor-overview-grid">
                <div className="auditor-panel auditor-chart-panel">
                  <PanelHeading title="Activity Trend" subtitle="Audit events recorded over the last seven days" action={() => changeTab("analytics")} actionLabel="Analytics" />
                  <div className="auditor-trend-chart">
                    {trendStats.map((item) => (
                      <div className="auditor-trend-column" key={item.label + item.count}>
                        <span className="auditor-trend-value">{item.count}</span>
                        <div className="auditor-trend-track"><div className="auditor-trend-bar" style={{ height: `${Math.max(item.count ? 8 : 3, (item.count / maxTrend) * 100)}%` }} /></div>
                        <span className="auditor-trend-label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="auditor-chart-footnote"><span><i className="auditor-legend-dot blue-dot" /> Recorded audit events</span><span>Based on currently loaded records</span></div>
                </div>

                <div className="auditor-panel auditor-summary-panel">
                  <PanelHeading title="Audit Snapshot" subtitle="Current loaded dataset" />
                  <div className="auditor-summary-row"><span>Unique actors</span><strong>{loading ? "—" : uniqueActors}</strong></div>
                  <div className="auditor-summary-row"><span>High-risk events</span><strong className="auditor-text-danger">{loading ? "—" : highRiskCount}</strong></div>
                  <div className="auditor-summary-row"><span>Medium-risk events</span><strong>{loading ? "—" : mediumRiskCount}</strong></div>
                  <div className="auditor-summary-row"><span>Request value loaded</span><strong>{loading ? "—" : totalRequestValue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</strong></div>
                  <div className="auditor-readonly-note"><LockKeyhole size={17} /><div><strong>Read-only workspace</strong><span>No write or approval actions are available here.</span></div></div>
                </div>
              </section>

              <section className="auditor-panel auditor-records-panel">
                <PanelHeading title="Recent Audit Activity" subtitle="Latest recorded actions returned by the audit API" action={() => changeTab("logs")} actionLabel="View all logs" />
                {loading ? <LoadingState text="Loading audit activity..." /> : auditLogs.length === 0 ? <EmptyState icon={Activity} title="No audit activity available" text="Audit events will appear when the audit API returns records." /> : (
                  <div className="auditor-recent-list">
                    {auditLogs.slice(0, 6).map((item, index) => (
                      <div className="auditor-recent-item" key={item.id || item.event_id || index}>
                        <div className="auditor-timeline-marker"><span /></div>
                        <div className="auditor-recent-details"><strong>{getDescription(item)}</strong><span>{getActor(item)} · {getStatus(item)}</span></div>
                        <time>{formatDate(getDateValue(item))}</time>
                        <button className="auditor-icon-button" onClick={() => setSelectedRecord({ ...item, _recordType: "Audit Event" })}><Eye size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="auditor-panel auditor-records-panel">
                <PanelHeading title="Recent Procurement Records" subtitle="Purchase requests available for inspection" action={() => changeTab("requests")} actionLabel="View procurement" />
                {loading ? <LoadingState text="Loading procurement records..." /> : requests.length === 0 ? <EmptyState icon={ClipboardList} title="No procurement records available" text="No records were returned by the procurement endpoint." /> : renderRequestsTable(requests.slice(0, 5))}
              </section>
            </>
          )}

          {activeTab === "logs" && (
            <section className="auditor-panel">
              <PanelHeading title="Audit Event Register" subtitle="Search, filter and inspect recorded system activity" count={`${filteredLogs.length} records`} />
              {renderFilters("Search actor, action, record ID...")}
              {loading ? <LoadingState text="Loading audit logs..." /> : renderAuditTable()}
            </section>
          )}

          {activeTab === "requests" && (
            <section className="auditor-panel">
              <PanelHeading title="Procurement Register" subtitle="Inspect purchase requests without changing their status" count={`${filteredRequests.length} records`} />
              {renderFilters("Search requests, suppliers, departments...")}
              {loading ? <LoadingState text="Loading procurement records..." /> : renderRequestsTable()}
            </section>
          )}

          {activeTab === "analytics" && (
            <>
              <section className="auditor-stats-grid">
                <StatCard label="Unique Actors" value={loading ? "—" : uniqueActors} note="Distinct actor labels in audit data" icon={Users} tone="blue" />
                <StatCard label="High-Risk Events" value={loading ? "—" : highRiskCount} note="Explicit high / critical / failed labels" icon={ShieldAlert} tone="red" />
                <StatCard label="Requests Tracked" value={loading ? "—" : requests.length} note="Loaded procurement requests" icon={ClipboardList} tone="purple" />
                <StatCard label="Request Value" value={loading ? "—" : totalRequestValue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} note="Sum of available amount fields" icon={CircleDollarSign} tone="green" />
              </section>

              <section className="auditor-overview-grid">
                <div className="auditor-panel auditor-chart-panel">
                  <PanelHeading title="Seven-Day Activity" subtitle="Daily audit event volume" />
                  <div className="auditor-trend-chart large">
                    {trendStats.map((item) => (
                      <div className="auditor-trend-column" key={item.label + item.count}>
                        <span className="auditor-trend-value">{item.count}</span>
                        <div className="auditor-trend-track"><div className="auditor-trend-bar" style={{ height: `${Math.max(item.count ? 8 : 3, (item.count / maxTrend) * 100)}%` }} /></div>
                        <span className="auditor-trend-label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="auditor-panel auditor-chart-panel">
                  <PanelHeading title="Event Severity" subtitle="Severity fields supplied by audit records" />
                  <div className="auditor-severity-breakdown">
                    <SeverityLine label="High" count={highRiskCount} total={auditLogs.length} tone="red" />
                    <SeverityLine label="Medium" count={mediumRiskCount} total={auditLogs.length} tone="amber" />
                    <SeverityLine label="Normal / unspecified" count={Math.max(0, auditLogs.length - highRiskCount - mediumRiskCount)} total={auditLogs.length} tone="blue" />
                  </div>
                  <p className="auditor-chart-disclaimer">Severity is displayed only from fields returned by the API; unspecified events are not independently classified as safe.</p>
                </div>
              </section>

              <section className="auditor-overview-grid">
                <div className="auditor-panel auditor-chart-panel">
                  <PanelHeading title="Most Common Actions" subtitle="Top action labels in the loaded audit events" />
                  {actionStats.length === 0 ? <EmptyState icon={BarChart3} title="No action data" text="Action distribution will appear when events are available." /> : (
                    <div className="auditor-horizontal-chart">
                      {actionStats.map(([label, count]) => (
                        <div className="auditor-horizontal-row" key={label}>
                          <span title={label}>{label}</span>
                          <div className="auditor-horizontal-track"><div style={{ width: `${(count / maxAction) * 100}%` }} /></div>
                          <strong>{count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="auditor-panel auditor-chart-panel">
                  <PanelHeading title="Request Status Distribution" subtitle="Status values in loaded procurement requests" />
                  {requestStatuses.length === 0 ? <EmptyState icon={ClipboardList} title="No request status data" text="Status distribution will appear when requests are available." /> : (
                    <div className="auditor-horizontal-chart">
                      {requestStatuses.map(([label, count]) => (
                        <div className="auditor-horizontal-row" key={label}>
                          <span title={label}>{label}</span>
                          <div className="auditor-horizontal-track green"><div style={{ width: `${(count / maxRequestStatus) * 100}%` }} /></div>
                          <strong>{count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "compliance" && (
            <section className="auditor-compliance-page">
              <div className="auditor-panel">
                <PanelHeading title="Compliance & Access Controls" subtitle="Visibility into the current auditor workspace configuration" />
                <div className="auditor-compliance-grid">
                  <ComplianceCard icon={LockKeyhole} title="Read-only workspace" text="This page exposes inspection and export actions only. Backend authorization remains responsible for enforcing access." status="Frontend controls enabled" />
                  <ComplianceCard icon={Building2} title="Tenant context" text="The dashboard relies on the authenticated session and backend tenant-scoped queries. It does not select or switch tenants." status="Session based" />
                  <ComplianceCard icon={Database} title="Audit evidence" text={`${auditLogs.length} audit records are currently loaded for this dashboard.`} status={auditError ? "Data unavailable" : "Loaded"} />
                  <ComplianceCard icon={ClipboardList} title="Procurement evidence" text={`${requests.length} procurement records are currently loaded for this dashboard.`} status={requestError ? "Data unavailable" : "Loaded"} />
                </div>
              </div>

              <div className="auditor-panel">
                <PanelHeading title="Review Checklist" subtitle="Suggested manual checks for an audit review" />
                <div className="auditor-checklist">
                  <div><CheckCircle2 size={18} /><span>Confirm the audit event date and actor.</span></div>
                  <div><CheckCircle2 size={18} /><span>Inspect the resource or record identifier.</span></div>
                  <div><CheckCircle2 size={18} /><span>Compare the event with the related procurement request.</span></div>
                  <div><CheckCircle2 size={18} /><span>Review unusual or high-severity events with supporting evidence.</span></div>
                  <div><CheckCircle2 size={18} /><span>Export the filtered records when a review snapshot is required.</span></div>
                </div>
                <p className="auditor-chart-disclaimer">This checklist is a review aid, not a compliance certification or automated security assessment.</p>
              </div>
            </section>
          )}

          {activeTab === "reports" && (
            <section className="auditor-report-grid">
              <div className="auditor-report-card">
                <div className="auditor-report-icon blue"><ScrollText size={23} /></div>
                <span className="auditor-report-tag">AUDIT DATA</span>
                <h3>Audit Event Report</h3>
                <p>Export the currently filtered audit event records, including actor, action, description, record ID, severity and date.</p>
                <div className="auditor-report-meta"><span>{filteredLogs.length} available records</span><span>CSV format</span></div>
                <button className="auditor-export-button full" disabled={!filteredLogs.length} onClick={exportAuditLogs}><Download size={17} /> Export Audit CSV</button>
              </div>

              <div className="auditor-report-card">
                <div className="auditor-report-icon green"><ClipboardList size={23} /></div>
                <span className="auditor-report-tag">PROCUREMENT DATA</span>
                <h3>Procurement Register</h3>
                <p>Export the currently filtered purchase request records, including department, supplier, amount, status and creation date.</p>
                <div className="auditor-report-meta"><span>{filteredRequests.length} available records</span><span>CSV format</span></div>
                <button className="auditor-export-button full" disabled={!filteredRequests.length} onClick={exportRequests}><Download size={17} /> Export Procurement CSV</button>
              </div>

              <div className="auditor-report-note">
                <ShieldCheck size={20} />
                <div><strong>Export integrity note</strong><p>Reports contain only the records currently loaded in this browser session. The current API calls request up to 100 records per dataset; exports are not a complete historical archive unless the backend returns the full dataset.</p></div>
              </div>
            </section>
          )}

          <footer className="auditor-footer">
            <span>© {new Date().getFullYear()} ETDOX Technologies</span>
            <span><LockKeyhole size={13} /> Secure audit workspace</span>
          </footer>
        </div>
      </main>

      {selectedRecord && (
        <div className="auditor-modal-backdrop" onClick={() => setSelectedRecord(null)}>
          <div className="auditor-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auditor-modal-header">
              <div><span className="auditor-eyebrow">RECORD INSPECTION</span><h3>{selectedRecord._recordType || "Record Details"}</h3></div>
              <button className="auditor-icon-button" onClick={() => setSelectedRecord(null)} aria-label="Close details"><X size={20} /></button>
            </div>
            <div className="auditor-detail-content">
              {Object.entries(selectedRecord)
                .filter(([key]) => !key.startsWith("_"))
                .map(([key, value]) => (
                  <div className="auditor-detail-row" key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <strong>{value && typeof value === "object" ? JSON.stringify(value) : safeText(value)}</strong>
                  </div>
                ))}
            </div>
            <div className="auditor-modal-footer">
              <span><Eye size={15} /> Inspection only — no changes can be made.</span>
              <button className="auditor-modal-close" onClick={() => setSelectedRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StatCard({ label, value, note, icon: Icon, tone }) {
  return (
    <div className="auditor-stat-card">
      <div className="auditor-stat-top"><span>{label}</span><div className={`auditor-stat-icon ${tone}`}><Icon size={20} /></div></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function PanelHeading({ title, subtitle, action, actionLabel, count }) {
  return (
    <div className="auditor-panel-heading">
      <div><h3>{title}</h3><p>{subtitle}</p></div>
      {count && <span className="auditor-record-count">{count}</span>}
      {action && <button className="auditor-text-button" onClick={action}>{actionLabel}<ChevronRight size={16} /></button>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="auditor-empty"><Icon size={30} /><strong>{title}</strong><span>{text}</span></div>;
}

function LoadingState({ text }) {
  return <div className="auditor-loading"><RefreshCw size={17} className="auditor-spin" />{text}</div>;
}

function SeverityLine({ label, count, total, tone }) {
  const percentage = total ? (count / total) * 100 : 0;
  return (
    <div className="auditor-severity-line">
      <div><span>{label}</span><strong>{count}</strong></div>
      <div className="auditor-severity-track"><span className={tone} style={{ width: `${percentage}%` }} /></div>
    </div>
  );
}

function ComplianceCard({ icon: Icon, title, text, status }) {
  return (
    <div className="auditor-compliance-feature">
      <div className="auditor-compliance-feature-icon"><Icon size={20} /></div>
      <div><h4>{title}</h4><p>{text}</p><span><i />{status}</span></div>
    </div>
  );
}

export default AuditorPage;
