
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LayoutDashboard,
  ClipboardList,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  RefreshCw,
  LogOut,
  Building2,
  IndianRupee,
  Menu,
  X,
  Eye,
  Check,
  AlertCircle,
  ChevronRight,
  LoaderCircle,
  Package,
  Plus,
  Pencil,
  FileText,
  User,
  History,
  TrendingUp,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import "./FinancePage.css";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");

const WORKFLOW_BASE = `${API_BASE}/workflows`;

const FINANCE_NODE_NAMES = [
  "finance_approval",
  "finance-approval",
];

const APPROVED_STATUSES = [
  "APPROVED",
  "FINANCE_APPROVED",
  "COMPLETED",
];

const REJECTED_STATUSES = [
  "REJECTED",
  "FINANCE_REJECTED",
  "REJECTED_FINANCE",
];

const WAITING_STATUSES = [
  "SUBMITTED",
  "PENDING",
  "IN_REVIEW",
  "PENDING_MANAGER",
  "IN_APPROVAL",
];

// ============================================================
// GENERAL HELPERS
// ============================================================

const normalizeStatus = (value) =>
  String(value || "UNKNOWN")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const getStatus = (request) =>
  normalizeStatus(
    request?.status ??
    request?.request_status ??
    request?.requestStatus ??
    request?.approval_status
  );

const getRequestId = (request) =>
  request?.id ??
  request?.request_id ??
  request?.requestId ??
  request?.purchase_request_id ??
  request?.purchaseRequestId ??
  request?.resource_id ??
  request?.resourceId;

const getRequestNumber = (request) =>
  request?.requestNumber ??
  request?.request_number ??
  request?.reference_number ??
  (getRequestId(request)
    ? `REQ-${String(getRequestId(request)).slice(0, 8)}`
    : "Request");

const getEmployeeName = (request) => {
  const directName =
    request?.employee_name ??
    request?.employeeName ??
    request?.requester_name ??
    request?.requesterName ??
    request?.requested_by_name ??
    request?.created_by_name ??
    request?.user?.name ??
    request?.employee?.name ??
    request?.requester?.name;

  if (directName) return directName;

  const firstLast = [
    request?.first_name ?? request?.firstName,
    request?.last_name ?? request?.lastName,
  ].filter(Boolean).join(" ");

  return (
    firstLast ||
    request?.user?.full_name ||
    request?.requester_email ||
    request?.email ||
    "Employee name unavailable"
  );
};

const getRequesterId = (request) =>
  request?.requesterId ??
  request?.requester_id ??
  request?.requested_by ??
  request?.created_by ??
  request?.user_id ??
  request?.employee_id ??
  request?.requester?.id ??
  null;

const getEmployeeEmail = (request) =>
  request?.employee_email ??
  request?.requester_email ??
  request?.email ??
  request?.user?.email ??
  request?.requester?.email ??
  "Not provided";

const getProductName = (request) =>
  request?.productName ??
  request?.product_name ??
  request?.item_name ??
  request?.itemName ??
  request?.title ??
  request?.name ??
  "Product not provided";

const getSupplier = (request) =>
  request?.supplier_name ??
  request?.supplierName ??
  request?.supplier ??
  request?.preferred_supplier_name ??
  request?.preferredSupplier ??
  "Not provided";

const getDepartment = (request) =>
  request?.department_name ??
  request?.departmentName ??
  request?.department ??
  request?.department_id ??
  request?.departmentId ??
  "Not provided";

const getQuantity = (request) =>
  request?.quantity ??
  request?.requested_quantity ??
  request?.requestedQuantity ??
  0;

const getUnitPrice = (request) =>
  request?.unit_price ??
  request?.unitPrice ??
  0;

const getCurrency = (request) =>
  String(
    request?.currency ??
    request?.currency_code ??
    "INR"
  ).toUpperCase();

const getAmount = (request) => {
  const amount =
    request?.total_amount ??
    request?.totalAmount ??
    request?.total ??
    request?.amount ??
    request?.grand_total;

  if (
    amount !== undefined &&
    amount !== null &&
    amount !== ""
  ) {
    return Number(amount) || 0;
  }

  return (
    Number(getQuantity(request) || 0) *
    Number(getUnitPrice(request) || 0)
  );
};

const money = (value, currency = "INR") => {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
};

const formatCurrencyTotals = (items, amountGetter) => {
  const totals = {};

  items.forEach((item) => {
    const currency = String(
      item?.currency ??
      item?.currency_code ??
      "INR"
    ).toUpperCase();

    totals[currency] =
      (totals[currency] || 0) + amountGetter(item);
  });

  const entries = Object.entries(totals);

  if (!entries.length) return money(0, "INR");

  return entries
    .map(([currency, amount]) => money(amount, currency))
    .join(" / ");
};

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatLabel = (key) =>
  String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.map(displayValue).join(", ")
      : "None";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const getArray = (result) => {
  if (Array.isArray(result)) return result;

  if (!result || typeof result !== "object") {
    return [];
  }

  const candidates = [
    result.requests,
    result.budgets,
    result.items,
    result.rows,
    result.results,
    result.data,
    result.data?.requests,
    result.data?.budgets,
    result.data?.items,
    result.data?.rows,
    result.data?.results,
    result.data?.data,
  ];

  return candidates.find(Array.isArray) || [];
};

