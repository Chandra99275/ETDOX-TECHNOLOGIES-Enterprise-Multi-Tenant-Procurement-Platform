import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ClipboardList, Wallet, CheckCircle2, XCircle, Clock3,
  Search, RefreshCw, LogOut, Building2, IndianRupee, Menu, X, Eye, Check,
  AlertCircle, ChevronRight, LoaderCircle, Package, Plus, Pencil, FileText,
  User, History, TrendingUp, Download, Filter, ArrowUpDown, CalendarDays,
  Mail, Phone, Building, CircleDollarSign, BarChart3, RotateCcw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./FinancePage.css";

// ============================================================
// API CONFIGURATION — uses the existing ETDOX API routes
// ============================================================
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");
const WORKFLOW_BASE = `${API_BASE}/workflows`;
const FINANCE_NODE_NAMES = ["finance_approval", "finance-approval"];
const APPROVED_STATUSES = ["APPROVED", "FINANCE_APPROVED", "COMPLETED"];
const REJECTED_STATUSES = ["REJECTED", "FINANCE_REJECTED", "REJECTED_FINANCE"];
const WAITING_STATUSES = ["SUBMITTED", "PENDING", "IN_REVIEW", "PENDING_MANAGER", "IN_APPROVAL", "MANAGER_APPROVED"];
const PAGE_SIZE = 10;

