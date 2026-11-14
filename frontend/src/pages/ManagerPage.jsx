import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LayoutDashboard, ClipboardList, CheckCircle2, XCircle, Clock, Search,
  Bell, LogOut, Menu, X, Eye, Check, Ban, RefreshCw, Building2,
  AlertCircle, ChevronDown, Download, Filter, ArrowUpDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./ManagerPage.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1").replace(/\/+$/, "");

const getToken = () =>
  localStorage.getItem("accessToken") || localStorage.getItem("authToken") ||
  localStorage.getItem("token") || sessionStorage.getItem("accessToken") ||
  sessionStorage.getItem("authToken") || sessionStorage.getItem("token") || "";

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
  return Array.isArray(response?.data) ? response.data : [];
};

const formatCurrency = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN");
};

const getStatus = (request) =>
  String(request.status || request.requestStatus || request.request_status || "PENDING_MANAGER")
    .toUpperCase().replaceAll(" ", "_");

const getEmployee = (request) => {
  const employee = request.employee || request.requester || request.user || {};
  const nestedName = [employee.firstName || employee.first_name, employee.lastName || employee.last_name]
    .filter(Boolean).join(" ");
  return request.employeeName || request.employee_name || employee.name ||
    employee.fullName || employee.full_name || nestedName ||
    request.createdByName || request.created_by_name || "Employee";
};

const getProduct = (request) =>
  request.productName || request.product_name || request.title ||
  request.itemName || request.item_name || "Product request";

const getAmount = (request) =>
  Number(request.totalAmount ?? request.total_amount ?? request.amount ??
    (Number(request.quantity || 0) * Number(request.unitPrice || request.unit_price || 0)) ?? 0);

const getRequestId = (request) => request.id || request.requestId || request.request_id;
const getSupplier = (request) => request.supplierName || request.supplier_name || request.supplier || "—";
const getDepartment = (request) => {
  const department = request.department;
  if (department && typeof department === "object") return department.name || "—";
  return department || request.departmentName || request.department_name || "—";
};
const getRequestDate = (request) =>
  request.createdAt || request.created_at || request.submittedAt || request.submitted_at;