// ============================================================
// WORKFLOW TASK HELPERS
// ============================================================

const getTaskId = (task) =>
  task?.id ??
  task?.task_id ??
  task?.taskId;

const getTaskRequestId = (task) =>
  task?.resource_id ??
  task?.resourceId ??
  task?.purchase_request_id ??
  task?.purchaseRequestId;

const getTaskNode = (task) =>
  String(
    task?.node_id ??
    task?.nodeId ??
    task?.active_node ??
    ""
  ).toLowerCase();

const isFinanceTask = (task) => {
  const node = getTaskNode(task);

  return (
    FINANCE_NODE_NAMES.includes(node) ||
    node.includes("finance")
  );
};

const isPurchaseRequestTask = (task) =>
  !task?.resource_type ||
  task.resource_type === "purchase_request";

const getTaskRequest = (task, requests) => {
  const resourceId = getTaskRequestId(task);

  if (!resourceId) return null;

  return (
    requests.find(
      (request) =>
        String(getRequestId(request)) === String(resourceId)
    ) || null
  );
};

// ============================================================
// BUDGET HELPERS
// ============================================================

const getBudgetId = (budget) =>
  budget?.id ?? budget?.budget_id;

const getBudgetAllocated = (budget) =>
  Number(
    budget?.allocatedAmount ??
    budget?.allocated_amount ??
    budget?.allocated ??
    0
  );

const getBudgetCommitted = (budget) =>
  Number(
    budget?.committedAmount ??
    budget?.committed_amount ??
    budget?.committed ??
    0
  );

const getBudgetReserved = (budget) =>
  Number(
    budget?.reservedAmount ??
    budget?.reserved_amount ??
    budget?.reserved ??
    0
  );

const getBudgetSpent = (budget) =>
  Number(
    budget?.spentAmount ??
    budget?.spent_amount ??
    budget?.spent ??
    0
  );

const getBudgetAvailable = (budget) => {
  const explicit =
    budget?.availableAmount ??
    budget?.available_amount ??
    budget?.remainingAmount ??
    budget?.remaining_amount;

  if (explicit !== undefined && explicit !== null) {
    return Number(explicit) || 0;
  }

  return Math.max(
    0,
    getBudgetAllocated(budget) -
    getBudgetCommitted(budget) -
    getBudgetReserved(budget) -
    getBudgetSpent(budget)
  );
};

const getBudgetTitle = (budget, index) => {
  const department =
    budget?.departmentName ??
    budget?.department_name ??
    budget?.departmentId ??
    budget?.department_id;

  const year =
    budget?.fiscalYear ??
    budget?.fiscal_year ??
    "Unknown year";

  return (
    department
      ? `${department} Budget`
      : `Organization Budget ${index + 1}`
  ) + ` · ${year}`;
};

const getBudgetUtilization = (budget) => {
  if (budget?.utilizationPercentage !== undefined) {
    return Math.min(
      100,
      Math.max(0, Number(budget.utilizationPercentage) || 0)
    );
  }

  const allocated = getBudgetAllocated(budget);

  if (!allocated) return 0;

  const used =
    getBudgetCommitted(budget) +
    getBudgetReserved(budget) +
    getBudgetSpent(budget);

  return Math.min(100, Math.max(0, (used / allocated) * 100));
};

const getStatusClass = (status) => {
  const value = normalizeStatus(status);

  if (APPROVED_STATUSES.includes(value)) return "approved";
  if (REJECTED_STATUSES.includes(value)) return "rejected";
  if (value === "PENDING_FINANCE") return "pending";
  if (WAITING_STATUSES.includes(value)) return "waiting";

  return "default";
};

// ============================================================
// INITIAL STATE
// ============================================================

const emptyBudgetForm = {
  name: "",
  allocatedAmount: "",
  currency: "INR",
  fiscalYear: String(new Date().getFullYear()),
};

const initialDecision = {
  task: null,
  request: null,
  decision: "",
  reason: "",
};