// ============================================================
// NORMALIZATION / DISPLAY HELPERS
// ============================================================
const normalizeStatus = (v) => String(v || "UNKNOWN").trim().toUpperCase().replace(/[\s-]+/g, "_");
const getStatus = (r) => normalizeStatus(r?.status ?? r?.request_status ?? r?.requestStatus ?? r?.approval_status);
const getRequestId = (r) => r?.id ?? r?.request_id ?? r?.requestId ?? r?.purchase_request_id ?? r?.purchaseRequestId ?? r?.resource_id ?? r?.resourceId;
const getRequestNumber = (r) => r?.requestNumber ?? r?.request_number ?? r?.reference_number ?? (getRequestId(r) ? `REQ-${String(getRequestId(r)).slice(0, 8)}` : "Request");
const getEmployeeName = (r) => {
  const name = r?.employee_name ?? r?.employeeName ?? r?.requester_name ?? r?.requesterName ?? r?.requested_by_name ?? r?.created_by_name ?? r?.user?.name ?? r?.employee?.name ?? r?.requester?.name;
  if (name) return name;
  return [r?.first_name ?? r?.firstName, r?.last_name ?? r?.lastName].filter(Boolean).join(" ") || r?.user?.full_name || r?.requester_email || r?.email || "Employee name unavailable";
};
const getRequesterId = (r) => r?.requesterId ?? r?.requester_id ?? r?.requested_by ?? r?.created_by ?? r?.user_id ?? r?.employee_id ?? r?.requester?.id ?? "Not provided";
const getEmployeeEmail = (r) => r?.employee_email ?? r?.requester_email ?? r?.email ?? r?.user?.email ?? r?.requester?.email ?? "Not provided";
const getProductName = (r) => r?.productName ?? r?.product_name ?? r?.item_name ?? r?.itemName ?? r?.title ?? r?.name ?? "Product not provided";
const getSupplier = (r) => r?.supplier_name ?? r?.supplierName ?? r?.supplier ?? r?.preferred_supplier_name ?? r?.preferredSupplier ?? "Not provided";
const getDepartment = (r) => r?.department_name ?? r?.departmentName ?? r?.department ?? r?.department_id ?? r?.departmentId ?? "Not provided";
const getQuantity = (r) => Number(r?.quantity ?? r?.requested_quantity ?? r?.requestedQuantity ?? 0);
const getUnitPrice = (r) => Number(r?.unit_price ?? r?.unitPrice ?? 0);
const getCurrency = (r) => String(r?.currency ?? r?.currency_code ?? "INR").toUpperCase();
const getAmount = (r) => {
  const value = r?.total_amount ?? r?.totalAmount ?? r?.total ?? r?.amount ?? r?.grand_total;
  return value !== undefined && value !== null && value !== "" ? Number(value) || 0 : getQuantity(r) * getUnitPrice(r);
};
const money = (value, currency = "INR") => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${currency} ${Number(value || 0).toLocaleString("en-IN")}`; }
};
const formatCurrencyTotals = (items, getter) => {
  const totals = {};
  items.forEach((item) => { const c = getCurrency(item); totals[c] = (totals[c] || 0) + getter(item); });
  return Object.entries(totals).length ? Object.entries(totals).map(([c, v]) => money(v, c)).join(" / ") : money(0);
};
const formatDate = (v) => {
  if (!v) return "Not available";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};
const formatLabel = (k) => String(k).replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (x) => x.toUpperCase());
const displayValue = (v) => v == null || v === "" ? "Not provided" : typeof v === "boolean" ? (v ? "Yes" : "No") : Array.isArray(v) ? (v.length ? v.map(displayValue).join(", ") : "None") : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
const getArray = (r) => {
  if (Array.isArray(r)) return r;
  if (!r || typeof r !== "object") return [];
  const options = [r.requests, r.budgets, r.items, r.rows, r.results, r.data, r.data?.requests, r.data?.budgets, r.data?.items, r.data?.rows, r.data?.results, r.data?.data];
  return options.find(Array.isArray) || [];
};
const getTaskId = (t) => t?.id ?? t?.task_id ?? t?.taskId;
const getTaskRequestId = (t) => t?.resource_id ?? t?.resourceId ?? t?.purchase_request_id ?? t?.purchaseRequestId;
const getTaskNode = (t) => String(t?.node_id ?? t?.nodeId ?? t?.active_node ?? "").toLowerCase();
const isFinanceTask = (t) => FINANCE_NODE_NAMES.includes(getTaskNode(t)) || getTaskNode(t).includes("finance");
const isPurchaseRequestTask = (t) => !t?.resource_type || t.resource_type === "purchase_request";
const getBudgetId = (b) => b?.id ?? b?.budget_id;
const getBudgetAllocated = (b) => Number(b?.allocatedAmount ?? b?.allocated_amount ?? b?.allocated ?? 0);
const getBudgetCommitted = (b) => Number(b?.committedAmount ?? b?.committed_amount ?? b?.committed ?? 0);
const getBudgetReserved = (b) => Number(b?.reservedAmount ?? b?.reserved_amount ?? b?.reserved ?? 0);
const getBudgetSpent = (b) => Number(b?.spentAmount ?? b?.spent_amount ?? b?.spent ?? 0);
const getBudgetAvailable = (b) => {
  const explicit = b?.availableAmount ?? b?.available_amount ?? b?.remainingAmount ?? b?.remaining_amount;
  return explicit != null ? Number(explicit) || 0 : Math.max(0, getBudgetAllocated(b) - getBudgetCommitted(b) - getBudgetReserved(b) - getBudgetSpent(b));
};
const getBudgetTitle = (b, i) => `${b?.departmentName ?? b?.department_name ?? b?.departmentId ?? b?.department_id ?? `Organization Budget ${i + 1}`} Budget · ${b?.fiscalYear ?? b?.fiscal_year ?? "Unknown year"}`;
const getBudgetUtilization = (b) => {
  if (b?.utilizationPercentage !== undefined) return Math.min(100, Math.max(0, Number(b.utilizationPercentage) || 0));
  const allocated = getBudgetAllocated(b);
  return allocated ? Math.min(100, Math.max(0, ((getBudgetCommitted(b) + getBudgetReserved(b) + getBudgetSpent(b)) / allocated) * 100)) : 0;
};
const getStatusClass = (s) => {
  const v = normalizeStatus(s);
  if (APPROVED_STATUSES.includes(v)) return "approved";
  if (REJECTED_STATUSES.includes(v)) return "rejected";
  if (v === "PENDING_FINANCE") return "pending";
  if (WAITING_STATUSES.includes(v)) return "waiting";
  return "default";
};
const emptyBudgetForm = { name: "", allocatedAmount: "", currency: "INR", fiscalYear: String(new Date().getFullYear()) };
const emptyDecision = { task: null, request: null, decision: "", reason: "" };

export default function FinancePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decisionModal, setDecisionModal] = useState(emptyDecision);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);

  const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || localStorage.getItem("authToken");

  const apiRequest = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const validation = Array.isArray(data.errors) ? data.errors.map((x) => x.message).filter(Boolean).join(", ") : "";
      throw new Error(validation || data.message || data.error || `Server returned ${response.status}`);
    }
    return data;
  }, [token]);
  const apiGet = useCallback((path) => apiRequest(`${API_BASE}${path}`), [apiRequest]);

  const loadFinanceData = useCallback(async (showRefresh = false) => {
    showRefresh ? setRefreshing(true) : setLoading(true);
    setError(""); setBudgetError("");
    const [requestResult, budgetResult, taskResult, userResult] = await Promise.allSettled([
      apiGet("/procurement/requests"), apiGet("/budgets?page=1&limit=100"),
      apiRequest(`${WORKFLOW_BASE}/tasks/pending?limit=100&offset=0`), apiGet("/auth/me"),
    ]);
    const errors = [];
    if (requestResult.status === "fulfilled") setRequests(getArray(requestResult.value));
    else { setRequests([]); errors.push(requestResult.reason?.message || "Unable to load procurement requests."); }
    if (budgetResult.status === "fulfilled") setBudgets(getArray(budgetResult.value));
    else { setBudgets([]); setBudgetError(budgetResult.reason?.message || "Unable to load budgets."); }
    if (taskResult.status === "fulfilled") {
      setPendingTasks(getArray(taskResult.value).filter((t) => isFinanceTask(t) && isPurchaseRequestTask(t) && normalizeStatus(t.status) === "PENDING"));
    } else { setPendingTasks([]); errors.push(taskResult.reason?.message || "Unable to load Finance approval tasks."); }
    if (userResult.status === "fulfilled") {
      const current = userResult.value?.user ?? userResult.value?.data?.user ?? userResult.value?.data ?? userResult.value;
      if (current && typeof current === "object") { setUser((old) => ({ ...old, ...current })); localStorage.setItem("user", JSON.stringify(current)); }
    }
    setError(errors.join(" ")); setLoading(false); setRefreshing(false);
  }, [apiGet, apiRequest]);

  useEffect(() => { loadFinanceData(); }, [loadFinanceData]);
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, departmentFilter, sortBy]);

  const financeName = user?.name || user?.full_name || user?.fullName || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "Finance Manager";
  const financeTaskRows = useMemo(() => pendingTasks.map((task) => {
    const resourceId = getTaskRequestId(task);
    const found = requests.find((r) => String(getRequestId(r)) === String(resourceId));
    const fallback = { id: resourceId, request_number: task.request_number, total_amount: task.total_amount, currency: task.currency, requester_id: task.requester_id, status: "PENDING_FINANCE" };
    return { task, request: found || fallback, requestFound: Boolean(found) };
  }), [pendingTasks, requests]);
  const pendingFinanceRequests = useMemo(() => financeTaskRows.map((r) => r.request), [financeTaskRows]);
  const waitingRequests = useMemo(() => requests.filter((r) => WAITING_STATUSES.includes(getStatus(r))), [requests]);
  const approvedRequests = useMemo(() => requests.filter((r) => APPROVED_STATUSES.includes(getStatus(r))), [requests]);
  const rejectedRequests = useMemo(() => requests.filter((r) => REJECTED_STATUSES.includes(getStatus(r))), [requests]);
  const totalAllocated = formatCurrencyTotals(budgets, getBudgetAllocated);
  const totalCommitted = formatCurrencyTotals(budgets, getBudgetCommitted);
  const totalSpent = formatCurrencyTotals(budgets, getBudgetSpent);
  const totalAvailable = formatCurrencyTotals(budgets, getBudgetAvailable);
  const pendingAmount = formatCurrencyTotals(pendingFinanceRequests, getAmount);
  const approvedAmount = formatCurrencyTotals(approvedRequests, getAmount);
  const rejectedAmount = formatCurrencyTotals(rejectedRequests, getAmount);
  const departments = useMemo(() => [...new Set(requests.map(getDepartment).filter((x) => x && x !== "Not provided"))].sort(), [requests]);

  const filteredRequests = useMemo(() => {
    let rows = [...requests];
    if (statusFilter === "waiting") rows = rows.filter((r) => WAITING_STATUSES.includes(getStatus(r)));
    if (statusFilter === "approved") rows = rows.filter((r) => APPROVED_STATUSES.includes(getStatus(r)));
    if (statusFilter === "rejected") rows = rows.filter((r) => REJECTED_STATUSES.includes(getStatus(r)));
    if (statusFilter === "pending") {
      const ids = new Set(pendingFinanceRequests.map((r) => String(getRequestId(r))));
      rows = rows.filter((r) => ids.has(String(getRequestId(r))));
    }
    if (departmentFilter !== "all") rows = rows.filter((r) => getDepartment(r) === departmentFilter);
    const term = searchTerm.toLowerCase().trim();
    if (term) rows = rows.filter((r) => [getRequestNumber(r), getEmployeeName(r), getEmployeeEmail(r), getRequesterId(r), getProductName(r), getSupplier(r), getDepartment(r), getStatus(r), r?.description, r?.justification, r?.budget_id, r?.budgetId].filter(Boolean).join(" ").toLowerCase().includes(term));
    rows.sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      if (sortBy === "amount-high") return getAmount(b) - getAmount(a);
      if (sortBy === "amount-low") return getAmount(a) - getAmount(b);
      return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
    });
    return rows;
  }, [requests, statusFilter, departmentFilter, searchTerm, sortBy, pendingFinanceRequests]);
  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleLogout = () => {
    ["token", "accessToken", "authToken", "user", "userRole"].forEach((k) => localStorage.removeItem(k));
    navigate("/login", { replace: true });
  };
  const openDecision = (task, request, decision) => { setError(""); setSuccess(""); setDecisionModal({ task, request, decision, reason: "" }); };
  const submitDecision = async (event) => {
    event.preventDefault();
    const { task, decision, reason } = decisionModal;
    const taskId = getTaskId(task);
    if (!taskId) return setError("Approval task ID is missing.");
    if (!reason.trim()) return setError("Please enter your Finance remarks.");
    if (reason.trim().length > 1000) return setError("Remarks cannot exceed 1000 characters.");
    setProcessing(true); setError(""); setSuccess("");
    try {
      await apiRequest(`${WORKFLOW_BASE}/tasks/${encodeURIComponent(taskId)}/actions`, { method: "POST", body: JSON.stringify({ action: decision === "approve" ? "approve" : "reject", comment: reason.trim() }) });
      setSuccess(decision === "approve" ? "Finance approval completed successfully." : "The procurement request has been rejected.");
      setDecisionModal(emptyDecision); setSelectedRequest(null); await loadFinanceData(true);
    } catch (e) { setError(e.message || "Unable to process the Finance approval."); }
    finally { setProcessing(false); }
  };

  const openCreateBudget = () => { setEditingBudget(null); setBudgetForm({ ...emptyBudgetForm, fiscalYear: String(new Date().getFullYear()) }); setBudgetError(""); setBudgetModalOpen(true); };
  const openEditBudget = (b) => {
    setEditingBudget(b); setBudgetForm({ name: getBudgetTitle(b, 0), allocatedAmount: String(getBudgetAllocated(b)), currency: b.currency || "INR", fiscalYear: String(b.fiscalYear ?? b.fiscal_year ?? new Date().getFullYear()) }); setBudgetError(""); setBudgetModalOpen(true);
  };
  const updateBudgetField = (e) => setBudgetForm((old) => ({ ...old, [e.target.name]: e.target.value }));
  const saveBudget = async (event) => {
    event.preventDefault();
    const amount = Number(budgetForm.allocatedAmount); const year = Number(budgetForm.fiscalYear);
    if (!budgetForm.name.trim()) return setBudgetError("Enter a budget name.");
    if (!Number.isFinite(amount) || amount <= 0) return setBudgetError("Enter an allocated amount greater than zero.");
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return setBudgetError("Enter a valid fiscal year between 2000 and 2100.");
    const payload = { name: budgetForm.name.trim(), allocatedAmount: amount, currency: budgetForm.currency.toUpperCase(), fiscalYear: year };
    setSavingBudget(true); setBudgetError("");
    try {
      if (editingBudget) {
        const id = getBudgetId(editingBudget); if (!id) throw new Error("Budget ID is missing.");
        await apiRequest(`${API_BASE}/budgets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); setSuccess("Budget updated successfully.");
      } else { await apiRequest(`${API_BASE}/budgets`, { method: "POST", body: JSON.stringify(payload) }); setSuccess("Budget created or existing allocation updated successfully."); }
      setBudgetModalOpen(false); setEditingBudget(null); setBudgetForm(emptyBudgetForm); await loadFinanceData(true); setActiveTab("budgets");
    } catch (e) { setBudgetError(e.message || "Unable to save budget."); }
    finally { setSavingBudget(false); }
  };

  const exportRequests = (rows = filteredRequests) => {
    const headers = ["Request Number", "Request ID", "Employee", "Email", "Department", "Product", "Supplier", "Quantity", "Unit Price", "Amount", "Currency", "Status", "Created At"];
    const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers, ...rows.map((r) => [getRequestNumber(r), getRequestId(r), getEmployeeName(r), getEmployeeEmail(r), getDepartment(r), getProductName(r), getSupplier(r), getQuantity(r), getUnitPrice(r), getAmount(r), getCurrency(r), getStatus(r), r.created_at ?? r.createdAt ?? ""])].map((row) => row.map(csvCell).join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `etdox-finance-requests-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const getRequestDetails = (request) => {
    if (!request) return [];
    const raw = request.raw && typeof request.raw === "object" ? request.raw : {};
    const combined = { ...raw, ...request }; delete combined.raw;
    return Object.entries(combined).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([key, value]) => ({ key, label: formatLabel(key), value }));
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "requests", label: "Employee Requests", icon: ClipboardList },
    { id: "budgets", label: "Budgets", icon: Wallet },
    { id: "approvals", label: "Approval History", icon: CheckCircle2 },
  ];

  const renderRequestsTable = (items, taskRows = [], compact = false) => (
    <div className="finance-table-wrapper"><table className="finance-table">
      <thead><tr><th>Request</th><th>Employee</th><th>Product</th><th>Supplier</th><th>Department</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{items.length ? items.map((r, i) => {
        const id = getRequestId(r) || i; const taskRow = taskRows.find((x) => String(getRequestId(x.request)) === String(getRequestId(r)));
        const status = taskRow ? "PENDING_FINANCE" : getStatus(r); const employee = getEmployeeName(r);
        return <tr key={id}>
          <td><strong>{getRequestNumber(r)}</strong><small className="sub-value">{String(id)}</small></td>
          <td><div className="finance-employee-cell"><span className="finance-mini-avatar">{employee.charAt(0).toUpperCase()}</span><div><strong>{employee}</strong><small>{getEmployeeEmail(r)}</small></div></div></td>
          <td><div className="finance-product-cell"><Package size={15} />{getProductName(r)}</div></td>
          <td>{getSupplier(r)}</td><td>{getDepartment(r)}</td>
          <td className="finance-amount">{money(getAmount(r), getCurrency(r))}</td>
          <td><span className={`finance-status ${getStatusClass(status)}`}>{status.replaceAll("_", " ")}</span></td>
          <td><div className="finance-row-actions"><button className="finance-icon-button" title="View complete details" onClick={() => setSelectedRequest(r)}><Eye size={15} /></button>
            {taskRow && <><button className="finance-approve-button" title="Approve Finance task" onClick={() => openDecision(taskRow.task, r, "approve")}><Check size={14} /></button><button className="finance-reject-button" title="Reject Finance task" onClick={() => openDecision(taskRow.task, r, "reject")}><X size={14} /></button></>}
          </div></td>
        </tr>;
      }) : <tr><td colSpan="8" className="finance-empty"><ClipboardList size={28} /><strong>No requests found</strong><span>Requests will appear here when available.</span></td></tr>}</tbody>
    </table></div>
  );

  const renderBudgetCards = (list = budgets) => list.length ? <div className="finance-budget-grid">{list.map((b, i) => {
    const allocated = getBudgetAllocated(b); const percentage = getBudgetUtilization(b);
    return <article className="finance-budget-card" key={getBudgetId(b) || i}>
      <div className="finance-budget-card-heading"><div><h4>{getBudgetTitle(b, i)}</h4><p>{b.costCenterId || b.cost_center_id || "Organization budget"}</p></div><button className="finance-icon-button" onClick={() => openEditBudget(b)} title="Edit budget"><Pencil size={14} /></button></div>
      <div className="finance-budget-highlight"><span>Allocated budget</span><strong>{money(allocated, b.currency)}</strong></div>
      <div className="finance-progress"><span style={{ width: `${percentage}%` }} /></div><div className="finance-progress-caption"><span>{percentage.toFixed(1)}% utilized</span><span>{money(getBudgetAvailable(b), b.currency)} available</span></div>
      {[ ["Committed", getBudgetCommitted(b)], ["Reserved", getBudgetReserved(b)], ["Spent", getBudgetSpent(b)], ["Available", getBudgetAvailable(b)] ].map(([label, value]) => <div className="finance-budget-line" key={label}><span>{label}</span><strong className={label === "Available" ? "finance-available" : ""}>{money(value, b.currency)}</strong></div>)}
      <div className="finance-budget-meta"><span>Fiscal year: {b.fiscalYear ?? b.fiscal_year ?? "—"}</span><span>{b.currency || "INR"}</span></div>
    </article>;
  })}</div> : <div className="finance-empty finance-budget-empty"><Wallet size={28} /><strong>No budgets found</strong><span>No budget records were returned by the server.</span><button className="finance-button primary" onClick={openCreateBudget}><Plus size={15} />Create Budget</button></div>;

  return <div className="finance-app">
    <aside className={`finance-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="finance-brand"><span className="finance-brand-icon"><Building2 size={22} /></span><span>ETDOX<span>.</span></span></div>
      <p className="finance-workspace-label">FINANCE WORKSPACE</p>
      <nav className="finance-nav">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); setError(""); setSuccess(""); setBudgetError(""); }}><Icon size={18} />{item.label}{activeTab === item.id && <ChevronRight size={15} className="finance-nav-chevron" />}{item.id === "requests" && pendingTasks.length > 0 && <span className="finance-nav-count">{pendingTasks.length}</span>}</button>; })}</nav>
      <div className="finance-sidebar-bottom"><div className="finance-user-mini"><div className="finance-avatar">{financeName.charAt(0).toUpperCase()}</div><div><strong>{financeName}</strong><small>{user?.email || "Finance account"}</small></div></div><button className="finance-logout" onClick={handleLogout}><LogOut size={16} />Sign out</button></div>
    </aside>

    <main className="finance-main">
      <header className="finance-topbar"><div className="finance-topbar-left"><button className="finance-mobile-menu" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu">{sidebarOpen ? <X size={18} /> : <Menu size={18} />}</button><div><h1>{activeTab === "overview" ? "Finance Dashboard" : activeTab === "requests" ? "Employee Requests" : activeTab === "budgets" ? "Budget Management" : "Approval History"}</h1><p>Review procurement requests and manage budgets.</p></div></div>
        <div className="finance-topbar-right"><button className="finance-button" onClick={() => loadFinanceData(true)} disabled={refreshing}>{refreshing ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}{refreshing ? "Refreshing..." : "Refresh"}</button><div className="finance-topbar-user"><div className="finance-avatar">{financeName.charAt(0).toUpperCase()}</div><div><strong>{financeName}</strong><small>Finance</small></div></div></div>
      </header>
      <div className="finance-content">
        {error && <div className="finance-alert error" role="alert"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
        {success && <div className="finance-alert success"><CheckCircle2 size={16} /><span>{success}</span><button onClick={() => setSuccess("")} aria-label="Dismiss"><X size={15} /></button></div>}
        {loading ? <div className="finance-loading"><div><LoaderCircle size={26} className="spin" /><p>Loading Finance workspace...</p></div></div> : <>
          {activeTab === "overview" && <>
            <section className="finance-welcome"><div><span className="finance-eyebrow">FINANCE CONTROL CENTER</span><h2>Welcome back, {financeName} 👋</h2><p>Review employee procurement requests and financial approvals.</p></div><button className="finance-button primary" onClick={() => setActiveTab("requests")}><ClipboardList size={15} />Review Employee Requests</button></section>
            <section className="finance-stats">
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Awaiting Finance</small><span className="finance-stat-icon amber"><Clock3 size={18} /></span></div><h3>{pendingTasks.length}</h3><p>Tasks assigned to your Finance account</p></div>
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Waiting for Manager</small><span className="finance-stat-icon blue"><ClipboardList size={18} /></span></div><h3>{waitingRequests.length}</h3><p>Requests not yet forwarded to Finance</p></div>
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Approved Requests</small><span className="finance-stat-icon green"><CheckCircle2 size={18} /></span></div><h3>{approvedRequests.length}</h3><p>Total approved requests</p></div>
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Pending Amount</small><span className="finance-stat-icon purple"><IndianRupee size={18} /></span></div><h3 className="finance-stat-value">{pendingAmount}</h3><p>Awaiting Finance review</p></div>
            </section>
            <section className="finance-stats finance-budget-stats">
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Total Allocated</small><span className="finance-stat-icon blue"><Wallet size={18} /></span></div><h3 className="finance-stat-value">{totalAllocated}</h3><p>Actual budget allocations</p></div>
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Committed</small><span className="finance-stat-icon purple"><FileText size={18} /></span></div><h3 className="finance-stat-value">{totalCommitted}</h3><p>Committed budget amount</p></div>
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Spent</small><span className="finance-stat-icon amber"><TrendingUp size={18} /></span></div><h3 className="finance-stat-value">{totalSpent}</h3><p>Recorded expenditure</p></div>
              <div className="finance-stat-card"><div className="finance-stat-top"><small>Available Budget</small><span className="finance-stat-icon green"><CircleDollarSign size={18} /></span></div><h3 className="finance-stat-value">{totalAvailable}</h3><p>Remaining budget amount</p></div>
            </section>
            <section className="finance-panel"><div className="finance-panel-heading"><div><h3>Requests Awaiting Finance</h3><p>Tasks assigned to your authenticated Finance account.</p></div><button className="finance-button" onClick={() => setActiveTab("requests")}>View all<ChevronRight size={14} /></button></div>{renderRequestsTable(pendingFinanceRequests, financeTaskRows)}</section>
            <section className="finance-panel"><div className="finance-panel-heading"><div><h3>Budget Summary</h3><p>Available funds: {totalAvailable}</p></div><button className="finance-button" onClick={() => setActiveTab("budgets")}>Manage budgets<ChevronRight size={14} /></button></div>{renderBudgetCards(budgets.slice(0, 4))}</section>
          </>}

          {activeTab === "requests" && <>
            <section className="finance-welcome"><div><span className="finance-eyebrow">PROCUREMENT WORKFLOW</span><h2>Employee Procurement Requests</h2><p>Review employee submissions and process requests forwarded by managers.</p></div><button className="finance-button" onClick={() => exportRequests()}><Download size={15} />Export CSV</button></section>
            <section className="finance-panel"><div className="finance-panel-heading"><div><h3>All Employee Requests</h3><p>Finance pending: {pendingTasks.length} <span className="dot-separator">·</span> Waiting for manager: {waitingRequests.length} <span className="dot-separator">·</span> Approved: {approvedRequests.length} <span className="dot-separator">·</span> Rejected: {rejectedRequests.length}</p></div><span className="finance-result-count">{filteredRequests.length} results</span></div>
              <div className="finance-toolbar"><div className="finance-search"><Search size={15} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search employee, product, supplier, request ID..." />{searchTerm && <button onClick={() => setSearchTerm("")} aria-label="Clear search"><X size={14} /></button>}</div><div className="finance-filter-group"><div className="finance-select-wrap"><Filter size={14} /><select className="finance-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Awaiting Finance</option><option value="waiting">Waiting for Manager</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><select className="finance-filter" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}><option value="all">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select><select className="finance-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount-high">Amount: high-low</option><option value="amount-low">Amount: low-high</option></select></div></div>
              {renderRequestsTable(paginatedRequests, financeTaskRows)}
              <div className="finance-pagination"><span>Showing {filteredRequests.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length}</span><div><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button></div></div>
            </section>
          </>}

          {activeTab === "budgets" && <><section className="finance-welcome"><div><span className="finance-eyebrow">FINANCIAL PLANNING</span><h2>Budget Management</h2><p>Manage organization budget allocations and monitor available funds.</p></div><button className="finance-button primary" onClick={openCreateBudget}><Plus size={15} />Create Budget</button></section>
            {budgetError && <div className="finance-alert error"><AlertCircle size={16} />{budgetError}</div>}
            <section className="finance-stats finance-budget-stats"><div className="finance-stat-card"><small>Total Allocated</small><h3 className="finance-stat-value">{totalAllocated}</h3></div><div className="finance-stat-card"><small>Total Committed</small><h3 className="finance-stat-value">{totalCommitted}</h3></div><div className="finance-stat-card"><small>Total Spent</small><h3 className="finance-stat-value">{totalSpent}</h3></div><div className="finance-stat-card"><small>Total Available</small><h3 className="finance-stat-value">{totalAvailable}</h3></div></section>
            <section className="finance-panel"><div className="finance-panel-heading"><div><h3>Organization Budgets</h3><p>Monitor actual allocations, utilization and available funds.</p></div><span className="finance-result-count">{budgets.length} budgets</span></div>{renderBudgetCards()}</section>
          </>}

          {activeTab === "approvals" && <><section className="finance-welcome"><div><span className="finance-eyebrow">DECISION REGISTER</span><h2>Finance Approval History</h2><p>Review approved and rejected procurement requests.</p></div><button className="finance-button" onClick={() => exportRequests([...approvedRequests, ...rejectedRequests])}><Download size={15} />Export history</button></section>
            <section className="finance-stats"><div className="finance-stat-card"><div className="finance-stat-top"><small>Approved</small><span className="finance-stat-icon green"><CheckCircle2 size={18} /></span></div><h3>{approvedRequests.length}</h3><p>{approvedAmount} total approved</p></div><div className="finance-stat-card"><div className="finance-stat-top"><small>Rejected</small><span className="finance-stat-icon red"><XCircle size={18} /></span></div><h3>{rejectedRequests.length}</h3><p>{rejectedAmount} total rejected</p></div></section>
            <section className="finance-panel"><div className="finance-panel-heading"><div><h3>Processed Requests</h3><p>{approvedRequests.length + rejectedRequests.length} processed requests</p></div></div>{renderRequestsTable([...approvedRequests, ...rejectedRequests])}</section>
          </>}
        </>}
      </div>
    </main>

    {selectedRequest && <div className="finance-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedRequest(null); }}><div className="finance-modal finance-details-modal"><div className="finance-modal-heading"><div><span className="finance-eyebrow">REQUEST DETAILS</span><h3>Complete Procurement Request</h3><p>{getRequestNumber(selectedRequest)}</p></div><button className="finance-modal-close" onClick={() => setSelectedRequest(null)}><X size={16} /></button></div>
      <div className="finance-detail-section"><h4><User size={15} />Employee Information</h4><div className="finance-detail-grid"><div className="finance-detail"><small>Employee Name</small><strong>{getEmployeeName(selectedRequest)}</strong></div><div className="finance-detail"><small>Employee ID</small><strong>{displayValue(getRequesterId(selectedRequest))}</strong></div><div className="finance-detail"><small>Email Address</small><strong>{getEmployeeEmail(selectedRequest)}</strong></div><div className="finance-detail"><small>Department</small><strong>{getDepartment(selectedRequest)}</strong></div></div></div>
      <div className="finance-detail-section"><h4><Package size={15} />Product Information</h4><div className="finance-detail-grid"><div className="finance-detail"><small>Product Name</small><strong>{getProductName(selectedRequest)}</strong></div><div className="finance-detail"><small>Supplier</small><strong>{getSupplier(selectedRequest)}</strong></div><div className="finance-detail"><small>Quantity</small><strong>{displayValue(getQuantity(selectedRequest))}</strong></div><div className="finance-detail"><small>Unit Price</small><strong>{money(getUnitPrice(selectedRequest), getCurrency(selectedRequest))}</strong></div><div className="finance-detail"><small>Total Amount</small><strong>{money(getAmount(selectedRequest), getCurrency(selectedRequest))}</strong></div><div className="finance-detail"><small>Currency</small><strong>{getCurrency(selectedRequest)}</strong></div><div className="finance-detail"><small>Budget ID</small><strong>{displayValue(selectedRequest.budgetId ?? selectedRequest.budget_id)}</strong></div><div className="finance-detail"><small>Request Status</small><strong>{getStatus(selectedRequest).replaceAll("_", " ")}</strong></div></div></div>
      <div className="finance-detail-section"><h4><FileText size={15} />Business Justification</h4><div className="finance-detail finance-justification"><strong>{selectedRequest.justification || selectedRequest.description || "No justification was returned by the API."}</strong></div></div>
      <div className="finance-detail-section"><h4><History size={15} />Approval Information</h4><div className="finance-detail-grid">{[["Manager Decision", selectedRequest.managerDecision ?? selectedRequest.manager_decision], ["Finance Decision", selectedRequest.financeDecision ?? selectedRequest.finance_decision], ["Submitted At", formatDate(selectedRequest.submittedAt || selectedRequest.submitted_at)], ["Created At", formatDate(selectedRequest.createdAt || selectedRequest.created_at)], ["Updated At", formatDate(selectedRequest.updatedAt || selectedRequest.updated_at)], ["Workflow Run ID", selectedRequest.workflowRunId || selectedRequest.workflow_run_id]].map(([label, value]) => <div className="finance-detail" key={label}><small>{label}</small><strong>{displayValue(value)}</strong></div>)}</div></div>
      {Array.isArray(selectedRequest.history) && selectedRequest.history.length > 0 && <div className="finance-detail-section"><h4><History size={15} />Request History</h4><div className="finance-history">{selectedRequest.history.map((item, i) => <div className="finance-history-item" key={item.id || i}><strong>{item.action || item.status || item.decision || "Request activity"}</strong><p>{item.comment || item.remarks || item.description || "No additional remarks"}</p><small>{item.actor_name || item.user_name || item.actor || "System"} · {formatDate(item.created_at || item.createdAt || item.timestamp)}</small></div>)}</div></div>}
      <div className="finance-detail-section"><h4><FileText size={15} />All Other Values Returned by the API</h4><div className="finance-all-fields">{getRequestDetails(selectedRequest).map(({ key, label, value }) => <div className="finance-detail" key={key}><small>{label}</small><strong>{displayValue(value)}</strong></div>)}</div></div>
      <div className="finance-modal-actions"><button className="finance-button" onClick={() => setSelectedRequest(null)}>Close</button></div>
    </div></div>}

    {decisionModal.task && <div className="finance-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !processing) setDecisionModal(emptyDecision); }}><div className="finance-modal finance-decision-modal"><div className="finance-modal-heading"><div><span className="finance-eyebrow">FINANCE WORKFLOW</span><h3>{decisionModal.decision === "approve" ? "Approve Employee Request" : "Reject Employee Request"}</h3></div><button className="finance-modal-close" disabled={processing} onClick={() => setDecisionModal(emptyDecision)}><X size={16} /></button></div>
      <div className="finance-detail-grid"><div className="finance-detail"><small>Request Number</small><strong>{getRequestNumber(decisionModal.request)}</strong></div><div className="finance-detail"><small>Employee</small><strong>{getEmployeeName(decisionModal.request)}</strong></div><div className="finance-detail"><small>Product</small><strong>{getProductName(decisionModal.request)}</strong></div><div className="finance-detail"><small>Amount</small><strong>{money(getAmount(decisionModal.request), getCurrency(decisionModal.request))}</strong></div><div className="finance-detail full"><small>Approval Task ID</small><strong>{getTaskId(decisionModal.task)}</strong></div></div>
      <form onSubmit={submitDecision}><div className="finance-modal-field"><label>{decisionModal.decision === "approve" ? "Finance Approval Remarks *" : "Reason for Rejection *"}</label><textarea value={decisionModal.reason} onChange={(e) => setDecisionModal((old) => ({ ...old, reason: e.target.value }))} placeholder="Enter your decision remarks..." required minLength={2} maxLength={1000} disabled={processing} /><small>{decisionModal.reason.length}/1000 characters</small></div><div className="finance-modal-actions"><button type="button" className="finance-button" disabled={processing} onClick={() => setDecisionModal(emptyDecision)}>Cancel</button><button type="submit" className={`finance-button ${decisionModal.decision === "reject" ? "danger" : "primary"}`} disabled={processing}>{processing ? <><LoaderCircle size={15} className="spin" />Processing...</> : decisionModal.decision === "approve" ? <><Check size={15} />Confirm Approval</> : <><XCircle size={15} />Confirm Rejection</>}</button></div></form>
    </div></div>}

    {budgetModalOpen && <div className="finance-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !savingBudget) setBudgetModalOpen(false); }}><div className="finance-modal finance-budget-modal"><div className="finance-modal-heading"><div><span className="finance-eyebrow">BUDGET CONFIGURATION</span><h3>{editingBudget ? "Edit Budget" : "Create New Budget"}</h3></div><button className="finance-modal-close" disabled={savingBudget} onClick={() => setBudgetModalOpen(false)}><X size={16} /></button></div>
      {budgetError && <div className="finance-alert error"><AlertCircle size={15} />{budgetError}</div>}
      <form onSubmit={saveBudget}><div className="finance-form-grid"><div className="finance-form-field full"><label>Budget Name *</label><input name="name" value={budgetForm.name} onChange={updateBudgetField} placeholder="Organization Annual Budget" required /><small>The current backend requires this field for validation; the repository may not persist the display name.</small></div><div className="finance-form-field full"><label>Allocated Amount *</label><input type="number" name="allocatedAmount" value={budgetForm.allocatedAmount} onChange={updateBudgetField} min="0.01" step="0.01" placeholder="Enter amount" required /></div><div className="finance-form-field"><label>Currency</label><select name="currency" value={budgetForm.currency} onChange={updateBudgetField}><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option></select></div><div className="finance-form-field"><label>Fiscal Year *</label><input type="number" name="fiscalYear" value={budgetForm.fiscalYear} onChange={updateBudgetField} min="2000" max="2100" required /></div></div><div className="finance-modal-actions"><button type="button" className="finance-button" disabled={savingBudget} onClick={() => setBudgetModalOpen(false)}>Cancel</button><button type="submit" className="finance-button primary" disabled={savingBudget}>{savingBudget ? <><LoaderCircle size={15} className="spin" />Saving...</> : <><Check size={15} />{editingBudget ? "Save Changes" : "Create Budget"}</>}</button></div></form>
    </div></div>}
  </div>;
}
