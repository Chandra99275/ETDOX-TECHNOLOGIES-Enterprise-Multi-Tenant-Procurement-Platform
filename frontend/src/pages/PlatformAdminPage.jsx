
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Activity,
  Search,
  RefreshCw,
  LogOut,
  Menu,
  X,
  Bell,
  Server,
  Database,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ChevronRight,
  Eye,
  Layers3,
  LockKeyhole,
  Cpu,
  HardDrive,
  CalendarDays,
  ArrowUpRight,
  CircleHelp,
} from "lucide-react";

import "./PlatformAdminPage.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken");

const unwrapList = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  const candidates = [
    response?.data,
    response?.data?.data,
    response?.items,
    response?.results,
    ...keys.map((key) => response?.[key]),
    ...keys.map((key) => response?.data?.[key]),
  ];

  return candidates.find(Array.isArray) || [];
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

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN").format(Number(value || 0));

const statusClass = (status) => {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("active") ||
    value.includes("healthy") ||
    value.includes("success") ||
    value.includes("verified") ||
    value.includes("completed")
  ) {
    return "success";
  }

  if (
    value.includes("suspend") ||
    value.includes("inactive") ||
    value.includes("failed") ||
    value.includes("critical") ||
    value.includes("blocked")
  ) {
    return "danger";
  }

  if (
    value.includes("pending") ||
    value.includes("warning") ||
    value.includes("review") ||
    value.includes("trial")
  ) {
    return "warning";
  }

  return "neutral";
};

