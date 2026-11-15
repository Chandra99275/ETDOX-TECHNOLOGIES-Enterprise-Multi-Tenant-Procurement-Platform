import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ClipboardList, Wallet, CheckCircle2, XCircle, Clock3,
  Search, RefreshCw, LogOut, Building2, IndianRupee, Menu, X, Eye, Check,
  AlertCircle, ChevronRight, LoaderCircle, Package, Plus, Pencil, FileText,
  User, History, TrendingUp, Download, Filter, ArrowUpDown, CalendarDays,
  CircleDollarSign, BarChart3, RotateCcw, Activity, ShieldCheck,
  Users, ArrowUpRight, ChartNoAxesCombined, BriefcaseBusiness, SlidersHorizontal
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./FinancePage.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1").replace(/\/+$/, "");
const WORKFLOW_BASE = `${API_BASE}/workflows`;

const FINANCE_NODE_NAMES = ["finance_approval", "finance-approval"];
const APPROVED_STATUSES = ["APPROVED", "FINANCE_APPROVED", "COMPLETED"];
const REJECTED_STATUSES = ["REJECTED", "FINANCE_REJECTED", "REJECTED_FINANCE"];
const WAITING_STATUSES = ["SUBMITTED", "PENDING", "IN_REVIEW", "PENDING_MANAGER", "IN_APPROVAL", "MANAGER_APPROVED"];
const PAGE_SIZE = 10;

const normalizeStatus = (v) =>
  String(v || "UNKNOWN").trim().toUpperCase().replace(/[\s-]+/g, "_");

const getStatus = (r) =>
  normalizeStatus(r?.status ?? r?.request_status ?? r?.requestStatus ?? r?.approval_status);

const getRequestId = (r) =>
  r?.id ?? r?.request_id ?? r?.requestId ?? r?.purchase_request_id ??
  r?.purchaseRequestId ?? r?.resource_id ?? r?.resourceId;

const getRequestNumber = (r) =>
  r?.requestNumber ?? r?.request_number ?? r?.reference_number ??
  (getRequestId(r) ? `REQ-${String(getRequestId(r)).slice(0, 8)}` : "Request");

const getEmployeeName = (r) => {
  const name = r?.employee_name ?? r?.employeeName ?? r?.requester_name ??
    r?.requesterName ?? r?.requested_by_name ?? r?.created_by_name ??
    r?.user?.name ?? r?.employee?.name ?? r?.requester?.name;

  if (name) return name;

  return [
    r?.first_name ?? r?.firstName,
    r?.last_name ?? r?.lastName
  ].filter(Boolean).join(" ") ||
    r?.user?.full_name ||
    r?.requester_email ||
    r?.email ||
    "Employee name unavailable";
};

const getRequesterId = (r) =>
  r?.requesterId ?? r?.requester_id ?? r?.requested_by ??
  r?.created_by ?? r?.user_id ?? r?.employee_id ??
  r?.requester?.id ?? "Not provided";

const getEmployeeEmail = (r) =>
  r?.employee_email ?? r?.requester_email ?? r?.email ??
  r?.user?.email ?? r?.requester?.email ?? "Not provided";

const getProductName = (r) =>
  r?.productName ?? r?.product_name ?? r?.item_name ??
  r?.itemName ?? r?.title ?? r?.name ?? "Product not provided";

const getSupplier = (r) =>
  r?.supplier_name ?? r?.supplierName ?? r?.supplier ??
  r?.preferred_supplier_name ?? r?.preferredSupplier ?? "Not provided";

const getDepartment = (r) =>
  r?.department_name ?? r?.departmentName ?? r?.department ??
  r?.department_id ?? r?.departmentId ?? "Not provided";

const getQuantity = (r) =>
  Number(r?.quantity ?? r?.requested_quantity ?? r?.requestedQuantity ?? 0);

const getUnitPrice = (r) =>
  Number(r?.unit_price ?? r?.unitPrice ?? 0);

const getCurrency = (r) =>
  String(r?.currency ?? r?.currency_code ?? "INR").toUpperCase();

const getAmount = (r) => {
  const value = r?.total_amount ?? r?.totalAmount ??
    r?.total ?? r?.amount ?? r?.grand_total;

  return value !== undefined && value !== null && value !== ""
    ? Number(value) || 0
    : getQuantity(r) * getUnitPrice(r);
};