const FINANCE_PENDING_STATUSES = ["MANAGER_APPROVED", "PENDING_FINANCE"];
const APPROVED_STATUSES = ["MANAGER_APPROVED", "FINANCE_APPROVED", "APPROVED", "COMPLETED"];
const REJECTED_STATUSES = ["MANAGER_REJECTED", "FINANCE_REJECTED", "REJECTED"];

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

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const token = getToken();
    const method = (options.method || "GET").toUpperCase();
    const requestId = createRequestId();
    if (!token) {
      const authError = new Error("Your session has expired. Please log in again.");
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
      const err = new Error(`Cannot connect to ETDOX backend. ${networkError.message}`);
      err.endpoint = endpoint;
      throw err;
    }
    const responseText = await response.text();
    let data = {};
    try { data = responseText ? JSON.parse(responseText) : {}; }
    catch { data = { rawResponse: responseText }; }
    if (!response.ok) {
      const err = new Error(data.message || data.error || data.details ||
        data.rawResponse || `Request failed with status ${response.status}`);
      err.status = response.status;
      err.endpoint = endpoint;
      err.requestId = requestId;
      err.serverRequestId = response.headers.get("x-request-id") ||
        data.requestId || data.request_id || null;
      err.response = data;
      if (response.status === 401) err.message = "Session expired. Please log in again.";
      throw err;
    }
    return data;
  }, []);

  const logout = useCallback(() => {
    ["token", "accessToken", "authToken", "user"].forEach((key) => {
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
        setRequests(getArray(requestResult.value, ["requests", "items", "results"]));
      } else {
        setRequests([]);
        setError(`Unable to load procurement requests: ${requestResult.reason?.message || "Unknown error"}`);
      }
      if (taskResult.status === "fulfilled") {
        const tasks = getArray(taskResult.value, ["tasks", "items", "results"]);
        setPendingTasks(tasks.filter((task) =>
          String(task.status || "").toUpperCase() === "PENDING" &&
          String(task.resource_type || task.resourceType || "").toLowerCase() === "purchase_request" &&
          Boolean(task.id) && Boolean(task.resource_id || task.resourceId)
        ));
      } else {
        setPendingTasks([]);
        setError((old) => [old, `Unable to load approval tasks: ${taskResult.reason?.message || "Unknown error"}`].filter(Boolean).join(" | "));
      }
      if (userResult.status === "fulfilled") {
        const response = userResult.value;
        const user = response?.user || response?.data?.user || response?.data || response;
        const name = user?.name || user?.fullName || user?.full_name ||
          [user?.firstName || user?.first_name, user?.lastName || user?.last_name].filter(Boolean).join(" ");
        if (name) setManagerName(name);
      }
    } catch (err) {
      setError(err.message || "Unable to load manager dashboard.");
      if (err.status === 401 || /session expired|log in again/i.test(err.message)) logout();
    } finally {
      setLoading(false);
    }
  }, [apiRequest, logout]);

  useEffect(() => {
    if (!getToken()) { navigate("/login"); return; }
    loadDashboard();
  }, [loadDashboard, navigate]);

  const managerPending = useMemo(() => {
    const requestMap = new Map(requests.filter((r) => getRequestId(r))
      .map((r) => [String(getRequestId(r)), r]));
    return pendingTasks.map((task) => {
      const id = String(task.resource_id || task.resourceId);
      const existing = requestMap.get(id);
      return existing
        ? { ...existing, workflowTaskId: task.id, workflowTask: task }
        : {
            id, request_number: task.request_number, total_amount: task.total_amount,
            currency: task.currency, requester_id: task.requester_id,
            status: "IN_APPROVAL", workflowTaskId: task.id, workflowTask: task,
          };
    });
  }, [requests, pendingTasks]);

  const requestsWithTasks = useMemo(() => {
    const taskMap = new Map(pendingTasks.map((task) =>
      [String(task.resource_id || task.resourceId), task]));
    const enriched = requests.map((request) => {
      const task = taskMap.get(String(getRequestId(request)));
      return task ? { ...request, workflowTaskId: task.id, workflowTask: task } : request;
    });
    const ids = new Set(enriched.map((r) => String(getRequestId(r))));
    return [...enriched, ...managerPending.filter((r) => !ids.has(String(getRequestId(r))))];
  }, [requests, pendingTasks, managerPending]);

  const financePending = useMemo(() => requests.filter((r) =>
    FINANCE_PENDING_STATUSES.includes(getStatus(r))), [requests]);
  const approvedRequests = useMemo(() => requests.filter((r) =>
    APPROVED_STATUSES.includes(getStatus(r))), [requests]);
  const rejectedRequests = useMemo(() => requests.filter((r) =>
    REJECTED_STATUSES.includes(getStatus(r))), [requests]);

  const filteredRequests = useMemo(() => {
    let list = requestsWithTasks;
    if (activeTab === "Pending Requests") list = managerPending;
    if (activeTab === "Approval History") {
      list = requestsWithTasks.filter((r) =>
        [...APPROVED_STATUSES, ...REJECTED_STATUSES].includes(getStatus(r)));
    }
    if (statusFilter !== "ALL") list = list.filter((r) => getStatus(r) === statusFilter);
    const query = search.toLowerCase().trim();
    if (query) {
      list = list.filter((r) => [
        getEmployee(r), getProduct(r), getSupplier(r), getDepartment(r),
        getRequestId(r), r.request_number, r.employeeEmail, r.employee_email,
        r.requester?.email, r.description, r.justification,
      ].filter(Boolean).join(" ").toLowerCase().includes(query));
    }
    return [...list].sort((a, b) => {
      if (sortBy === "amount-high") return getAmount(b) - getAmount(a);
      if (sortBy === "amount-low") return getAmount(a) - getAmount(b);
      const diff = new Date(getRequestDate(b) || 0) - new Date(getRequestDate(a) || 0);
      return sortBy === "oldest" ? -diff : diff;
    });
  }, [requestsWithTasks, activeTab, statusFilter, search, managerPending, sortBy]);

  const openDecision = (request, action) => {
    if (!request.workflowTaskId) {
      setError("No pending workflow task is assigned to this request.");
      return;
    }
    setSelectedRequest(request);
    setDecision(action);
    setReason("");
    setError("");
    setSuccess("");
  };

  const submitDecision = async () => {
    if (!selectedRequest || !decision || submitting) return;
    if (decision === "reject" && !reason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }
    const taskId = selectedRequest.workflowTaskId;
    if (!taskId) { setError("Workflow task ID is missing. Refresh and try again."); return; }
    setSubmitting(true);
    setError("");
    setSuccess("");
    const action = decision === "approve" ? "approve" : "reject";
    try {
      await apiRequest(`/workflows/tasks/${encodeURIComponent(taskId)}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, comment: reason.trim() }),
      });
      setSelectedRequest(null);
      setDecision("");
      setReason("");
      setSuccess(action === "approve"
        ? "Request approved successfully. The workflow has advanced to the next stage."
        : "Request rejected successfully.");
      await loadDashboard();
    } catch (err) {
      setError(`${err.message || "Unable to submit manager decision."}${err.status ? ` (HTTP ${err.status})` : ""}${err.serverRequestId ? ` | Server Request ID: ${err.serverRequestId}` : ""}`);
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
    const columns = ["Request ID", "Employee", "Product", "Supplier", "Department", "Amount", "Date", "Status"];
    const rows = filteredRequests.map((r) => [
      getRequestId(r), getEmployee(r), getProduct(r), getSupplier(r),
      getDepartment(r), getAmount(r), formatDate(getRequestDate(r)), getStatus(r),
    ]);
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `etdox-manager-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="manager-app">
      {sidebarOpen && <button className="manager-sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`manager-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="manager-brand"><div className="manager-brand-icon"><Building2 size={21} /></div>ETDOX</div>
        <div className="manager-nav-label">WORKSPACE</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.name} className={`manager-nav ${activeTab === item.name ? "active" : ""}`}
              onClick={() => { setActiveTab(item.name); setStatusFilter("ALL"); setSidebarOpen(false); }}>
              <Icon size={17} />{item.name}
              {item.name === "Pending Requests" && managerPending.length > 0 &&
                <span className="manager-nav-count">{managerPending.length}</span>}
            </button>
          );
        })}
        <div className="manager-sidebar-bottom">
          <button className="manager-nav" onClick={logout}><LogOut size={17} />Logout</button>
        </div>
      </aside>

      <main className="manager-main">
        <header className="manager-topbar">
          <div className="manager-heading-wrap">
            <button className="manager-icon-btn manager-mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation">
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="manager-heading">
              <h1>{activeTab === "Overview" ? "Manager Dashboard" : activeTab}</h1>
              <p>Review employee procurement requests and make decisions.</p>
            </div>
          </div>
          <div className="manager-top-actions">
            <button className="manager-icon-btn" title="Refresh" onClick={loadDashboard} disabled={loading}><RefreshCw size={16} className={loading ? "manager-spin" : ""} /></button>
            <button className="manager-icon-btn" title="Notifications" type="button"><Bell size={17} /></button>
            <div className="manager-profile">
              <div className="manager-avatar">{managerName.charAt(0).toUpperCase()}</div>
              <div><strong>{managerName}</strong><small>Manager</small></div>
              <ChevronDown size={14} color="#8490a4" />
            </div>
          </div>
        </header>

        {error && <div className="manager-alert error"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setError("")} aria-label="Close error"><X size={15} /></button></div>}
        {success && <div className="manager-alert success"><CheckCircle2 size={16} /><span>{success}</span><button onClick={() => setSuccess("")} aria-label="Close success"><X size={15} /></button></div>}

        {activeTab === "Overview" && (
          <section className="manager-stats">
            <div className="manager-stat"><div className="manager-stat-top">Pending My Approval<span className="manager-stat-icon"><Clock size={18} /></span></div><h2>{managerPending.length}</h2><small>Requests awaiting manager review</small></div>
            <div className="manager-stat"><div className="manager-stat-top">Forwarded to Finance<span className="manager-stat-icon"><CheckCircle2 size={18} /></span></div><h2>{financePending.length}</h2><small>Approved by manager</small></div>
            <div className="manager-stat"><div className="manager-stat-top">Approved Requests<span className="manager-stat-icon"><ClipboardList size={18} /></span></div><h2>{approvedRequests.length}</h2><small>Manager-approved or completed</small></div>
            <div className="manager-stat"><div className="manager-stat-top">Rejected Requests<span className="manager-stat-icon"><XCircle size={18} /></span></div><h2>{rejectedRequests.length}</h2><small>Requests rejected</small></div>
          </section>
        )}

        <section className="manager-panel">
          <div className="manager-panel-head">
            <div><h2>{activeTab === "Overview" ? "Employee Procurement Requests" : activeTab}</h2>
              <p>{activeTab === "Pending Requests" ? "Review requests that require your approval." :
                activeTab === "Approval History" ? "Previously reviewed procurement requests." :
                "Requests submitted by employees in your organization."}</p></div>
            <div className="manager-controls">
              <div className="manager-search"><Search size={15} /><input placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <select className="manager-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                <option value="ALL">All statuses</option>
                {["PENDING_MANAGER", "SUBMITTED", "MANAGER_PENDING", "IN_APPROVAL", "MANAGER_APPROVED", "MANAGER_REJECTED", "PENDING_FINANCE", "FINANCE_APPROVED", "FINANCE_REJECTED", "COMPLETED"].map((status) =>
                  <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
              <select className="manager-select manager-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort requests">
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
                <option value="amount-high">Amount: high to low</option><option value="amount-low">Amount: low to high</option>
              </select>
              <button className="manager-export-btn" onClick={exportCsv} disabled={!filteredRequests.length}><Download size={15} />Export</button>
            </div>
          </div>

          {loading ? <div className="manager-loading"><RefreshCw size={22} className="manager-spin" /><p>Loading procurement requests...</p></div> :
            !filteredRequests.length ? <div className="manager-empty"><ClipboardList size={35} /><p>No procurement requests found.</p><small>Try changing your search or filters, or refresh the dashboard.</small></div> :
            <div className="manager-table-wrap"><table className="manager-table">
              <thead><tr><th>Employee</th><th>Product</th><th>Supplier</th><th>Department</th><th>Amount</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filteredRequests.map((request, index) => {
                const status = getStatus(request);
                const isPending = Boolean(request.workflowTaskId);
                return <tr key={getRequestId(request) || index}>
                  <td><div className="manager-person"><div className="manager-person-avatar">{getEmployee(request).charAt(0).toUpperCase()}</div><div><strong>{getEmployee(request)}</strong><small>{request.employeeId || request.employee_id || request.employee?.employeeId || request.requester?.email || request.employeeEmail || request.employee_email || request.request_number || "Employee"}</small></div></div></td>
                  <td><div className="manager-product"><strong>{getProduct(request)}</strong><small>Qty: {request.quantity ?? "—"}</small></div></td>
                  <td>{getSupplier(request)}</td><td>{getDepartment(request)}</td>
                  <td><strong className="manager-amount">{formatCurrency(getAmount(request), request.currency || "INR")}</strong></td>
                  <td>{formatDate(getRequestDate(request))}</td>
                  <td><span className={`manager-status ${statusStyle(status)}`}>{status.replaceAll("_", " ")}</span></td>
                  <td><div className="manager-actions">
                    <button className="manager-action" title="View details" onClick={() => { setSelectedRequest(request); setDecision(""); setReason(""); setError(""); }}><Eye size={15} /></button>
                    {isPending && <><button className="manager-action approve" title="Approve request" onClick={() => openDecision(request, "approve")}><Check size={15} /></button>
                      <button className="manager-action reject" title="Reject request" onClick={() => openDecision(request, "reject")}><Ban size={15} /></button></>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table></div>}
          <div className="manager-panel-foot"><span>{filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"}</span><button onClick={loadDashboard} disabled={loading}><RefreshCw size={14} />Refresh data</button></div>
        </section>
      </main>

      {selectedRequest && <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="manager-modal" role="dialog" aria-modal="true" aria-labelledby="manager-modal-title">
          <div className="manager-modal-head"><div><span className="manager-modal-eyebrow">PROCUREMENT REQUEST</span><h2 id="manager-modal-title">{decision ? decision === "approve" ? "Approve Request" : "Reject Request" : "Request Details"}</h2></div>
            <button className="manager-close" disabled={submitting} onClick={closeModal} aria-label="Close modal"><X size={17} /></button></div>
          <div className="manager-details">
            <div className="manager-detail"><small>Employee</small><strong>{getEmployee(selectedRequest)}</strong></div>
            <div className="manager-detail"><small>Product</small><strong>{getProduct(selectedRequest)}</strong></div>
            <div className="manager-detail"><small>Supplier</small><strong>{getSupplier(selectedRequest)}</strong></div>
            <div className="manager-detail"><small>Department</small><strong>{getDepartment(selectedRequest)}</strong></div>
            <div className="manager-detail"><small>Quantity</small><strong>{selectedRequest.quantity ?? "—"}</strong></div>
            <div className="manager-detail"><small>Unit Price</small><strong>{formatCurrency(selectedRequest.unitPrice ?? selectedRequest.unit_price, selectedRequest.currency || "INR")}</strong></div>
            <div className="manager-detail"><small>Total Amount</small><strong>{formatCurrency(getAmount(selectedRequest), selectedRequest.currency || "INR")}</strong></div>
            <div className="manager-detail"><small>Submitted Date</small><strong>{formatDate(getRequestDate(selectedRequest))}</strong></div>
            <div className="manager-detail"><small>Request ID</small><strong>{getRequestId(selectedRequest) || "—"}</strong></div>
            <div className="manager-detail"><small>Current Status</small><strong>{getStatus(selectedRequest).replaceAll("_", " ")}</strong></div>
          </div>
          <div className="manager-description"><small>Justification / Description</small><p>{selectedRequest.justification || selectedRequest.description || selectedRequest.reason || "No description provided."}</p></div>
          {decision && <div className="manager-reason-wrap"><label htmlFor="manager-reason">{decision === "reject" ? "Rejection reason (required)" : "Approval note (optional)"}</label>
            <textarea id="manager-reason" className="manager-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={decision === "reject" ? "Enter why this request is being rejected..." : "Add an optional note for the next approval stage..."} disabled={submitting} maxLength={4000} />
            <small>{reason.length}/4000 characters</small></div>}
          <div className="manager-modal-actions"><button className="manager-btn light" disabled={submitting} onClick={closeModal}>Close</button>
            {decision && <button className={`manager-btn ${decision === "approve" ? "green" : "red"}`} disabled={submitting || (decision === "reject" && !reason.trim())} onClick={submitDecision}>
              {submitting ? <><RefreshCw size={14} className="manager-spin" />Processing...</> :
                decision === "approve" ? <><Check size={14} />Approve &amp; Forward to Finance</> : <><XCircle size={14} />Reject Request</>}
            </button>}</div>
        </div>
      </div>}
    </div>
  );
}