function PlatformStatus({ status }) {
  return (
    <span className={`platform-status platform-status-${statusClass(status)}`}>
      <span className="platform-status-dot" />
      {String(status || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="platform-empty">
      <div className="platform-empty-icon">
        <Layers3 size={23} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default function PlatformAdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [overview, setOverview] = useState({});
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [systemHealth, setSystemHealth] = useState({});

  const [platformUser, setPlatformUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordType, setRecordType] = useState("");

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    }),
    []
  );

  const apiGet = useCallback(
    async (path) => {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Request failed (${response.status})`
        );
      }

      return result;
    },
    [headers]
  );

  const loadPlatformData = useCallback(
    async (isRefresh = false) => {
      if (!getToken()) {
        setError("Your session has expired. Please sign in again.");
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const results = await Promise.allSettled([
        apiGet("/auth/me"),
        apiGet("/platform/overview"),
        apiGet("/platform/tenants?limit=100&offset=0"),
        apiGet("/platform/users?limit=100&offset=0"),
        apiGet("/platform/audit-events?limit=100&offset=0"),
        apiGet("/platform/system/health"),
      ]);

      const [
        userResult,
        overviewResult,
        tenantResult,
        userListResult,
        auditResult,
        healthResult,
      ] = results;

      if (userResult.status === "fulfilled") {
        const data =
          userResult.value?.user ||
          userResult.value?.data?.user ||
          userResult.value?.data ||
          userResult.value;

        setPlatformUser(data);
      }

      if (overviewResult.status === "fulfilled") {
        setOverview(
          overviewResult.value?.overview ||
            overviewResult.value?.data?.overview ||
            overviewResult.value?.data ||
            overviewResult.value ||
            {}
        );
      } else {
        setOverview({});
      }

      if (tenantResult.status === "fulfilled") {
        setTenants(unwrapList(tenantResult.value, ["tenants", "items"]));
      } else {
        setTenants([]);
      }

      if (userListResult.status === "fulfilled") {
        setUsers(unwrapList(userListResult.value, ["users", "items"]));
      } else {
        setUsers([]);
      }

      if (auditResult.status === "fulfilled") {
        setAuditEvents(
          unwrapList(auditResult.value, ["events", "auditEvents", "items"])
        );
      } else {
        setAuditEvents([]);
      }

      if (healthResult.status === "fulfilled") {
        setSystemHealth(
          healthResult.value?.health ||
            healthResult.value?.data?.health ||
            healthResult.value?.data ||
            healthResult.value ||
            {}
        );
      } else {
        setSystemHealth({});
      }

      const failed = results.filter((item) => item.status === "rejected");

      if (failed.length === results.length) {
        setError(
          "Unable to load platform data. Verify the platform API routes and your platform administrator session."
        );
      } else if (failed.length > 0) {
        setError(
          "Some platform sections could not be loaded. Check the API routes listed in the integration notes."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [apiGet]
  );

  useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  const adminName =
    platformUser?.fullName ||
    platformUser?.name ||
    platformUser?.user?.fullName ||
    platformUser?.email ||
    "Platform Administrator";

  const filteredTenants = tenants.filter((tenant) => {
    const search = searchTerm.toLowerCase();

    return (
      String(tenant.name || tenant.companyName || "")
        .toLowerCase()
        .includes(search) ||
      String(tenant.slug || tenant.code || "")
        .toLowerCase()
        .includes(search) ||
      String(tenant.status || "").toLowerCase().includes(search)
    );
  });

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();

    return (
      String(user.name || user.fullName || "")
        .toLowerCase()
        .includes(search) ||
      String(user.email || "").toLowerCase().includes(search) ||
      String(user.role || user.roleName || "").toLowerCase().includes(search) ||
      String(user.tenantName || user.tenant_name || "")
        .toLowerCase()
        .includes(search)
    );
  });

  const filteredAuditEvents = auditEvents.filter((event) => {
    const search = searchTerm.toLowerCase();

    return (
      String(event.action || event.eventType || event.event_type || "")
        .toLowerCase()
        .includes(search) ||
      String(event.actorEmail || event.actor_email || event.userEmail || "")
        .toLowerCase()
        .includes(search) ||
      String(event.description || event.resource || "")
        .toLowerCase()
        .includes(search)
    );
  });

  const tenantCount =
    overview.totalTenants ??
    overview.total_tenants ??
    overview.tenantCount ??
    tenants.length;

  const userCount =
    overview.totalUsers ??
    overview.total_users ??
    overview.userCount ??
    users.length;

  const activeTenantCount =
    overview.activeTenants ??
    overview.active_tenants ??
    tenants.filter((tenant) =>
      String(tenant.status || "").toLowerCase().includes("active")
    ).length;

  const eventCount =
    overview.auditEvents ??
    overview.totalAuditEvents ??
    overview.total_audit_events ??
    auditEvents.length;

  const activeUsers =
    overview.activeUsers ??
    overview.active_users ??
    users.filter((user) =>
      String(user.status || "").toLowerCase().includes("active")
    ).length;

  const navigation = [
    { id: "overview", label: "Platform Overview", icon: LayoutDashboard },
    { id: "tenants", label: "Tenant Organizations", icon: Building2 },
    { id: "users", label: "Platform Users", icon: Users },
    { id: "audit", label: "Audit & Security", icon: ShieldCheck },
    { id: "system", label: "System Health", icon: Activity },
  ];

  const pageInfo = {
    overview: [
      "Platform Overview",
      "Monitor the health and activity of the ETDOX platform.",
    ],
    tenants: [
      "Tenant Organizations",
      "View organizations registered across the ETDOX platform.",
    ],
    users: [
      "Platform Users",
      "Review user accounts across all registered tenants.",
    ],
    audit: [
      "Audit & Security",
      "Review platform-wide security and audit activity.",
    ],
    system: [
      "System Health",
      "Monitor infrastructure and service availability.",
    ],
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setSidebarOpen(false);
  };

  const logout = () => {
    [
      "token",
      "accessToken",
      "authToken",
      "refreshToken",
      "user",
    ].forEach((key) => localStorage.removeItem(key));

    window.location.href = "/login";
  };

  const openRecord = (record, type) => {
    setSelectedRecord(record);
    setRecordType(type);
  };

  const renderTenantsTable = (items) => (
    <div className="platform-table-wrap">
      <table className="platform-table">
        <thead>
          <tr>
            <th>ORGANIZATION</th>
            <th>TENANT IDENTIFIER</th>
            <th>PLAN</th>
            <th>CREATED</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {items.map((tenant, index) => (
            <tr key={tenant.id || tenant.tenantId || index}>
              <td>
                <div className="platform-primary-cell">
                  <div className="platform-table-avatar">
                    {String(tenant.name || tenant.companyName || "T")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <strong>
                      {tenant.name || tenant.companyName || "Unnamed organization"}
                    </strong>
                    <span>{tenant.domain || tenant.email || "—"}</span>
                  </div>
                </div>
              </td>
              <td>
                <span className="platform-id">
                  {tenant.slug ||
                    tenant.code ||
                    tenant.id ||
                    tenant.tenantId ||
                    "—"}
                </span>
              </td>
              <td>{tenant.planName || tenant.plan_name || tenant.plan || "—"}</td>
              <td>{formatDate(tenant.createdAt || tenant.created_at)}</td>
              <td><PlatformStatus status={tenant.status} /></td>
              <td>
                <button
                  className="platform-view-btn"
                  onClick={() => openRecord(tenant, "Tenant details")}
                >
                  <Eye size={14} /> View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState
          title="No tenant organizations found"
          description="Registered tenant organizations will appear here."
        />
      )}
    </div>
  );

  const renderUsersTable = (items) => (
    <div className="platform-table-wrap">
      <table className="platform-table">
        <thead>
          <tr>
            <th>USER</th>
            <th>ROLE</th>
            <th>ORGANIZATION</th>
            <th>LAST LOGIN</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {items.map((user, index) => (
            <tr key={user.id || user.userId || index}>
              <td>
                <div className="platform-primary-cell">
                  <div className="platform-table-avatar user">
                    {String(user.name || user.fullName || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <strong>{user.name || user.fullName || "Unnamed user"}</strong>
                    <span>{user.email || "—"}</span>
                  </div>
                </div>
              </td>
              <td>
                <span className="platform-role-label">
                  {user.roleName || user.role_name || user.role || "—"}
                </span>
              </td>
              <td>{user.tenantName || user.tenant_name || "—"}</td>
              <td>{formatDate(user.lastLogin || user.last_login)}</td>
              <td><PlatformStatus status={user.status} /></td>
              <td>
                <button
                  className="platform-view-btn"
                  onClick={() => openRecord(user, "User details")}
                >
                  <Eye size={14} /> View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState
          title="No platform users found"
          description="User accounts from registered tenants will appear here."
        />
      )}
    </div>
  );

  const renderAuditTable = (items) => (
    <div className="platform-table-wrap">
      <table className="platform-table">
        <thead>
          <tr>
            <th>EVENT</th>
            <th>ACTOR</th>
            <th>RESOURCE</th>
            <th>IP ADDRESS</th>
            <th>DATE & TIME</th>
            <th>SEVERITY</th>
          </tr>
        </thead>
        <tbody>
          {items.map((event, index) => (
            <tr key={event.id || event.eventId || index}>
              <td>
                <div className="platform-primary-cell">
                  <strong>
                    {event.action ||
                      event.eventType ||
                      event.event_type ||
                      "Platform event"}
                  </strong>
                  <span>{event.description || event.message || "—"}</span>
                </div>
              </td>
              <td>
                {event.actorEmail ||
                  event.actor_email ||
                  event.userEmail ||
                  event.user_email ||
                  "System"}
              </td>
              <td>{event.resource || event.resourceType || "—"}</td>
              <td>{event.ipAddress || event.ip_address || "—"}</td>
              <td>{formatDate(event.createdAt || event.created_at || event.timestamp)}</td>
              <td>
                <PlatformStatus
                  status={event.severity || event.level || event.status || "Info"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState
          title="No audit events found"
          description="Platform security and activity events will appear here."
        />
      )}
    </div>
  );

  const serviceItems = [
    {
      name: "Application API",
      value: systemHealth.api?.status || systemHealth.apiStatus || systemHealth.api_status,
      detail: systemHealth.api?.message || "API service status",
      icon: Server,
    },
    {
      name: "Database",
      value:
        systemHealth.database?.status ||
        systemHealth.databaseStatus ||
        systemHealth.database_status,
      detail: systemHealth.database?.message || "Database connectivity",
      icon: Database,
    },
    {
      name: "Storage",
      value:
        systemHealth.storage?.status ||
        systemHealth.storageStatus ||
        systemHealth.storage_status,
      detail: systemHealth.storage?.message || "File storage service",
      icon: HardDrive,
    },
    {
      name: "Background Jobs",
      value:
        systemHealth.jobs?.status ||
        systemHealth.jobsStatus ||
        systemHealth.jobs_status,
      detail: systemHealth.jobs?.message || "Background worker status",
      icon: Cpu,
    },
  ];

  if (loading) {
    return (
      <div className="platform-loading-screen">
        <div className="platform-loader" />
        <p>Loading ETDOX platform workspace...</p>
      </div>
    );
  }

  return (
    <div className="platform-app">
      {sidebarOpen && (
        <button
          className="platform-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`platform-sidebar ${
          sidebarOpen ? "platform-sidebar-open" : ""
        }`}
      >
        <div className="platform-brand">
          <div className="platform-brand-mark">
            <Globe size={22} />
          </div>
          <div>
            <strong>ETDOX</strong>
            <span>Platform Console</span>
          </div>
          <button
            className="platform-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="platform-console-label">GLOBAL ADMINISTRATION</div>

        <nav className="platform-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`platform-nav-item ${
                  activeTab === item.id ? "active" : ""
                }`}
                onClick={() => changeTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="platform-sidebar-bottom">
          <div className="platform-access-card">
            <div className="platform-access-icon">
              <LockKeyhole size={17} />
            </div>
            <strong>Platform-level access</strong>
            <p>
              Global operations console. All actions should be authorized by
              platform-level permissions.
            </p>
          </div>

          <button className="platform-logout" onClick={logout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="platform-main">
        <header className="platform-topbar">
          <div className="platform-topbar-left">
            <button
              className="platform-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="platform-breadcrumb">
              <span>Platform Console</span>
              <ChevronRight size={14} />
              <strong>{pageInfo[activeTab][0]}</strong>
            </div>
          </div>

          <div className="platform-topbar-right">
            <button
              className="platform-icon-button"
              onClick={() => loadPlatformData(true)}
              title="Refresh platform data"
              disabled={refreshing}
            >
              <RefreshCw
                size={18}
                className={refreshing ? "platform-spin" : ""}
              />
            </button>

            <div className="platform-topbar-divider" />

            <div className="platform-admin-user">
              <div className="platform-admin-avatar">
                {String(adminName).charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{adminName}</strong>
                <span>Platform Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <div className="platform-content">
          <section className="platform-page-heading">
            <div>
              <div className="platform-eyebrow">
                ETDOX / GLOBAL OPERATIONS
              </div>
              <h1>{pageInfo[activeTab][0]}</h1>
              <p>{pageInfo[activeTab][1]}</p>
            </div>

            <span className="platform-date-label">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </section>

          {error && (
            <div className="platform-alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button onClick={() => loadPlatformData(true)}>Retry</button>
            </div>
          )}

          {activeTab === "overview" && (
            <>
              <section className="platform-welcome-card">
                <div>
                  <span>GLOBAL PLATFORM CONTROL</span>
                  <h2>Welcome to ETDOX Platform Console</h2>
                  <p>
                    Monitor tenant organizations, user accounts, platform
                    security and service availability from one workspace.
                  </p>
                </div>
                <div className="platform-welcome-art">
                  <Globe size={72} strokeWidth={1.2} />
                </div>
              </section>

              <section className="platform-stats-grid">
                <div className="platform-stat-card">
                  <div className="platform-stat-top">
                    <span>Total Organizations</span>
                    <div className="platform-stat-icon blue">
                      <Building2 size={20} />
                    </div>
                  </div>
                  <strong>{formatNumber(tenantCount)}</strong>
                  <small>Registered tenant organizations</small>
                </div>

                <div className="platform-stat-card">
                  <div className="platform-stat-top">
                    <span>Active Organizations</span>
                    <div className="platform-stat-icon green">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                  <strong>{formatNumber(activeTenantCount)}</strong>
                  <small>Organizations currently active</small>
                </div>

                <div className="platform-stat-card">
                  <div className="platform-stat-top">
                    <span>Total Platform Users</span>
                    <div className="platform-stat-icon purple">
                      <Users size={20} />
                    </div>
                  </div>
                  <strong>{formatNumber(userCount)}</strong>
                  <small>{formatNumber(activeUsers)} active user accounts</small>
                </div>

                <div className="platform-stat-card">
                  <div className="platform-stat-top">
                    <span>Audit Events</span>
                    <div className="platform-stat-icon orange">
                      <ShieldCheck size={20} />
                    </div>
                  </div>
                  <strong>{formatNumber(eventCount)}</strong>
                  <small>Platform activity records</small>
                </div>
              </section>

              <section className="platform-dashboard-grid">
                <div className="platform-panel">
                  <div className="platform-panel-heading">
                    <div>
                      <h3>Recent Tenant Organizations</h3>
                      <p>Latest organizations registered on the platform</p>
                    </div>
                    <button
                      className="platform-text-link"
                      onClick={() => changeTab("tenants")}
                    >
                      View all <ChevronRight size={15} />
                    </button>
                  </div>
                  {renderTenantsTable(tenants.slice(0, 5))}
                </div>

                <div className="platform-panel platform-quick-panel">
                  <div className="platform-panel-heading">
                    <div>
                      <h3>Platform Snapshot</h3>
                      <p>Current platform indicators</p>
                    </div>
                  </div>

                  <div className="platform-snapshot-item">
                    <div className="platform-snapshot-icon blue">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <strong>{formatNumber(tenantCount)} organizations</strong>
                      <span>Tenant registry</span>
                    </div>
                  </div>

                  <div className="platform-snapshot-item">
                    <div className="platform-snapshot-icon purple">
                      <Users size={18} />
                    </div>
                    <div>
                      <strong>{formatNumber(userCount)} users</strong>
                      <span>Across tenant accounts</span>
                    </div>
                  </div>

                  <div className="platform-snapshot-item">
                    <div className="platform-snapshot-icon green">
                      <Activity size={18} />
                    </div>
                    <div>
                      <strong>
                        {systemHealth.status ||
                          systemHealth.overallStatus ||
                          systemHealth.overall_status ||
                          "Not reported"}
                      </strong>
                      <span>Reported system health</span>
                    </div>
                  </div>

                  <div className="platform-snapshot-note">
                    <CircleHelp size={16} />
                    <span>
                      Metrics depend on the platform API response and are not
                      estimated by the dashboard.
                    </span>
                  </div>
                </div>
              </section>

              <section className="platform-panel">
                <div className="platform-panel-heading">
                  <div>
                    <h3>Recent Security & Audit Activity</h3>
                    <p>Latest platform-wide events</p>
                  </div>
                  <button
                    className="platform-text-link"
                    onClick={() => changeTab("audit")}
                  >
                    View audit log <ChevronRight size={15} />
                  </button>
                </div>
                {renderAuditTable(auditEvents.slice(0, 5))}
              </section>
            </>
          )}

          {activeTab === "tenants" && (
            <section className="platform-panel">
              <div className="platform-panel-heading platform-list-heading">
                <div>
                  <h3>Tenant Organizations</h3>
                  <p>Platform-wide organization directory.</p>
                </div>
                <div className="platform-search">
                  <Search size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search organizations..."
                  />
                </div>
              </div>
              {renderTenantsTable(filteredTenants)}
            </section>
          )}

          {activeTab === "users" && (
            <section className="platform-panel">
              <div className="platform-panel-heading platform-list-heading">
                <div>
                  <h3>Platform Users</h3>
                  <p>Directory of user accounts across all tenants.</p>
                </div>
                <div className="platform-search">
                  <Search size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search users..."
                  />
                </div>
              </div>
              {renderUsersTable(filteredUsers)}
            </section>
          )}

          {activeTab === "audit" && (
            <section className="platform-panel">
              <div className="platform-panel-heading platform-list-heading">
                <div>
                  <h3>Platform Audit Events</h3>
                  <p>Security, authentication and platform activity records.</p>
                </div>
                <div className="platform-search">
                  <Search size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search audit events..."
                  />
                </div>
              </div>
              {renderAuditTable(filteredAuditEvents)}
            </section>
          )}

          {activeTab === "system" && (
            <>
              <section className="platform-system-banner">
                <div className="platform-system-banner-icon">
                  <Activity size={24} />
                </div>
                <div>
                  <strong>System health report</strong>
                  <p>
                    Service status is displayed only when reported by the
                    platform health API.
                  </p>
                </div>
                <PlatformStatus
                  status={
                    systemHealth.status ||
                    systemHealth.overallStatus ||
                    systemHealth.overall_status ||
                    "Not reported"
                  }
                />
              </section>

              <section className="platform-service-grid">
                {serviceItems.map((service) => {
                  const Icon = service.icon;

                  return (
                    <div className="platform-service-card" key={service.name}>
                      <div className="platform-service-top">
                        <div className="platform-service-icon">
                          <Icon size={21} />
                        </div>
                        <PlatformStatus status={service.value || "Not reported"} />
                      </div>
                      <h3>{service.name}</h3>
                      <p>{service.detail}</p>
                    </div>
                  );
                })}
              </section>

              <section className="platform-panel">
                <div className="platform-panel-heading">
                  <div>
                    <h3>System Information</h3>
                    <p>Additional health information returned by the API.</p>
                  </div>
                </div>

                <div className="platform-system-details">
                  <div>
                    <span>Overall status</span>
                    <strong>
                      {systemHealth.status ||
                        systemHealth.overallStatus ||
                        systemHealth.overall_status ||
                        "Not reported"}
                    </strong>
                  </div>
                  <div>
                    <span>API version</span>
                    <strong>
                      {systemHealth.version ||
                        systemHealth.apiVersion ||
                        systemHealth.api_version ||
                        "Not reported"}
                    </strong>
                  </div>
                  <div>
                    <span>Environment</span>
                    <strong>
                      {systemHealth.environment || "Not reported"}
                    </strong>
                  </div>
                  <div>
                    <span>Last checked</span>
                    <strong>
                      {formatDate(
                        systemHealth.checkedAt ||
                          systemHealth.checked_at ||
                          systemHealth.timestamp
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Uptime</span>
                    <strong>
                      {systemHealth.uptime || "Not reported"}
                    </strong>
                  </div>
                  <div>
                    <span>Database latency</span>
                    <strong>
                      {systemHealth.database?.latency ??
                        systemHealth.databaseLatency ??
                        systemHealth.database_latency ??
                        "Not reported"}
                      {typeof (
                        systemHealth.database?.latency ??
                        systemHealth.databaseLatency ??
                        systemHealth.database_latency
                      ) === "number"
                        ? " ms"
                        : ""}
                    </strong>
                  </div>
                </div>
              </section>
            </>
          )}

          <footer className="platform-footer">
            <span>© {new Date().getFullYear()} ETDOX Technologies</span>
            <span>Platform Administration · Global operations</span>
          </footer>
        </div>
      </main>

      {selectedRecord && (
        <div
          className="platform-modal-backdrop"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="platform-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="platform-modal-header">
              <div>
                <span>PLATFORM DIRECTORY</span>
                <h2>{recordType}</h2>
                <p>Read-only record details</p>
              </div>
              <button
                className="platform-modal-close"
                onClick={() => setSelectedRecord(null)}
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </div>

            <div className="platform-record-details">
              {Object.entries(selectedRecord)
                .filter(
                  ([key, value]) =>
                    value !== null &&
                    value !== undefined &&
                    typeof value !== "object" &&
                    !String(key).toLowerCase().includes("password") &&
                    !String(key).toLowerCase().includes("secret") &&
                    !String(key).toLowerCase().includes("token")
                )
                .map(([key, value]) => (
                  <div className="platform-record-row" key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
            </div>

            <div className="platform-modal-actions">
              <button
                className="platform-modal-done"
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
}