// ============================================================
// MAIN FINANCE PAGE
// ============================================================

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

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decisionModal, setDecisionModal] = useState(initialDecision);

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");

  // ==========================================================
  // API REQUEST
  // ==========================================================

  const apiRequest = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationMessage = Array.isArray(data.errors)
          ? data.errors
              .map((item) => item.message)
              .filter(Boolean)
              .join(", ")
          : "";

        throw new Error(
          validationMessage ||
          data.message ||
          data.error ||
          `Server returned ${response.status}`
        );
      }

      return data;
    },
    [token]
  );

  const apiGet = useCallback(
    (path) => apiRequest(`${API_BASE}${path}`),
    [apiRequest]
  );

  // ==========================================================
  // LOAD FINANCE DATA
  // ==========================================================

  const loadFinanceData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setBudgetError("");

      const [
        requestResult,
        budgetResult,
        taskResult,
        userResult,
      ] = await Promise.allSettled([
        apiGet("/procurement/requests"),
        apiGet("/budgets?page=1&limit=100"),
        apiRequest(
          `${WORKFLOW_BASE}/tasks/pending?limit=100&offset=0`
        ),
        apiGet("/auth/me"),
      ]);

      let requestLoadError = "";
      let taskLoadError = "";

      if (requestResult.status === "fulfilled") {
        setRequests(getArray(requestResult.value));
      } else {
        setRequests([]);
        requestLoadError =
          requestResult.reason?.message ||
          "Unable to load procurement requests.";
      }

      if (budgetResult.status === "fulfilled") {
        setBudgets(getArray(budgetResult.value));
      } else {
        setBudgets([]);
        setBudgetError(
          budgetResult.reason?.message ||
          "Unable to load budgets."
        );
      }

      if (taskResult.status === "fulfilled") {
        const tasks = getArray(taskResult.value);

        setPendingTasks(
          tasks.filter(
            (task) =>
              isFinanceTask(task) &&
              isPurchaseRequestTask(task) &&
              normalizeStatus(task.status) === "PENDING"
          )
        );
      } else {
        setPendingTasks([]);
        taskLoadError =
          taskResult.reason?.message ||
          "Unable to load Finance approval tasks.";
      }

      if (userResult.status === "fulfilled") {
        const currentUser =
          userResult.value?.user ??
          userResult.value?.data?.user ??
          userResult.value?.data ??
          userResult.value;

        if (
          currentUser &&
          typeof currentUser === "object"
        ) {
          setUser((previous) => ({
            ...previous,
            ...currentUser,
          }));

          localStorage.setItem(
            "user",
            JSON.stringify(currentUser)
          );
        }
      }

      const errors = [
        requestLoadError,
        taskLoadError,
      ].filter(Boolean);

      if (errors.length) {
        setError(errors.join(" "));
      }

      setLoading(false);
      setRefreshing(false);
    },
    [apiGet, apiRequest]
  );

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // ==========================================================
  // USER DETAILS
  // ==========================================================

  const financeName =
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    [
      user?.first_name,
      user?.last_name,
    ].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Finance Manager";

  // ==========================================================
  // TASK / REQUEST RELATIONSHIP
  // ==========================================================

  const financeTaskRows = useMemo(() => {
    return pendingTasks.map((task) => {
      const request = getTaskRequest(task, requests);

      const taskRequestFallback = {
        id: getTaskRequestId(task),
        request_number: task.request_number,
        total_amount: task.total_amount,
        currency: task.currency,
        requester_id: task.requester_id,
        status: "PENDING_FINANCE",
      };

      return {
        task,
        request: request || taskRequestFallback,
        requestFound: Boolean(request),
      };
    });
  }, [pendingTasks, requests]);

  const pendingFinanceRequests = useMemo(
    () => financeTaskRows.map((row) => row.request),
    [financeTaskRows]
  );

  const waitingForManagerRequests = useMemo(
    () =>
      requests.filter((request) =>
        WAITING_STATUSES.includes(getStatus(request))
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

  const pendingAmount = formatCurrencyTotals(
    pendingFinanceRequests,
    getAmount
  );

  const approvedAmount = formatCurrencyTotals(
    approvedRequests,
    getAmount
  );

  const rejectedAmount = formatCurrencyTotals(
    rejectedRequests,
    getAmount
  );

  // ==========================================================
  // BUDGET TOTALS BY CURRENCY
  // ==========================================================

  const totalAllocatedBudget = formatCurrencyTotals(
    budgets,
    getBudgetAllocated
  );

  const totalCommittedBudget = formatCurrencyTotals(
    budgets,
    getBudgetCommitted
  );

  const totalSpentBudget = formatCurrencyTotals(
    budgets,
    getBudgetSpent
  );

  const totalAvailableBudget = formatCurrencyTotals(
    budgets,
    getBudgetAvailable
  );

  // ==========================================================
  // REQUEST SEARCH AND FILTER
  // ==========================================================

  const filteredRequests = useMemo(() => {
    let result = [...requests];

    if (statusFilter === "waiting") {
      result = result.filter((request) =>
        WAITING_STATUSES.includes(getStatus(request))
      );
    } else if (statusFilter === "approved") {
      result = result.filter((request) =>
        APPROVED_STATUSES.includes(getStatus(request))
      );
    } else if (statusFilter === "rejected") {
      result = result.filter((request) =>
        REJECTED_STATUSES.includes(getStatus(request))
      );
    } else if (statusFilter === "pending") {
      const pendingIds = new Set(
        pendingFinanceRequests.map((request) =>
          String(getRequestId(request))
        )
      );

      result = result.filter((request) =>
        pendingIds.has(String(getRequestId(request)))
      );
    }

    const term = searchTerm.toLowerCase().trim();

    if (term) {
      result = result.filter((request) => {
        const searchable = [
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
          request?.budgetId,
          request?.budget_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    return result;
  }, [
    requests,
    statusFilter,
    searchTerm,
    pendingFinanceRequests,
  ]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");

    navigate("/login", { replace: true });
  };

  // ==========================================================
  // FINANCE APPROVAL
  // ==========================================================

  const openDecisionModal = (task, request, decision) => {
    setError("");
    setSuccess("");

    setDecisionModal({
      task,
      request,
      decision,
      reason: "",
    });
  };

  const submitFinanceDecision = async (event) => {
    event.preventDefault();

    const {
      task,
      request,
      decision,
      reason,
    } = decisionModal;

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
            action: decision === "approve"
              ? "approve"
              : "reject",
            comment: reason.trim(),
          }),
        }
      );

      setSuccess(
        decision === "approve"
          ? "Finance approval completed successfully."
          : "The procurement request has been rejected."
      );

      setDecisionModal(initialDecision);
      setSelectedRequest(null);

      await loadFinanceData(true);
    } catch (err) {
      setError(
        err.message ||
        "Unable to process the Finance approval."
      );
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================================
  // BUDGET MANAGEMENT
  // ==========================================================

  const openCreateBudget = () => {
    setEditingBudget(null);

    setBudgetForm({
      ...emptyBudgetForm,
      fiscalYear: String(new Date().getFullYear()),
    });

    setBudgetError("");
    setBudgetModalOpen(true);
  };

  const openEditBudget = (budget) => {
    setEditingBudget(budget);

    setBudgetForm({
      name: getBudgetTitle(budget, 0),
      allocatedAmount: String(
        getBudgetAllocated(budget)
      ),
      currency: budget.currency || "INR",
      fiscalYear: String(
        budget.fiscalYear ??
        budget.fiscal_year ??
        new Date().getFullYear()
      ),
    });

    setBudgetError("");
    setBudgetModalOpen(true);
  };

  const updateBudgetField = (event) => {
    const { name, value } = event.target;

    setBudgetForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveBudget = async (event) => {
    event.preventDefault();

    const allocatedAmount = Number(
      budgetForm.allocatedAmount
    );

    const fiscalYear = Number(
      budgetForm.fiscalYear
    );

    if (!budgetForm.name.trim()) {
      setBudgetError("Enter a budget name.");
      return;
    }

    if (
      !Number.isFinite(allocatedAmount) ||
      allocatedAmount <= 0
    ) {
      setBudgetError(
        "Enter an allocated amount greater than zero."
      );
      return;
    }

    if (
      !Number.isInteger(fiscalYear) ||
      fiscalYear < 2000 ||
      fiscalYear > 2100
    ) {
      setBudgetError("Enter a valid fiscal year between 2000 and 2100.");
      return;
    }

    const payload = {
      // The current route schema requires name.
      // The current repository does not persist it.
      name: budgetForm.name.trim(),
      allocatedAmount,
      currency: budgetForm.currency.toUpperCase(),
      fiscalYear,
    };

    setSavingBudget(true);
    setBudgetError("");

    try {
      if (editingBudget) {
        const budgetId = getBudgetId(editingBudget);

        if (!budgetId) {
          throw new Error("Budget ID is missing.");
        }

        await apiRequest(
          `${API_BASE}/budgets/${encodeURIComponent(budgetId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );

        setSuccess("Budget updated successfully.");
      } else {
        await apiRequest(`${API_BASE}/budgets`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setSuccess("Budget created or existing allocation updated successfully.");
      }

      setBudgetModalOpen(false);
      setEditingBudget(null);
      setBudgetForm(emptyBudgetForm);

      await loadFinanceData(true);
      setActiveTab("budgets");
    } catch (err) {
      setBudgetError(
        err.message || "Unable to save budget."
      );
    } finally {
      setSavingBudget(false);
    }
  };

  // ==========================================================
  // COMPLETE REQUEST DETAILS
  // ==========================================================

  const getRealRequestDetails = (request) => {
    if (!request) return [];

    const raw =
      request?.raw &&
      typeof request.raw === "object"
        ? request.raw
        : {};

    const combined = {
      ...raw,
      ...request,
    };

    delete combined.raw;

    return Object.keys(combined)
      .filter((key) => {
        const value = combined[key];

        return (
          value !== undefined &&
          value !== null &&
          value !== ""
        );
      })
      .map((key) => ({
        key,
        label: formatLabel(key),
        value: combined[key],
      }));
  };

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "requests",
      label: "Employee Requests",
      icon: ClipboardList,
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: Wallet,
    },
    {
      id: "approvals",
      label: "Approval History",
      icon: CheckCircle2,
    },
  ];

  // ==========================================================
  // REQUEST TABLE
  // ==========================================================

  const renderRequestsTable = (items, taskRows = []) => (
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
          {items.length ? (
            items.map((request, index) => {
              const id = getRequestId(request) || index;

              const taskRow = taskRows.find(
                (row) =>
                  String(getRequestId(row.request)) ===
                  String(getRequestId(request))
              );

              const status = taskRow
                ? "PENDING_FINANCE"
                : getStatus(request);

              const employee = getEmployeeName(request);
              const product = getProductName(request);

              return (
                <tr key={id}>
                  <td>
                    <strong>
                      {getRequestNumber(request)}
                    </strong>

                    <small className="sub-value">
                      {String(id)}
                    </small>
                  </td>

                  <td>
                    <div className="finance-employee-cell">
                      <span className="finance-mini-avatar">
                        {employee.charAt(0).toUpperCase()}
                      </span>

                      <div>
                        <strong>{employee}</strong>
                        <small>
                          {getEmployeeEmail(request)}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="finance-product-cell">
                      <Package size={15} />
                      {product}
                    </div>
                  </td>

                  <td>{getSupplier(request)}</td>
                  <td>{getDepartment(request)}</td>

                  <td className="finance-amount">
                    {money(
                      getAmount(request),
                      getCurrency(request)
                    )}
                  </td>

                  <td>
                    <span
                      className={`finance-status ${getStatusClass(status)}`}
                    >
                      {status.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td>
                    <div className="finance-row-actions">
                      <button
                        className="finance-icon-button"
                        title="View complete details"
                        onClick={() =>
                          setSelectedRequest(request)
                        }
                      >
                        <Eye size={15} />
                      </button>

                      {taskRow && (
                        <>
                          <button
                            className="finance-approve-button"
                            title="Approve Finance task"
                            onClick={() =>
                              openDecisionModal(
                                taskRow.task,
                                request,
                                "approve"
                              )
                            }
                          >
                            <Check size={14} />
                          </button>

                          <button
                            className="finance-reject-button"
                            title="Reject Finance task"
                            onClick={() =>
                              openDecisionModal(
                                taskRow.task,
                                request,
                                "reject"
                              )
                            }
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="8" className="finance-empty">
                <ClipboardList size={28} />
                <strong>No requests found</strong>
                <span>
                  Requests will appear here when available.
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // ==========================================================
  // BUDGET CARDS
  // ==========================================================

  const renderBudgets = () => (
    <section className="finance-panel">
      <div className="finance-panel-heading">
        <div>
          <h3>Organization Budgets</h3>
          <p>
            Monitor actual allocations and available funds.
          </p>
        </div>

        <button
          className="finance-button primary"
          onClick={openCreateBudget}
        >
          <Plus size={15} />
          Create Budget
        </button>
      </div>

      {budgetError && (
        <div className="finance-alert error">
          {budgetError}
        </div>
      )}

      {budgets.length ? (
        <div className="finance-budget-grid">
          {budgets.map((budget, index) => {
            const allocated = getBudgetAllocated(budget);
            const available = getBudgetAvailable(budget);
            const committed = getBudgetCommitted(budget);
            const spent = getBudgetSpent(budget);
            const reserved = getBudgetReserved(budget);
            const percentage = getBudgetUtilization(budget);

            return (
              <div
                className="finance-budget-card"
                key={getBudgetId(budget) || index}
              >
                <div className="finance-budget-card-heading">
                  <div>
                    <h4>
                      {getBudgetTitle(budget, index)}
                    </h4>

                    <p>
                      {budget.costCenterId ||
                        budget.cost_center_id ||
                        "Organization budget"}
                    </p>
                  </div>

                  <button
                    className="finance-icon-button"
                    onClick={() => openEditBudget(budget)}
                    title="Edit budget"
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <div className="finance-budget-line">
                  <span>Allocated</span>
                  <strong>
                    {money(allocated, budget.currency)}
                  </strong>
                </div>

                <div className="finance-progress">
                  <span
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="finance-budget-line">
                  <span>Committed</span>
                  <strong>
                    {money(committed, budget.currency)}
                  </strong>
                </div>

                <div className="finance-budget-line">
                  <span>Reserved</span>
                  <strong>
                    {money(reserved, budget.currency)}
                  </strong>
                </div>

                <div className="finance-budget-line">
                  <span>Spent</span>
                  <strong>
                    {money(spent, budget.currency)}
                  </strong>
                </div>

                <div className="finance-budget-line">
                  <span>Available</span>
                  <strong className="finance-available">
                    {money(available, budget.currency)}
                  </strong>
                </div>

                <div className="finance-budget-meta">
                  <span>
                    Fiscal year:{" "}
                    {budget.fiscalYear ??
                      budget.fiscal_year ??
                      "—"}
                  </span>

                  <span>
                    {budget.currency || "INR"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="finance-empty finance-budget-empty">
          <Wallet size={28} />
          <strong>No budgets found</strong>
          <span>
            No budget records were returned by the server.
          </span>

          <button
            className="finance-button primary"
            onClick={openCreateBudget}
          >
            <Plus size={15} />
            Create Budget
          </button>
        </div>
      )}
    </section>
  );

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="finance-app">

      {/* SIDEBAR */}

      <aside
        className={`finance-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="finance-brand">
          <span className="finance-brand-icon">
            <Building2 size={22} />
          </span>

          <span>
            ETDOX<span>.</span>
          </span>
        </div>

        <p className="finance-workspace-label">
          FINANCE WORKSPACE
        </p>

        <nav className="finance-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={
                  activeTab === item.id ? "active" : ""
                }
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                  setError("");
                  setSuccess("");
                  setBudgetError("");
                }}
              >
                <Icon size={18} />
                {item.label}

                {activeTab === item.id && (
                  <ChevronRight
                    size={15}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="finance-sidebar-bottom">
          <div className="finance-user-mini">
            <div className="finance-avatar">
              {financeName.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{financeName}</strong>
              <small>
                {user?.email || "Finance account"}
              </small>
            </div>
          </div>

          <button
            className="finance-logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="finance-main">
        <header className="finance-topbar">
          <div className="finance-topbar-left">
            <button
              className="finance-mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen
                ? <X size={18} />
                : <Menu size={18} />}
            </button>

            <div>
              <h1>
                {activeTab === "overview"
                  ? "Finance Dashboard"
                  : activeTab === "requests"
                    ? "Employee Requests"
                    : activeTab === "budgets"
                      ? "Budget Management"
                      : "Approval History"}
              </h1>

              <p>
                Review procurement requests and manage budgets.
              </p>
            </div>
          </div>

          <div className="finance-topbar-right">
            <button
              className="finance-button"
              onClick={() => loadFinanceData(true)}
              disabled={refreshing}
            >
              {refreshing
                ? <LoaderCircle size={14} />
                : <RefreshCw size={14} />}

              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <div className="finance-topbar-user">
              <div className="finance-avatar">
                {financeName.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{financeName}</strong>
                <small>Finance</small>
              </div>
            </div>
          </div>
        </header>

        <div className="finance-content">
          {error && (
            <div className="finance-alert error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="finance-alert success">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div className="finance-loading">
              <div>
                <LoaderCircle size={25} />
                <p>Loading Finance workspace...</p>
              </div>
            </div>
          ) : (
            <>
              {/* OVERVIEW */}

              {activeTab === "overview" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <h2>
                        Welcome back, {financeName} 👋
                      </h2>

                      <p>
                        Review employee procurement requests
                        and financial approvals.
                      </p>
                    </div>

                    <button
                      className="finance-button primary"
                      onClick={() => setActiveTab("requests")}
                    >
                      <ClipboardList size={15} />
                      Review Employee Requests
                    </button>
                  </section>

                  <section className="finance-stats">
                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Awaiting Finance</small>
                        <span className="finance-stat-icon">
                          <Clock3 size={18} />
                        </span>
                      </div>

                      <h3>{pendingTasks.length}</h3>
                      <p>Tasks assigned to your Finance account</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Waiting for Manager</small>
                        <span className="finance-stat-icon">
                          <ClipboardList size={18} />
                        </span>
                      </div>

                      <h3>{waitingForManagerRequests.length}</h3>
                      <p>Requests not yet forwarded to Finance</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Approved Requests</small>
                        <span className="finance-stat-icon">
                          <CheckCircle2 size={18} />
                        </span>
                      </div>

                      <h3>{approvedRequests.length}</h3>
                      <p>Total approved requests</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Pending Amount</small>
                        <span className="finance-stat-icon">
                          <IndianRupee size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {pendingAmount}
                      </h3>

                      <p>Awaiting Finance review</p>
                    </div>
                  </section>

                  <section className="finance-stats">
                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Total Allocated</small>
                        <span className="finance-stat-icon">
                          <Wallet size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {totalAllocatedBudget}
                      </h3>

                      <p>Actual budget allocations</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Committed</small>
                        <span className="finance-stat-icon">
                          <FileText size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {totalCommittedBudget}
                      </h3>

                      <p>Committed budget amount</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Spent</small>
                        <span className="finance-stat-icon">
                          <TrendingUp size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {totalSpentBudget}
                      </h3>

                      <p>Recorded expenditure</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Available Budget</small>
                        <span className="finance-stat-icon">
                          <IndianRupee size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {totalAvailableBudget}
                      </h3>

                      <p>Remaining budget amount</p>
                    </div>
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Requests Awaiting Finance</h3>
                        <p>
                          These tasks are assigned to your authenticated Finance account.
                        </p>
                      </div>

                      <button
                        className="finance-button"
                        onClick={() => setActiveTab("requests")}
                      >
                        View all
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {renderRequestsTable(
                      pendingFinanceRequests,
                      financeTaskRows
                    )}
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Budget Summary</h3>
                        <p>
                          Available: {totalAvailableBudget}
                        </p>
                      </div>

                      <button
                        className="finance-button"
                        onClick={() => setActiveTab("budgets")}
                      >
                        Manage budgets
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {budgets.length ? (
                      <div className="finance-budget-grid">
                        {budgets.slice(0, 4).map(
                          (budget, index) => (
                            <div
                              className="finance-budget-card"
                              key={getBudgetId(budget) || index}
                            >
                              <h4>
                                {getBudgetTitle(budget, index)}
                              </h4>

                              <div className="finance-budget-line">
                                <span>Allocated</span>
                                <strong>
                                  {money(
                                    getBudgetAllocated(budget),
                                    budget.currency
                                  )}
                                </strong>
                              </div>

                              <div className="finance-budget-line">
                                <span>Available</span>
                                <strong className="finance-available">
                                  {money(
                                    getBudgetAvailable(budget),
                                    budget.currency
                                  )}
                                </strong>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="finance-empty finance-budget-empty">
                        <Wallet size={25} />
                        <strong>No budgets created yet</strong>

                        <button
                          className="finance-button primary"
                          onClick={openCreateBudget}
                        >
                          <Plus size={15} />
                          Create Budget
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* EMPLOYEE REQUESTS */}

              {activeTab === "requests" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <h2>Employee Procurement Requests</h2>

                      <p>
                        Review employee submissions and process
                        requests forwarded by managers.
                      </p>
                    </div>
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>All Employee Requests</h3>

                        <p>
                          Finance pending: {pendingTasks.length}
                          {" | "}
                          Waiting for manager: {waitingForManagerRequests.length}
                          {" | "}
                          Approved: {approvedRequests.length}
                          {" | "}
                          Rejected: {rejectedRequests.length}
                        </p>
                      </div>
                    </div>

                    <div className="finance-toolbar">
                      <div className="finance-search">
                        <Search size={15} />

                        <input
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder="Search employee, product, supplier, ID..."
                        />
                      </div>

                      <select
                        className="finance-filter"
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value)
                        }
                      >
                        <option value="all">All requests</option>
                        <option value="pending">Awaiting Finance</option>
                        <option value="waiting">Waiting for Manager</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    {renderRequestsTable(
                      filteredRequests,
                      financeTaskRows
                    )}
                  </section>
                </>
              )}

              {/* BUDGETS */}

              {activeTab === "budgets" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <h2>Budget Management</h2>

                      <p>
                        Manage organization budget allocations and
                        monitor available funds.
                      </p>
                    </div>

                    <button
                      className="finance-button primary"
                      onClick={openCreateBudget}
                    >
                      <Plus size={15} />
                      Create Budget
                    </button>
                  </section>

                  {renderBudgets()}
                </>
              )}

              {/* APPROVAL HISTORY */}

              {activeTab === "approvals" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <h2>Finance Approval History</h2>

                      <p>
                        Review approved and rejected procurement requests.
                      </p>
                    </div>
                  </section>

                  <section className="finance-stats">
                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Approved</small>
                        <CheckCircle2 size={19} />
                      </div>

                      <h3>{approvedRequests.length}</h3>
                      <p>{approvedAmount} total approved</p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Rejected</small>
                        <XCircle size={19} />
                      </div>

                      <h3>{rejectedRequests.length}</h3>
                      <p>{rejectedAmount} total rejected</p>
                    </div>
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Processed Requests</h3>

                        <p>
                          {approvedRequests.length + rejectedRequests.length}
                          {" "}processed requests
                        </p>
                      </div>
                    </div>

                    {renderRequestsTable([
                      ...approvedRequests,
                      ...rejectedRequests,
                    ])}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* REQUEST DETAILS MODAL */}

      {selectedRequest && (
        <div
          className="finance-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRequest(null);
            }
          }}
        >
          <div className="finance-modal">
            <div className="finance-modal-heading">
              <div>
                <h3>Complete Procurement Request</h3>

                <p style={{
                  color: "#8290a5",
                  fontSize: 10,
                  marginTop: 5,
                }}>
                  {getRequestNumber(selectedRequest)}
                </p>
              </div>

              <button
                className="finance-modal-close"
                onClick={() => setSelectedRequest(null)}
              >
                <X size={16} />
              </button>
            </div>

            <h4 style={{ margin: "0 0 12px", fontSize: 12 }}>
              <User
                size={14}
                style={{ display: "inline", marginRight: 6 }}
              />
              Employee Information
            </h4>

            <div className="finance-detail-grid">
              <div className="finance-detail">
                <small>Employee Name</small>
                <strong>{getEmployeeName(selectedRequest)}</strong>
              </div>

              <div className="finance-detail">
                <small>Employee ID</small>
                <strong>
                  {getRequesterId(selectedRequest) || "Not provided"}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Email Address</small>
                <strong>{getEmployeeEmail(selectedRequest)}</strong>
              </div>

              <div className="finance-detail">
                <small>Department</small>
                <strong>{getDepartment(selectedRequest)}</strong>
              </div>
            </div>

            <h4 style={{ margin: "18px 0 12px", fontSize: 12 }}>
              <Package
                size={14}
                style={{ display: "inline", marginRight: 6 }}
              />
              Product Information
            </h4>

            <div className="finance-detail-grid">
              <div className="finance-detail">
                <small>Product Name</small>
                <strong>{getProductName(selectedRequest)}</strong>
              </div>

              <div className="finance-detail">
                <small>Supplier</small>
                <strong>{getSupplier(selectedRequest)}</strong>
              </div>

              <div className="finance-detail">
                <small>Quantity</small>
                <strong>{displayValue(getQuantity(selectedRequest))}</strong>
              </div>

              <div className="finance-detail">
                <small>Unit Price</small>
                <strong>
                  {money(
                    getUnitPrice(selectedRequest),
                    getCurrency(selectedRequest)
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Total Amount</small>
                <strong>
                  {money(
                    getAmount(selectedRequest),
                    getCurrency(selectedRequest)
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Currency</small>
                <strong>{getCurrency(selectedRequest)}</strong>
              </div>

              <div className="finance-detail">
                <small>Budget ID</small>
                <strong>
                  {displayValue(
                    selectedRequest.budgetId ??
                    selectedRequest.budget_id
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Request Status</small>
                <strong>
                  {getStatus(selectedRequest).replaceAll("_", " ")}
                </strong>
              </div>
            </div>

            <h4 style={{ margin: "18px 0 12px", fontSize: 12 }}>
              Business Justification
            </h4>

            <div className="finance-detail">
              <strong>
                {selectedRequest.justification ||
                  selectedRequest.description ||
                  "No justification was returned by the API."}
              </strong>
            </div>

            <h4 style={{ margin: "20px 0 10px", fontSize: 12 }}>
              <History
                size={14}
                style={{ display: "inline", marginRight: 6 }}
              />
              Approval Information
            </h4>

            <div className="finance-detail-grid">
              <div className="finance-detail">
                <small>Manager Decision</small>
                <strong>
                  {displayValue(
                    selectedRequest.managerDecision ??
                    selectedRequest.manager_decision
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Finance Decision</small>
                <strong>
                  {displayValue(
                    selectedRequest.financeDecision ??
                    selectedRequest.finance_decision
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Submitted At</small>
                <strong>
                  {formatDate(
                    selectedRequest.submittedAt ||
                    selectedRequest.submitted_at
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Created At</small>
                <strong>
                  {formatDate(
                    selectedRequest.createdAt ||
                    selectedRequest.created_at
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Updated At</small>
                <strong>
                  {formatDate(
                    selectedRequest.updatedAt ||
                    selectedRequest.updated_at
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Workflow Run ID</small>
                <strong>
                  {displayValue(
                    selectedRequest.workflowRunId ||
                    selectedRequest.workflow_run_id
                  )}
                </strong>
              </div>
            </div>

            {Array.isArray(selectedRequest.history) &&
              selectedRequest.history.length > 0 && (
                <div className="finance-history">
                  <h4>Request History</h4>

                  {selectedRequest.history.map((item, index) => (
                    <div
                      className="finance-history-item"
                      key={item.id || index}
                    >
                      <strong>
                        {item.action ||
                          item.status ||
                          item.decision ||
                          "Request activity"}
                      </strong>

                      <p>
                        {item.comment ||
                          item.remarks ||
                          item.description ||
                          "No additional remarks"}
                      </p>

                      <small>
                        {item.actor_name ||
                          item.user_name ||
                          item.actor ||
                          "System"}
                        {" · "}
                        {formatDate(
                          item.created_at ||
                          item.createdAt ||
                          item.timestamp
                        )}
                      </small>
                    </div>
                  ))}
                </div>
              )}

            <h4 style={{ margin: "20px 0 10px", fontSize: 12 }}>
              All Other Values Returned by the API
            </h4>

            <div className="finance-all-fields">
              {getRealRequestDetails(selectedRequest).map(
                ({ key, label, value }) => (
                  <div className="finance-detail" key={key}>
                    <small>{label}</small>
                    <strong>{displayValue(value)}</strong>
                  </div>
                )
              )}
            </div>

            <div className="finance-modal-actions">
              <button
                className="finance-button"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE APPROVE / REJECT MODAL */}

      {decisionModal.task && (
        <div
          className="finance-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !processing
            ) {
              setDecisionModal(initialDecision);
            }
          }}
        >
          <div
            className="finance-modal"
            style={{ maxWidth: 540 }}
          >
            <div className="finance-modal-heading">
              <h3>
                {decisionModal.decision === "approve"
                  ? "Approve Employee Request"
                  : "Reject Employee Request"}
              </h3>

              <button
                className="finance-modal-close"
                disabled={processing}
                onClick={() =>
                  setDecisionModal(initialDecision)
                }
              >
                <X size={16} />
              </button>
            </div>

            <div className="finance-detail-grid">
              <div className="finance-detail">
                <small>Request Number</small>
                <strong>
                  {getRequestNumber(decisionModal.request)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Employee</small>
                <strong>
                  {getEmployeeName(decisionModal.request)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Product</small>
                <strong>
                  {getProductName(decisionModal.request)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Amount</small>
                <strong>
                  {money(
                    getAmount(decisionModal.request),
                    getCurrency(decisionModal.request)
                  )}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Approval Task ID</small>
                <strong>
                  {getTaskId(decisionModal.task)}
                </strong>
              </div>
            </div>

            <form onSubmit={submitFinanceDecision}>
              <div className="finance-modal-field">
                <label>
                  {decisionModal.decision === "approve"
                    ? "Finance Approval Remarks *"
                    : "Reason for Rejection *"}
                </label>

                <textarea
                  value={decisionModal.reason}
                  onChange={(event) =>
                    setDecisionModal((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Enter your decision remarks..."
                  required
                  minLength={2}
                  maxLength={1000}
                  disabled={processing}
                />

                <small style={{
                  color: "#8795a9",
                  fontSize: 9,
                }}>
                  {decisionModal.reason.length}/1000 characters
                </small>
              </div>

              <div className="finance-modal-actions">
                <button
                  type="button"
                  className="finance-button"
                  disabled={processing}
                  onClick={() =>
                    setDecisionModal(initialDecision)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="finance-button primary"
                  disabled={processing}
                  style={
                    decisionModal.decision === "reject"
                      ? {
                          background: "#c83d4d",
                          borderColor: "#c83d4d",
                        }
                      : {}
                  }
                >
                  {processing ? (
                    <>
                      <LoaderCircle size={15} />
                      Processing...
                    </>
                  ) : decisionModal.decision === "approve" ? (
                    <>
                      <Check size={15} />
                      Confirm Approval
                    </>
                  ) : (
                    <>
                      <XCircle size={15} />
                      Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BUDGET MODAL */}

      {budgetModalOpen && (
        <div
          className="finance-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !savingBudget
            ) {
              setBudgetModalOpen(false);
            }
          }}
        >
          <div
            className="finance-modal"
            style={{ maxWidth: 540 }}
          >
            <div className="finance-modal-heading">
              <h3>
                {editingBudget
                  ? "Edit Budget"
                  : "Create New Budget"}
              </h3>

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
                {budgetError}
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
                    The current backend requires this field for validation,
                    but does not persist the budget name.
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
                    <option value="INR">
                      INR - Indian Rupee
                    </option>

                    <option value="USD">
                      USD - US Dollar
                    </option>

                    <option value="EUR">
                      EUR - Euro
                    </option>
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
                      <LoaderCircle size={15} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      {editingBudget
                        ? "Save Changes"
                        : "Create Budget"}
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