const money = (value, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString("en-IN")}`;
  }
};

const formatCurrencyTotals = (items, getter) => {
  const totals = {};

  items.forEach((item) => {
    const currency = getCurrency(item);
    totals[currency] = (totals[currency] || 0) + getter(item);
  });

  return Object.entries(totals).length
    ? Object.entries(totals).map(([currency, value]) => money(value, currency)).join(" / ")
    : money(0);
};

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });
};

const formatLabel = (key) =>
  String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (x) => x.toUpperCase());

const displayValue = (value) => {
  if (value == null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const getArray = (response) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];

  const options = [
    response.requests, response.budgets, response.items,
    response.rows, response.results, response.data,
    response.data?.requests, response.data?.budgets,
    response.data?.items, response.data?.rows,
    response.data?.results, response.data?.data
  ];

  return options.find(Array.isArray) || [];
};

const getTaskId = (task) =>
  task?.id ?? task?.task_id ?? task?.taskId;

const getTaskRequestId = (task) =>
  task?.resource_id ?? task?.resourceId ??
  task?.purchase_request_id ?? task?.purchaseRequestId;

const getTaskNode = (task) =>
  String(task?.node_id ?? task?.nodeId ?? task?.active_node ?? "").toLowerCase();

const isFinanceTask = (task) =>
  FINANCE_NODE_NAMES.includes(getTaskNode(task)) ||
  getTaskNode(task).includes("finance");

const isPurchaseRequestTask = (task) =>
  !task?.resource_type || task.resource_type === "purchase_request";

const getBudgetId = (budget) =>
  budget?.id ?? budget?.budget_id;

const getBudgetAllocated = (budget) =>
  Number(budget?.allocatedAmount ?? budget?.allocated_amount ?? budget?.allocated ?? 0);

const getBudgetCommitted = (budget) =>
  Number(budget?.committedAmount ?? budget?.committed_amount ?? budget?.committed ?? 0);

const getBudgetReserved = (budget) =>
  Number(budget?.reservedAmount ?? budget?.reserved_amount ?? budget?.reserved ?? 0);

const getBudgetSpent = (budget) =>
  Number(budget?.spentAmount ?? budget?.spent_amount ?? budget?.spent ?? 0);

const getBudgetAvailable = (budget) => {
  const explicit = budget?.availableAmount ?? budget?.available_amount ??
    budget?.remainingAmount ?? budget?.remaining_amount;

  return explicit != null
    ? Number(explicit) || 0
    : Math.max(
        0,
        getBudgetAllocated(budget) -
        getBudgetCommitted(budget) -
        getBudgetReserved(budget) -
        getBudgetSpent(budget)
      );
};

const getBudgetTitle = (budget, index) =>
  `${budget?.departmentName ?? budget?.department_name ??
    budget?.departmentId ?? budget?.department_id ??
    `Organization Budget ${index + 1}`} Budget · ${budget?.fiscalYear ?? budget?.fiscal_year ?? "Unknown year"}`;

const getBudgetUtilization = (budget) => {
  if (budget?.utilizationPercentage !== undefined) {
    return Math.min(100, Math.max(0, Number(budget.utilizationPercentage) || 0));
  }

  const allocated = getBudgetAllocated(budget);

  return allocated
    ? Math.min(
        100,
        Math.max(
          0,
          ((getBudgetCommitted(budget) + getBudgetReserved(budget) + getBudgetSpent(budget)) / allocated) * 100
        )
      )
    : 0;
};

const getStatusClass = (status) => {
  const value = normalizeStatus(status);

  if (APPROVED_STATUSES.includes(value)) return "approved";
  if (REJECTED_STATUSES.includes(value)) return "rejected";
  if (value === "PENDING_FINANCE") return "pending";
  if (WAITING_STATUSES.includes(value)) return "waiting";

  return "default";
};

const emptyBudgetForm = {
  name: "",
  allocatedAmount: "",
  currency: "INR",
  fiscalYear: String(new Date().getFullYear())
};

const emptyDecision = {
  task: null,
  request: null,
  decision: "",
  reason: ""
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { id: "requests", label: "Employee Requests", icon: ClipboardList, group: "WORKSPACE" },
  { id: "pending", label: "Pending Approvals", icon: Clock3, group: "WORKSPACE" },
  { id: "budgets", label: "Budget Management", icon: Wallet, group: "FINANCE" },
  { id: "approvals", label: "Approval History", icon: History, group: "FINANCE" },
  { id: "analytics", label: "Analytics", icon: ChartNoAxesCombined, group: "INSIGHTS" }
];

export default function FinancePage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  });

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

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("authToken");

  const apiRequest = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const validation = Array.isArray(data.errors)
        ? data.errors.map((item) => item.message).filter(Boolean).join(", ")
        : "";

      throw new Error(
        validation ||
        data.message ||
        data.error ||
        `Server returned ${response.status}`
      );
    }

    return data;
  }, [token]);

  const apiGet = useCallback(
    (path) => apiRequest(`${API_BASE}${path}`),
    [apiRequest]
  );

  const loadFinanceData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");
    setBudgetError("");

    const [requestResult, budgetResult, taskResult, userResult] =
      await Promise.allSettled([
        apiGet("/procurement/requests"),
        apiGet("/budgets?page=1&limit=100"),
        apiRequest(`${WORKFLOW_BASE}/tasks/pending?limit=100&offset=0`),
        apiGet("/auth/me")
      ]);

    const errors = [];

    if (requestResult.status === "fulfilled") {
      setRequests(getArray(requestResult.value));
    } else {
      setRequests([]);
      errors.push(requestResult.reason?.message || "Unable to load procurement requests.");
    }

    if (budgetResult.status === "fulfilled") {
      setBudgets(getArray(budgetResult.value));
    } else {
      setBudgets([]);
      setBudgetError(budgetResult.reason?.message || "Unable to load budgets.");
    }

    if (taskResult.status === "fulfilled") {
      setPendingTasks(
        getArray(taskResult.value).filter(
          (task) =>
            isFinanceTask(task) &&
            isPurchaseRequestTask(task) &&
            normalizeStatus(task.status) === "PENDING"
        )
      );
    } else {
      setPendingTasks([]);
      errors.push(taskResult.reason?.message || "Unable to load Finance approval tasks.");
    }

    if (userResult.status === "fulfilled") {
      const current =
        userResult.value?.user ??
        userResult.value?.data?.user ??
        userResult.value?.data ??
        userResult.value;

      if (current && typeof current === "object") {
        setUser((old) => ({ ...old, ...current }));
        localStorage.setItem("user", JSON.stringify(current));
      }
    }

    setError(errors.join(" "));
    setLoading(false);
    setRefreshing(false);
  }, [apiGet, apiRequest]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, departmentFilter, sortBy, activeTab]);

  const financeName =
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Finance Manager";

  const financeTaskRows = useMemo(() => {
    return pendingTasks.map((task) => {
      const resourceId = getTaskRequestId(task);

      const found = requests.find(
        (request) => String(getRequestId(request)) === String(resourceId)
      );

      const fallback = {
        id: resourceId,
        request_number: task.request_number,
        total_amount: task.total_amount,
        currency: task.currency,
        requester_id: task.requester_id,
        status: "PENDING_FINANCE"
      };

      return {
        task,
        request: found || fallback,
        requestFound: Boolean(found)
      };
    });
  }, [pendingTasks, requests]);

  const pendingFinanceRequests = useMemo(
    () => financeTaskRows.map((row) => row.request),
    [financeTaskRows]
  );

  const waitingRequests = useMemo(
    () => requests.filter((request) => WAITING_STATUSES.includes(getStatus(request))),
    [requests]
  );

  const approvedRequests = useMemo(
    () => requests.filter((request) => APPROVED_STATUSES.includes(getStatus(request))),
    [requests]
  );

  const rejectedRequests = useMemo(
    () => requests.filter((request) => REJECTED_STATUSES.includes(getStatus(request))),
    [requests]
  );

  const totalAllocated = formatCurrencyTotals(budgets, getBudgetAllocated);
  const totalCommitted = formatCurrencyTotals(budgets, getBudgetCommitted);
  const totalSpent = formatCurrencyTotals(budgets, getBudgetSpent);
  const totalAvailable = formatCurrencyTotals(budgets, getBudgetAvailable);
  const pendingAmount = formatCurrencyTotals(pendingFinanceRequests, getAmount);
  const approvedAmount = formatCurrencyTotals(approvedRequests, getAmount);
  const rejectedAmount = formatCurrencyTotals(rejectedRequests, getAmount);

  const departments = useMemo(
    () => [
      ...new Set(
        requests
          .map(getDepartment)
          .filter((value) => value && value !== "Not provided")
      )
    ].sort(),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    let rows = [...requests];

    if (activeTab === "pending") {
      const ids = new Set(
        pendingFinanceRequests.map((request) => String(getRequestId(request)))
      );

      rows = rows.filter((request) =>
        ids.has(String(getRequestId(request)))
      );
    }

    if (activeTab === "approvals") {
      rows = rows.filter(
        (request) =>
          APPROVED_STATUSES.includes(getStatus(request)) ||
          REJECTED_STATUSES.includes(getStatus(request))
      );
    }

    if (statusFilter === "waiting") {
      rows = rows.filter((request) =>
        WAITING_STATUSES.includes(getStatus(request))
      );
    }

    if (statusFilter === "approved") {
      rows = rows.filter((request) =>
        APPROVED_STATUSES.includes(getStatus(request))
      );
    }

    if (statusFilter === "rejected") {
      rows = rows.filter((request) =>
        REJECTED_STATUSES.includes(getStatus(request))
      );
    }

    if (statusFilter === "pending") {
      const ids = new Set(
        pendingFinanceRequests.map((request) => String(getRequestId(request)))
      );

      rows = rows.filter((request) =>
        ids.has(String(getRequestId(request)))
      );
    }

    if (departmentFilter !== "all") {
      rows = rows.filter(
        (request) => getDepartment(request) === departmentFilter
      );
    }

    const term = searchTerm.toLowerCase().trim();

    if (term) {
      rows = rows.filter((request) =>
        [
          getRequestNumber(request),
          getEmployeeName(request),
          getEmployeeEmail(request),
          getRequesterId(request),
          getProductName(request),
          getSupplier(request),
          getDepartment(request),
          getStatus(request),
          request?.description,
          request?.justification,
          request?.budget_id,
          request?.budgetId
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }

    rows.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at || a.createdAt || 0) -
          new Date(b.created_at || b.createdAt || 0);
      }

      if (sortBy === "amount-high") return getAmount(b) - getAmount(a);
      if (sortBy === "amount-low") return getAmount(a) - getAmount(b);

      return new Date(b.created_at || b.createdAt || 0) -
        new Date(a.created_at || a.createdAt || 0);
    });

    return rows;
  }, [
    requests,
    activeTab,
    statusFilter,
    departmentFilter,
    searchTerm,
    sortBy,
    pendingFinanceRequests
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));

  const paginatedRequests = filteredRequests.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const analytics = useMemo(() => {
    const now = new Date();

    const monthly = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("en-IN", { month: "short" }),
        count: 0,
        amount: 0
      };
    });

    requests.forEach((request) => {
      const date = new Date(request.created_at || request.createdAt || "");

      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = monthly.find((item) => item.key === key);

      if (bucket) {
        bucket.count += 1;
        bucket.amount += getAmount(request);
      }
    });

    const departmentTotals = {};

    requests.forEach((request) => {
      const department = getDepartment(request);
      if (department === "Not provided") return;

      departmentTotals[department] =
        (departmentTotals[department] || 0) + getAmount(request);
    });

    const departmentsByAmount = Object.entries(departmentTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const maxDepartmentAmount = Math.max(
      1,
      ...departmentsByAmount.map((item) => item.amount)
    );

    const maxMonthlyCount = Math.max(
      1,
      ...monthly.map((item) => item.count)
    );

    return {
      monthly,
      departmentsByAmount,
      maxDepartmentAmount,
      maxMonthlyCount,
      total: requests.length,
      approved: approvedRequests.length,
      rejected: rejectedRequests.length,
      pending: pendingTasks.length
    };
  }, [requests, approvedRequests, rejectedRequests, pendingTasks]);

  const handleLogout = () => {
    ["token", "accessToken", "authToken", "user", "userRole"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    navigate("/login", { replace: true });
  };

  const openDecision = (task, request, decision) => {
    setError("");
    setSuccess("");
    setDecisionModal({
      task,
      request,
      decision,
      reason: ""
    });
  };

  const submitDecision = async (event) => {
    event.preventDefault();

    const { task, decision, reason } = decisionModal;
    const taskId = getTaskId(task);

    if (!taskId) {
      setError("Approval task ID is missing.");
      return;
    }

    if (!reason.trim()) {
      setError("Please enter your Finance remarks.");
      return;
    }

    if (reason.trim().length > 1000) {
      setError("Remarks cannot exceed 1000 characters.");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `${WORKFLOW_BASE}/tasks/${encodeURIComponent(taskId)}/actions`,
        {
          method: "POST",
          body: JSON.stringify({
            action: decision === "approve" ? "approve" : "reject",
            comment: reason.trim()
          })
        }
      );

      setSuccess(
        decision === "approve"
          ? "Finance approval completed successfully."
          : "The procurement request has been rejected."
      );

      setDecisionModal(emptyDecision);
      setSelectedRequest(null);

      await loadFinanceData(true);
    } catch (err) {
      setError(err.message || "Unable to process the Finance approval.");
    } finally {
      setProcessing(false);
    }
  };

  const openCreateBudget = () => {
    setEditingBudget(null);
    setBudgetForm({
      ...emptyBudgetForm,
      fiscalYear: String(new Date().getFullYear())
    });
    setBudgetError("");
    setBudgetModalOpen(true);
  };

  const openEditBudget = (budget) => {
    setEditingBudget(budget);

    setBudgetForm({
      name: getBudgetTitle(budget, 0),
      allocatedAmount: String(getBudgetAllocated(budget)),
      currency: budget.currency || "INR",
      fiscalYear: String(
        budget.fiscalYear ??
        budget.fiscal_year ??
        new Date().getFullYear()
      )
    });

    setBudgetError("");
    setBudgetModalOpen(true);
  };

  const updateBudgetField = (event) => {
    setBudgetForm((old) => ({
      ...old,
      [event.target.name]: event.target.value
    }));
  };

  const saveBudget = async (event) => {
    event.preventDefault();

    const amount = Number(budgetForm.allocatedAmount);
    const year = Number(budgetForm.fiscalYear);

    if (!budgetForm.name.trim()) {
      setBudgetError("Enter a budget name.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError("Enter an allocated amount greater than zero.");
      return;
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setBudgetError("Enter a valid fiscal year between 2000 and 2100.");
      return;
    }

    const payload = {
      name: budgetForm.name.trim(),
      allocatedAmount: amount,
      currency: budgetForm.currency.toUpperCase(),
      fiscalYear: year
    };

    setSavingBudget(true);
    setBudgetError("");

    try {
      if (editingBudget) {
        const id = getBudgetId(editingBudget);

        if (!id) throw new Error("Budget ID is missing.");

        await apiRequest(
          `${API_BASE}/budgets/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );

        setSuccess("Budget updated successfully.");
      } else {
        await apiRequest(`${API_BASE}/budgets`, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        setSuccess("Budget created or existing allocation updated successfully.");
      }

      setBudgetModalOpen(false);
      setEditingBudget(null);
      setBudgetForm(emptyBudgetForm);

      await loadFinanceData(true);
      setActiveTab("budgets");
    } catch (err) {
      setBudgetError(err.message || "Unable to save budget.");
    } finally {
      setSavingBudget(false);
    }
  };

  const exportRequests = (rows = filteredRequests) => {
    const headers = [
      "Request Number", "Request ID", "Employee", "Email",
      "Department", "Product", "Supplier", "Quantity",
      "Unit Price", "Amount", "Currency", "Status", "Created At"
    ];

    const csvCell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      headers,
      ...rows.map((request) => [
        getRequestNumber(request),
        getRequestId(request),
        getEmployeeName(request),
        getEmployeeEmail(request),
        getDepartment(request),
        getProductName(request),
        getSupplier(request),
        getQuantity(request),
        getUnitPrice(request),
        getAmount(request),
        getCurrency(request),
        getStatus(request),
        request.created_at ?? request.createdAt ?? ""
      ])
    ].map((row) => row.map(csvCell).join(","));

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `etdox-finance-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const getRequestDetails = (request) => {
    if (!request) return [];

    const raw = request.raw && typeof request.raw === "object"
      ? request.raw
      : {};

    const combined = { ...raw, ...request };
    delete combined.raw;

    return Object.entries(combined)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => ({
        key,
        label: formatLabel(key),
        value
      }));
  };

  const pageTitles = {
    overview: "Finance Dashboard",
    requests: "Employee Requests",
    pending: "Pending Approvals",
    budgets: "Budget Management",
    approvals: "Approval History",
    analytics: "Financial Analytics"
  };

  const renderStatCard = (label, value, description, Icon, color, extra = null) => (
    <article className="finance-stat-card" key={label}>
      <div className="finance-stat-top">
        <span>{label}</span>
        <span className={`finance-stat-icon ${color}`}>
          <Icon size={19} />
        </span>
      </div>
      <h3>{value}</h3>
      <p>{description}</p>
      {extra}
    </article>
  );

  const renderRequestsTable = (items, showActions = true) => (
    <div className="finance-table-wrapper">
      <table className="finance-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Employee</th>
            <th>Product</th>
            <th>Supplier</th>
            <th>Department</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {items.length ? items.map((request, index) => {
            const id = getRequestId(request) || index;

            const taskRow = financeTaskRows.find(
              (row) =>
                String(getRequestId(row.request)) ===
                String(getRequestId(request))
            );

            const status = taskRow ? "PENDING_FINANCE" : getStatus(request);
            const employee = getEmployeeName(request);

            return (
              <tr key={id}>
                <td>
                  <strong>{getRequestNumber(request)}</strong>
                  <small className="sub-value">{String(id)}</small>
                </td>

                <td>
                  <div className="finance-employee-cell">
                    <span className="finance-mini-avatar">
                      {employee.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{employee}</strong>
                      <small>{getEmployeeEmail(request)}</small>
                    </div>
                  </div>
                </td>

                <td>
                  <div className="finance-product-cell">
                    <Package size={15} />
                    {getProductName(request)}
                  </div>
                </td>

                <td>{getSupplier(request)}</td>
                <td>{getDepartment(request)}</td>

                <td className="finance-amount">
                  {money(getAmount(request), getCurrency(request))}
                </td>

                <td>
                  <span className={`finance-status ${getStatusClass(status)}`}>
                    {status.replaceAll("_", " ")}
                  </span>
                </td>

                <td>
                  <div className="finance-row-actions">
                    <button
                      className="finance-icon-button"
                      title="View complete details"
                      aria-label="View request details"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <Eye size={15} />
                    </button>

                    {showActions && taskRow && (
                      <>
                        <button
                          className="finance-approve-button"
                          title="Approve Finance task"
                          aria-label="Approve request"
                          onClick={() => openDecision(taskRow.task, request, "approve")}
                        >
                          <Check size={14} />
                        </button>

                        <button
                          className="finance-reject-button"
                          title="Reject Finance task"
                          aria-label="Reject request"
                          onClick={() => openDecision(taskRow.task, request, "reject")}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan="8" className="finance-empty">
                <ClipboardList size={28} />
                <strong>No requests found</strong>
                <span>There are no records matching your current filters.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderBudgetCards = (list = budgets) => (
    list.length ? (
      <div className="finance-budget-grid">
        {list.map((budget, index) => {
          const allocated = getBudgetAllocated(budget);
          const percentage = getBudgetUtilization(budget);

          return (
            <article className="finance-budget-card" key={getBudgetId(budget) || index}>
              <div className="finance-budget-card-heading">
                <div>
                  <h4>{getBudgetTitle(budget, index)}</h4>
                  <p>{budget.costCenterId || budget.cost_center_id || "Organization budget"}</p>
                </div>

                <button
                  className="finance-icon-button"
                  onClick={() => openEditBudget(budget)}
                  title="Edit budget"
                >
                  <Pencil size={14} />
                </button>
              </div>

              <div className="finance-budget-highlight">
                <span>Allocated budget</span>
                <strong>{money(allocated, budget.currency)}</strong>
              </div>

              <div className="finance-progress">
                <span style={{ width: `${percentage}%` }} />
              </div>

              <div className="finance-progress-caption">
                <span>{percentage.toFixed(1)}% utilized</span>
                <span>{money(getBudgetAvailable(budget), budget.currency)} available</span>
              </div>

              {[
                ["Committed", getBudgetCommitted(budget)],
                ["Reserved", getBudgetReserved(budget)],
                ["Spent", getBudgetSpent(budget)],
                ["Available", getBudgetAvailable(budget)]
              ].map(([label, value]) => (
                <div className="finance-budget-line" key={label}>
                  <span>{label}</span>
                  <strong className={label === "Available" ? "finance-available" : ""}>
                    {money(value, budget.currency)}
                  </strong>
                </div>
              ))}

              <div className="finance-budget-meta">
                <span>Fiscal year: {budget.fiscalYear ?? budget.fiscal_year ?? "—"}</span>
                <span>{budget.currency || "INR"}</span>
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <div className="finance-empty finance-budget-empty">
        <Wallet size={28} />
        <strong>No budgets found</strong>
        <span>No budget records were returned by the server.</span>
        <button className="finance-button primary" onClick={openCreateBudget}>
          <Plus size={15} /> Create Budget
        </button>
      </div>
    )
  );

  const renderMonthlyChart = () => (
    <div className="finance-chart-card">
      <div className="finance-chart-heading">
        <div>
          <h3>Request Activity</h3>
          <p>Requests created during the last six calendar months</p>
        </div>
        <span className="finance-chart-icon"><Activity size={18} /></span>
      </div>

      <div className="finance-monthly-chart">
        {analytics.monthly.map((month) => (
          <div className="finance-month-column" key={month.key}>
            <strong>{month.count}</strong>
            <div className="finance-month-track">
              <span
                style={{
                  height: `${Math.max(5, (month.count / analytics.maxMonthlyCount) * 100)}%`
                }}
              />
            </div>
            <small>{month.label}</small>
          </div>
        ))}
      </div>

      <div className="finance-chart-legend">
        <span><i /> Monthly request volume</span>
        <strong>{analytics.total} total requests</strong>
      </div>
    </div>
  );

  const renderDepartmentChart = () => (
    <div className="finance-chart-card">
      <div className="finance-chart-heading">
        <div>
          <h3>Department Spending</h3>
          <p>Top departments by procurement request value</p>
        </div>
        <span className="finance-chart-icon"><Building2 size={18} /></span>
      </div>

      {analytics.departmentsByAmount.length ? (
        <div className="finance-department-chart">
          {analytics.departmentsByAmount.map((item) => (
            <div className="finance-department-row" key={item.name}>
              <div className="finance-department-label">
                <strong>{item.name}</strong>
                <span>{money(item.amount)}</span>
              </div>

              <div className="finance-department-track">
                <span
                  style={{
                    width: `${(item.amount / analytics.maxDepartmentAmount) * 100}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="finance-chart-empty">Department spending data is not available yet.</div>
      )}
    </div>
  );

  const renderStatusChart = () => {
    const values = [
      { label: "Approved", count: approvedRequests.length, color: "green" },
      { label: "Rejected", count: rejectedRequests.length, color: "red" },
      { label: "Waiting", count: waitingRequests.length, color: "amber" },
      { label: "Finance pending", count: pendingTasks.length, color: "blue" }
    ];

    const total = values.reduce((sum, item) => sum + item.count, 0);

    return (
      <div className="finance-chart-card">
        <div className="finance-chart-heading">
          <div>
            <h3>Approval Overview</h3>
            <p>Current request status distribution</p>
          </div>
          <span className="finance-chart-icon"><ShieldCheck size={18} /></span>
        </div>

        <div className="finance-status-chart">
          <div className="finance-status-total">
            <strong>{total}</strong>
            <span>Tracked items</span>
          </div>

          <div className="finance-status-breakdown">
            {values.map((item) => (
              <div className="finance-status-breakdown-row" key={item.label}>
                <span className={`finance-status-dot ${item.color}`} />
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="finance-app">
      <aside className={`finance-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="finance-brand">
          <span className="finance-brand-icon">
            <Building2 size={22} />
          </span>
          <span>ETDOX<span>.</span></span>
        </div>

        <div className="finance-workspace">
          <div className="finance-workspace-label">FINANCE WORKSPACE</div>

          {["WORKSPACE", "FINANCE", "INSIGHTS"].map((group) => (
            <React.Fragment key={group}>
              <p className="finance-nav-group">{group}</p>

              <nav className="finance-nav">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      className={activeTab === item.id ? "active" : ""}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                        setError("");
                        setSuccess("");
                        setBudgetError("");
                      }}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>

                      {activeTab === item.id && (
                        <ChevronRight size={15} className="finance-nav-chevron" />
                      )}

                      {item.id === "pending" && pendingTasks.length > 0 && (
                        <span className="finance-nav-count">{pendingTasks.length}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </React.Fragment>
          ))}
        </div>

        <div className="finance-sidebar-bottom">
          <div className="finance-sidebar-support">
            <div className="finance-support-icon"><ShieldCheck size={17} /></div>
            <div>
              <strong>Secure workspace</strong>
              <small>Finance operations</small>
            </div>
          </div>

          <div className="finance-user-mini">
            <div className="finance-avatar">{financeName.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{financeName}</strong>
              <small>{user?.email || "Finance account"}</small>
            </div>
          </div>

          <button className="finance-logout" onClick={handleLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="finance-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="finance-main">
        <header className="finance-topbar">
          <div className="finance-topbar-left">
            <button
              className="finance-mobile-menu"
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div>
              <div className="finance-breadcrumb">
                ETDOX <ChevronRight size={12} /> Finance <ChevronRight size={12} />
                <span>{pageTitles[activeTab]}</span>
              </div>
              <h1>{pageTitles[activeTab]}</h1>
              <p>Financial operations, approvals and procurement intelligence.</p>
            </div>
          </div>

          <div className="finance-topbar-right">
            <button
              className="finance-button"
              onClick={() => loadFinanceData(true)}
              disabled={refreshing}
            >
              {refreshing
                ? <LoaderCircle size={14} className="spin" />
                : <RefreshCw size={14} />}
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <div className="finance-topbar-user">
              <div className="finance-avatar">{financeName.charAt(0).toUpperCase()}</div>
              <div>
                <strong>{financeName}</strong>
                <small>Finance Manager</small>
              </div>
            </div>
          </div>
        </header>

        <div className="finance-content">
          {error && (
            <div className="finance-alert error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}

          {success && (
            <div className="finance-alert success">
              <CheckCircle2 size={16} />
              <span>{success}</span>
              <button onClick={() => setSuccess("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="finance-loading">
              <div>
                <LoaderCircle size={28} className="spin" />
                <p>Loading Finance workspace...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <span className="finance-eyebrow">FINANCE CONTROL CENTER</span>
                      <h2>Welcome back, {financeName} 👋</h2>
                      <p>Monitor procurement activity, review approvals and control organizational spending.</p>
                    </div>

                    <button className="finance-button primary" onClick={() => setActiveTab("pending")}>
                      <ClipboardList size={15} /> Review Approvals
                    </button>
                  </section>

                  <section className="finance-stats">
                    {renderStatCard("Awaiting Finance", pendingTasks.length, "Tasks assigned to your account", Clock3, "amber")}
                    {renderStatCard("Waiting for Manager", waitingRequests.length, "Requests in earlier workflow stages", ClipboardList, "blue")}
                    {renderStatCard("Approved Requests", approvedRequests.length, "Successfully approved requests", CheckCircle2, "green")}
                    {renderStatCard("Pending Amount", pendingAmount, "Value awaiting Finance review", IndianRupee, "purple")}
                  </section>

                  <section className="finance-stats finance-budget-stats">
                    {renderStatCard("Total Allocated", totalAllocated, "Organization budget allocations", Wallet, "blue")}
                    {renderStatCard("Committed", totalCommitted, "Committed budget amount", FileText, "purple")}
                    {renderStatCard("Spent", totalSpent, "Recorded expenditure", TrendingUp, "amber")}
                    {renderStatCard("Available Budget", totalAvailable, "Remaining budget amount", CircleDollarSign, "green")}
                  </section>

                  <section className="finance-chart-grid">
                    {renderMonthlyChart()}
                    {renderStatusChart()}
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Requests Awaiting Finance</h3>
                        <p>Actionable approval tasks assigned to your Finance account.</p>
                      </div>
                      <button className="finance-button" onClick={() => setActiveTab("pending")}>
                        View all <ChevronRight size={14} />
                      </button>
                    </div>

                    {renderRequestsTable(pendingFinanceRequests.slice(0, 5))}
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Budget Summary</h3>
                        <p>Current allocation and utilization overview.</p>
                      </div>
                      <button className="finance-button" onClick={() => setActiveTab("budgets")}>
                        Manage budgets <ChevronRight size={14} />
                      </button>
                    </div>

                    {renderBudgetCards(budgets.slice(0, 4))}
                  </section>
                </>
              )}

              {(activeTab === "requests" || activeTab === "pending" || activeTab === "approvals") && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <span className="finance-eyebrow">
                        {activeTab === "pending" ? "ACTION REQUIRED" : "PROCUREMENT WORKFLOW"}
                      </span>
                      <h2>
                        {activeTab === "pending"
                          ? "Pending Finance Approvals"
                          : activeTab === "approvals"
                            ? "Finance Approval History"
                            : "Employee Procurement Requests"}
                      </h2>
                      <p>
                        {activeTab === "pending"
                          ? "Review assigned tasks and approve or reject employee requests."
                          : activeTab === "approvals"
                            ? "Review completed approval and rejection decisions."
                            : "Search, filter and review procurement submissions."}
                      </p>
                    </div>

                    <button
                      className="finance-button"
                      onClick={() => exportRequests(
                        activeTab === "approvals"
                          ? [...approvedRequests, ...rejectedRequests]
                          : activeTab === "pending"
                            ? pendingFinanceRequests
                            : filteredRequests
                      )}
                    >
                      <Download size={15} /> Export CSV
                    </button>
                  </section>

                  <section className="finance-stats finance-compact-stats">
                    {renderStatCard("Finance Pending", pendingTasks.length, "Assigned tasks", Clock3, "amber")}
                    {renderStatCard("Waiting for Manager", waitingRequests.length, "Earlier workflow stage", ClipboardList, "blue")}
                    {renderStatCard("Approved", approvedRequests.length, approvedAmount, CheckCircle2, "green")}
                    {renderStatCard("Rejected", rejectedRequests.length, rejectedAmount, XCircle, "red")}
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>
                          {activeTab === "pending"
                            ? "Actionable Finance Tasks"
                            : activeTab === "approvals"
                              ? "Processed Requests"
                              : "All Employee Requests"}
                        </h3>
                        <p>
                          Finance pending: {pendingTasks.length}
                          <span className="dot-separator"> · </span>
                          Waiting: {waitingRequests.length}
                          <span className="dot-separator"> · </span>
                          Approved: {approvedRequests.length}
                          <span className="dot-separator"> · </span>
                          Rejected: {rejectedRequests.length}
                        </p>
                      </div>
                      <span className="finance-result-count">{filteredRequests.length} results</span>
                    </div>

                    <div className="finance-toolbar">
                      <div className="finance-search">
                        <Search size={15} />
                        <input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search employee, product, supplier, request ID..."
                        />
                        {searchTerm && (
                          <button onClick={() => setSearchTerm("")} aria-label="Clear search">
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <div className="finance-filter-group">
                        <div className="finance-select-wrap">
                          <Filter size={14} />
                          <select
                            className="finance-filter"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                          >
                            <option value="all">All statuses</option>
                            <option value="pending">Awaiting Finance</option>
                            <option value="waiting">Waiting for Manager</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>

                        <select
                          className="finance-filter"
                          value={departmentFilter}
                          onChange={(event) => setDepartmentFilter(event.target.value)}
                        >
                          <option value="all">All departments</option>
                          {departments.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>

                        <select
                          className="finance-filter"
                          value={sortBy}
                          onChange={(event) => setSortBy(event.target.value)}
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                          <option value="amount-high">Amount: high-low</option>
                          <option value="amount-low">Amount: low-high</option>
                        </select>
                      </div>
                    </div>

                    {renderRequestsTable(paginatedRequests, activeTab !== "approvals")}

                    <div className="finance-pagination">
                      <span>
                        Showing {filteredRequests.length ? (page - 1) * PAGE_SIZE + 1 : 0}
                        –{Math.min(page * PAGE_SIZE, filteredRequests.length)}
                        {" "}of {filteredRequests.length}
                      </span>

                      <div>
                        <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                          Previous
                        </button>
                        <span>Page {page} of {pageCount}</span>
                        <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                          Next
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {activeTab === "budgets" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <span className="finance-eyebrow">FINANCIAL PLANNING</span>
                      <h2>Budget Management</h2>
                      <p>Manage organization allocations and monitor committed, spent and available funds.</p>
                    </div>

                    <button className="finance-button primary" onClick={openCreateBudget}>
                      <Plus size={15} /> Create Budget
                    </button>
                  </section>

                  {budgetError && (
                    <div className="finance-alert error">
                      <AlertCircle size={16} /> {budgetError}
                    </div>
                  )}

                  <section className="finance-stats finance-budget-stats">
                    {renderStatCard("Total Allocated", totalAllocated, "Budget allocation", Wallet, "blue")}
                    {renderStatCard("Total Committed", totalCommitted, "Committed funds", FileText, "purple")}
                    {renderStatCard("Total Spent", totalSpent, "Recorded spending", TrendingUp, "amber")}
                    {renderStatCard("Total Available", totalAvailable, "Remaining funds", CircleDollarSign, "green")}
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Organization Budgets</h3>
                        <p>Monitor actual allocations, utilization and available funds.</p>
                      </div>
                      <span className="finance-result-count">{budgets.length} budgets</span>
                    </div>

                    {renderBudgetCards()}
                  </section>
                </>
              )}

              {activeTab === "analytics" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <span className="finance-eyebrow">FINANCIAL INTELLIGENCE</span>
                      <h2>Analytics & Insights</h2>
                      <p>Understand request volume, approval activity and department spending.</p>
                    </div>

                    <button className="finance-button" onClick={() => exportRequests(requests)}>
                      <Download size={15} /> Export data
                    </button>
                  </section>

                  <section className="finance-stats">
                    {renderStatCard("Total Requests", analytics.total, "All loaded procurement records", ClipboardList, "blue")}
                    {renderStatCard("Approved", analytics.approved, "Approved requests", CheckCircle2, "green")}
                    {renderStatCard("Rejected", analytics.rejected, "Rejected requests", XCircle, "red")}
                    {renderStatCard("Awaiting Finance", analytics.pending, "Actionable finance tasks", Clock3, "amber")}
                  </section>

                  <section className="finance-chart-grid">
                    {renderMonthlyChart()}
                    {renderStatusChart()}
                  </section>

                  <section className="finance-chart-grid">
                    {renderDepartmentChart()}

                    <div className="finance-chart-card finance-insight-card">
                      <div className="finance-chart-heading">
                        <div>
                          <h3>Financial Snapshot</h3>
                          <p>Current budget position</p>
                        </div>
                        <span className="finance-chart-icon"><CircleDollarSign size={18} /></span>
                      </div>

                      <div className="finance-insight-list">
                        <div><span>Total Allocated</span><strong>{totalAllocated}</strong></div>
                        <div><span>Committed</span><strong>{totalCommitted}</strong></div>
                        <div><span>Spent</span><strong>{totalSpent}</strong></div>
                        <div><span>Available</span><strong className="finance-available">{totalAvailable}</strong></div>
                        <div><span>Pending Approval Value</span><strong>{pendingAmount}</strong></div>
                      </div>

                      <button className="finance-button" onClick={() => setActiveTab("budgets")}>
                        View budgets <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Department Spending</h3>
                        <p>Request values grouped by department.</p>
                      </div>
                    </div>
                    {renderDepartmentChart()}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {selectedRequest && (
        <div
          className="finance-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedRequest(null);
          }}
        >
          <div className="finance-modal finance-details-modal">
            <div className="finance-modal-heading">
              <div>
                <span className="finance-eyebrow">REQUEST DETAILS</span>
                <h3>Complete Procurement Request</h3>
                <p>{getRequestNumber(selectedRequest)}</p>
              </div>
              <button className="finance-modal-close" onClick={() => setSelectedRequest(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="finance-detail-section">
              <h4><User size={15} /> Employee Information</h4>
              <div className="finance-detail-grid">
                <div className="finance-detail"><small>Employee Name</small><strong>{getEmployeeName(selectedRequest)}</strong></div>
                <div className="finance-detail"><small>Employee ID</small><strong>{displayValue(getRequesterId(selectedRequest))}</strong></div>
                <div className="finance-detail"><small>Email Address</small><strong>{getEmployeeEmail(selectedRequest)}</strong></div>
                <div className="finance-detail"><small>Department</small><strong>{getDepartment(selectedRequest)}</strong></div>
              </div>
            </div>

            <div className="finance-detail-section">
              <h4><Package size={15} /> Product Information</h4>
              <div className="finance-detail-grid">
                <div className="finance-detail"><small>Product Name</small><strong>{getProductName(selectedRequest)}</strong></div>
                <div className="finance-detail"><small>Supplier</small><strong>{getSupplier(selectedRequest)}</strong></div>
                <div className="finance-detail"><small>Quantity</small><strong>{displayValue(getQuantity(selectedRequest))}</strong></div>
                <div className="finance-detail"><small>Unit Price</small><strong>{money(getUnitPrice(selectedRequest), getCurrency(selectedRequest))}</strong></div>
                <div className="finance-detail"><small>Total Amount</small><strong>{money(getAmount(selectedRequest), getCurrency(selectedRequest))}</strong></div>
                <div className="finance-detail"><small>Currency</small><strong>{getCurrency(selectedRequest)}</strong></div>
                <div className="finance-detail"><small>Budget ID</small><strong>{displayValue(selectedRequest.budgetId ?? selectedRequest.budget_id)}</strong></div>
                <div className="finance-detail"><small>Request Status</small><strong>{getStatus(selectedRequest).replaceAll("_", " ")}</strong></div>
              </div>
            </div>

            <div className="finance-detail-section">
              <h4><FileText size={15} /> Business Justification</h4>
              <div className="finance-detail finance-justification">
                <strong>
                  {selectedRequest.justification ||
                    selectedRequest.description ||
                    "No justification was returned by the API."}
                </strong>
              </div>
            </div>

            <div className="finance-detail-section">
              <h4><History size={15} /> Approval Information</h4>
              <div className="finance-detail-grid">
                {[
                  ["Manager Decision", selectedRequest.managerDecision ?? selectedRequest.manager_decision],
                  ["Finance Decision", selectedRequest.financeDecision ?? selectedRequest.finance_decision],
                  ["Submitted At", formatDate(selectedRequest.submittedAt || selectedRequest.submitted_at)],
                  ["Created At", formatDate(selectedRequest.createdAt || selectedRequest.created_at)],
                  ["Updated At", formatDate(selectedRequest.updatedAt || selectedRequest.updated_at)],
                  ["Workflow Run ID", selectedRequest.workflowRunId || selectedRequest.workflow_run_id]
                ].map(([label, value]) => (
                  <div className="finance-detail" key={label}>
                    <small>{label}</small>
                    <strong>{displayValue(value)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {Array.isArray(selectedRequest.history) && selectedRequest.history.length > 0 && (
              <div className="finance-detail-section">
                <h4><History size={15} /> Request History</h4>
                <div className="finance-history">
                  {selectedRequest.history.map((item, index) => (
                    <div className="finance-history-item" key={item.id || index}>
                      <strong>{item.action || item.status || item.decision || "Request activity"}</strong>
                      <p>{item.comment || item.remarks || item.description || "No additional remarks"}</p>
                      <small>
                        {item.actor_name || item.user_name || item.actor || "System"}
                        {" · "}
                        {formatDate(item.created_at || item.createdAt || item.timestamp)}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="finance-detail-section">
              <h4><FileText size={15} /> All Other Values Returned by the API</h4>
              <div className="finance-all-fields">
                {getRequestDetails(selectedRequest).map(({ key, label, value }) => (
                  <div className="finance-detail" key={key}>
                    <small>{label}</small>
                    <strong>{displayValue(value)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="finance-modal-actions">
              <button className="finance-button" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionModal.task && (
        <div
          className="finance-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) {
              setDecisionModal(emptyDecision);
            }
          }}
        >
          <div className="finance-modal finance-decision-modal">
            <div className="finance-modal-heading">
              <div>
                <span className="finance-eyebrow">FINANCE WORKFLOW</span>
                <h3>
                  {decisionModal.decision === "approve"
                    ? "Approve Employee Request"
                    : "Reject Employee Request"}
                </h3>
                <p>Confirm your Finance decision with an audit remark.</p>
              </div>

              <button
                className="finance-modal-close"
                disabled={processing}
                onClick={() => setDecisionModal(emptyDecision)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="finance-detail-grid">
              <div className="finance-detail"><small>Request Number</small><strong>{getRequestNumber(decisionModal.request)}</strong></div>
              <div className="finance-detail"><small>Employee</small><strong>{getEmployeeName(decisionModal.request)}</strong></div>
              <div className="finance-detail"><small>Product</small><strong>{getProductName(decisionModal.request)}</strong></div>
              <div className="finance-detail"><small>Amount</small><strong>{money(getAmount(decisionModal.request), getCurrency(decisionModal.request))}</strong></div>
              <div className="finance-detail full"><small>Approval Task ID</small><strong>{getTaskId(decisionModal.task)}</strong></div>
            </div>

            <form onSubmit={submitDecision}>
              <div className="finance-modal-field">
                <label>
                  {decisionModal.decision === "approve"
                    ? "Finance Approval Remarks *"
                    : "Reason for Rejection *"}
                </label>

                <textarea
                  value={decisionModal.reason}
                  onChange={(event) =>
                    setDecisionModal((old) => ({
                      ...old,
                      reason: event.target.value
                    }))
                  }
                  placeholder="Enter your decision remarks..."
                  required
                  minLength={2}
                  maxLength={1000}
                  disabled={processing}
                />

                <small>{decisionModal.reason.length}/1000 characters</small>
              </div>

              <div className="finance-modal-actions">
                <button
                  type="button"
                  className="finance-button"
                  disabled={processing}
                  onClick={() => setDecisionModal(emptyDecision)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`finance-button ${decisionModal.decision === "reject" ? "danger" : "primary"}`}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <LoaderCircle size={15} className="spin" />
                      Processing...
                    </>
                  ) : decisionModal.decision === "approve" ? (
                    <>
                      <Check size={15} /> Confirm Approval
                    </>
                  ) : (
                    <>
                      <XCircle size={15} /> Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {budgetModalOpen && (
        <div
          className="finance-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingBudget) {
              setBudgetModalOpen(false);
            }
          }}
        >
          <div className="finance-modal finance-budget-modal">
            <div className="finance-modal-heading">
              <div>
                <span className="finance-eyebrow">BUDGET CONFIGURATION</span>
                <h3>{editingBudget ? "Edit Budget" : "Create New Budget"}</h3>
              </div>

              <button
                className="finance-modal-close"
                disabled={savingBudget}
                onClick={() => setBudgetModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {budgetError && (
              <div className="finance-alert error">
                <AlertCircle size={15} /> {budgetError}
              </div>
            )}

            <form onSubmit={saveBudget}>
              <div className="finance-form-grid">
                <div className="finance-form-field full">
                  <label>Budget Name *</label>
                  <input
                    name="name"
                    value={budgetForm.name}
                    onChange={updateBudgetField}
                    placeholder="Organization Annual Budget"
                    required
                  />
                  <small>
                    The current backend requires this field for validation; the repository may not persist the display name.
                  </small>
                </div>

                <div className="finance-form-field full">
                  <label>Allocated Amount *</label>
                  <input
                    type="number"
                    name="allocatedAmount"
                    value={budgetForm.allocatedAmount}
                    onChange={updateBudgetField}
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    required
                  />
                </div>

                <div className="finance-form-field">
                  <label>Currency</label>
                  <select
                    name="currency"
                    value={budgetForm.currency}
                    onChange={updateBudgetField}
                  >
                    <option value="INR">INR — Indian Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>

                <div className="finance-form-field">
                  <label>Fiscal Year *</label>
                  <input
                    type="number"
                    name="fiscalYear"
                    value={budgetForm.fiscalYear}
                    onChange={updateBudgetField}
                    min="2000"
                    max="2100"
                    required
                  />
                </div>
              </div>

              <div className="finance-modal-actions">
                <button
                  type="button"
                  className="finance-button"
                  disabled={savingBudget}
                  onClick={() => setBudgetModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="finance-button primary"
                  disabled={savingBudget}
                >
                  {savingBudget ? (
                    <>
                      <LoaderCircle size={15} className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      {editingBudget ? "Save Changes" : "Create Budget"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}