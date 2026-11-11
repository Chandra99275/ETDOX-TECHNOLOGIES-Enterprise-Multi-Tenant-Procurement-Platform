
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
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
  CalendarDays,
  User,
  Hash,
  History,
  ShieldCheck,
  TrendingUp
} from "lucide-react";

import { useNavigate } from "react-router-dom";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");

// Actual procurement workflow statuses
const FINANCE_REVIEW_STATUSES = ["PENDING_FINANCE"];

const WAITING_STATUSES = [
  "SUBMITTED",
  "PENDING",
  "IN_REVIEW",
  "PENDING_MANAGER"
];

const APPROVED_STATUSES = [
  "APPROVED",
  "FINANCE_APPROVED",
  "COMPLETED"
];

const REJECTED_STATUSES = [
  "REJECTED",
  "FINANCE_REJECTED",
  "REJECTED_FINANCE"
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
  request?.purchaseRequestId;

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
    request?.employee?.name;

  if (directName) return directName;

  const firstLast = [
    request?.first_name ?? request?.firstName,
    request?.last_name ?? request?.lastName
  ].filter(Boolean).join(" ");

  return (
    firstLast ||
    request?.requester?.name ||
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
  request?.currency ??
  request?.currency_code ??
  "INR";

const getAmount = (request) => {
  const amount =
    request?.total_amount ??
    request?.totalAmount ??
    request?.total ??
    request?.amount ??
    request?.grand_total;

  if (amount !== undefined && amount !== null && amount !== "") {
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
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
};

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
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
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
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

// Handles different API response structures.
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
    result.data?.requests,
    result.data?.budgets,
    result.data?.items,
    result.data?.rows,
    result.data?.results,
    result.data?.data
  ];

  return candidates.find(Array.isArray) || [];
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
    budget?.total_amount ??
    budget?.amount ??
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
    budget?.available ??
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

const getBudgetTitle = (budget, index) =>
  budget?.name ??
  budget?.budget_name ??
  budget?.department_name ??
  budget?.department ??
  `Budget ${index + 1}`;

const getStatusClass = (status) => {
  const value = normalizeStatus(status);

  if (APPROVED_STATUSES.includes(value)) return "approved";
  if (REJECTED_STATUSES.includes(value)) return "rejected";
  if (FINANCE_REVIEW_STATUSES.includes(value)) return "pending";
  if (WAITING_STATUSES.includes(value)) return "waiting";

  return "default";
};

// ============================================================
// BUDGET FORM
// ============================================================

const emptyBudgetForm = {
  name: "",
  description: "",
  department: "",
  category: "",
  allocatedAmount: "",
  currency: "INR",
  fiscalYear: String(new Date().getFullYear()),
  status: "active"
};

const initialDecision = {
  request: null,
  decision: "",
  reason: ""
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

  const token = localStorage.getItem("token");

  // ==========================================================
  // API REQUEST
  // ==========================================================

  const apiRequest = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
          ...options.headers
        }
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

  // ==========================================================
  // LOAD REAL FINANCE DATA
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

      try {
        const [
          requestResult,
          budgetResult,
          userResult
        ] = await Promise.allSettled([
          apiRequest("/procurement/requests"),
          apiRequest("/budgets?page=1&limit=100"),
          apiRequest("/auth/me")
        ]);

        // Real employee requests
        if (requestResult.status === "fulfilled") {
          setRequests(getArray(requestResult.value));
        } else {
          setRequests([]);

          setError(
            `Unable to load employee requests: ${
              requestResult.reason?.message || "Unknown error"
            }`
          );
        }

        // Real organization budgets
        if (budgetResult.status === "fulfilled") {
          setBudgets(getArray(budgetResult.value));
        } else {
          setBudgets([]);

          setBudgetError(
            budgetResult.reason?.message ||
            "Unable to load budgets."
          );
        }

        // Authenticated finance user
        if (userResult.status === "fulfilled") {
          const currentUser =
            userResult.value?.user ??
            userResult.value?.data?.user ??
            userResult.value?.data ??
            userResult.value;

          if (currentUser && typeof currentUser === "object") {
            setUser((previous) => ({
              ...previous,
              ...currentUser
            }));

            localStorage.setItem(
              "user",
              JSON.stringify(currentUser)
            );
          }
        }
      } catch (err) {
        setError(
          err.message || "Unable to load Finance workspace."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiRequest]
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
      user?.last_name
    ].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Finance Manager";

  // ==========================================================
  // REAL REQUEST CALCULATIONS
  // ==========================================================

  const pendingFinanceRequests = useMemo(
    () =>
      requests.filter((request) =>
        FINANCE_REVIEW_STATUSES.includes(getStatus(request))
      ),
    [requests]
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

  const pendingAmount = pendingFinanceRequests.reduce(
    (sum, request) => sum + getAmount(request),
    0
  );

  const approvedAmount = approvedRequests.reduce(
    (sum, request) => sum + getAmount(request),
    0
  );

  const rejectedAmount = rejectedRequests.reduce(
    (sum, request) => sum + getAmount(request),
    0
  );

  const totalAllocatedBudget = budgets.reduce(
    (sum, budget) => sum + getBudgetAllocated(budget),
    0
  );

  const totalCommittedBudget = budgets.reduce(
    (sum, budget) => sum + getBudgetCommitted(budget),
    0
  );

  const totalSpentBudget = budgets.reduce(
    (sum, budget) => sum + getBudgetSpent(budget),
    0
  );

  const totalAvailableBudget = budgets.reduce(
    (sum, budget) => sum + getBudgetAvailable(budget),
    0
  );

  // ==========================================================
  // REQUEST SEARCH AND FILTER
  // ==========================================================

  const filteredRequests = useMemo(() => {
    let result = [...requests];

    if (statusFilter === "pending") {
      result = result.filter((request) =>
        FINANCE_REVIEW_STATUSES.includes(getStatus(request))
      );
    } else if (statusFilter === "waiting") {
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
          request?.budget_id
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    return result;
  }, [requests, statusFilter, searchTerm]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");

    navigate("/login", { replace: true });
  };

  // ==========================================================
  // FINANCE APPROVAL
  // ==========================================================

  const openDecisionModal = (request, decision) => {
    setError("");
    setSuccess("");

    setDecisionModal({
      request,
      decision,
      reason: ""
    });
  };

  const submitFinanceDecision = async (event) => {
    event.preventDefault();

    const {
      request,
      decision,
      reason
    } = decisionModal;

    const requestId = getRequestId(request);

    if (!requestId) {
      setError("Request ID is missing.");
      return;
    }

    if (!FINANCE_REVIEW_STATUSES.includes(getStatus(request))) {
      setError(
        "This request has not received manager approval. Finance cannot process it yet."
      );
      return;
    }

    if (!reason.trim()) {
      setError("Please enter your finance remarks.");
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
      // IMPORTANT:
      // Backend expects APPROVE or REJECT.
      await apiRequest(
        `/procurement/requests/${encodeURIComponent(requestId)}/finance-decision`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision: decision === "approve"
              ? "APPROVE"
              : "REJECT",
            comment: reason.trim()
          })
        }
      );

      setSuccess(
        decision === "approve"
          ? "Employee procurement request approved successfully."
          : "Employee procurement request rejected successfully."
      );

      setDecisionModal(initialDecision);

      if (selectedRequest) {
        setSelectedRequest(null);
      }

      // Reload actual backend values after processing.
      await loadFinanceData(true);

    } catch (err) {
      setError(
        err.message || "Unable to process finance decision."
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
    setBudgetForm(emptyBudgetForm);
    setBudgetError("");
    setBudgetModalOpen(true);
  };

  const openEditBudget = (budget) => {
    setEditingBudget(budget);

    setBudgetForm({
      ...emptyBudgetForm,
      name: budget.name || budget.budget_name || "",
      description: budget.description || "",
      department:
        budget.department ||
        budget.department_name ||
        "",
      category: budget.category || "",
      allocatedAmount: String(getBudgetAllocated(budget)),
      currency: budget.currency || "INR",
      fiscalYear: String(
        budget.fiscalYear ||
        budget.fiscal_year ||
        new Date().getFullYear()
      ),
      status: budget.status || "active"
    });

    setBudgetError("");
    setBudgetModalOpen(true);
  };

  const updateBudgetField = (event) => {
    const { name, value } = event.target;

    setBudgetForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const saveBudget = async (event) => {
    event.preventDefault();

    const allocatedAmount = Number(
      budgetForm.allocatedAmount
    );

    const fiscalYear = Number(budgetForm.fiscalYear);

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

    if (!Number.isInteger(fiscalYear)) {
      setBudgetError("Enter a valid fiscal year.");
      return;
    }

    const payload = {
      name: budgetForm.name.trim(),
      description: budgetForm.description.trim(),
      department: budgetForm.department.trim(),
      category: budgetForm.category.trim(),
      allocatedAmount,
      allocated: allocatedAmount,
      currency: budgetForm.currency,
      fiscalYear,
      status: budgetForm.status
    };

    setSavingBudget(true);
    setBudgetError("");

    try {
      if (editingBudget) {
        const budgetId = getBudgetId(editingBudget);

        if (!budgetId) {
          throw new Error("Budget ID is missing.");
        }

        await apiRequest(`/budgets/${budgetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });

        setSuccess("Budget updated successfully.");
      } else {
        await apiRequest("/budgets", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        setSuccess("Budget created successfully.");
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
  // COMPLETE EMPLOYEE REQUEST DETAILS
  // ==========================================================

  const getRealRequestDetails = (request) => {
    const raw =
      request?.raw &&
      typeof request.raw === "object"
        ? request.raw
        : {};

    const combined = {
      ...raw,
      ...request
    };

    delete combined.raw;

    const preferredKeys = [
      "id",
      "requestNumber",
      "request_number",
      "requesterId",
      "requester_id",
      "employee_name",
      "employeeName",
      "requester_name",
      "requester_email",
      "productName",
      "product_name",
      "title",
      "description",
      "justification",
      "supplier",
      "supplier_name",
      "quantity",
      "unitPrice",
      "unit_price",
      "subtotal",
      "tax_total",
      "total",
      "total_amount",
      "currency",
      "department",
      "department_name",
      "budgetId",
      "budget_id",
      "status",
      "managerDecision",
      "financeDecision",
      "workflowRunId",
      "workflow_run_id",
      "submitted_at",
      "submittedAt",
      "created_at",
      "createdAt",
      "updated_at",
      "updatedAt"
    ];

    const keys = [
      ...preferredKeys.filter(
        (key) => Object.prototype.hasOwnProperty.call(combined, key)
      ),
      ...Object.keys(combined).filter(
        (key) => !preferredKeys.includes(key)
      )
    ];

    return [...new Set(keys)]
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
        value: combined[key]
      }));
  };

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard
    },
    {
      id: "requests",
      label: "Employee Requests",
      icon: ClipboardList
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: Wallet
    },
    {
      id: "approvals",
      label: "Approval History",
      icon: CheckCircle2
    }
  ];

  // ==========================================================
  // REQUEST TABLE
  // ==========================================================

  const renderRequestsTable = (items) => (
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
              const status = getStatus(request);

              const canReview =
                FINANCE_REVIEW_STATUSES.includes(status);

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

                      {canReview && (
                        <>
                          <button
                            className="finance-approve-button"
                            title="Approve request"
                            onClick={() =>
                              openDecisionModal(
                                request,
                                "approve"
                              )
                            }
                          >
                            <Check size={14} />
                          </button>

                          <button
                            className="finance-reject-button"
                            title="Reject request"
                            onClick={() =>
                              openDecisionModal(
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
                  Employee requests will appear here when submitted.
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

            const used = Math.max(
              0,
              allocated - available
            );

            const percentage =
              allocated > 0
                ? Math.min(
                    (used / allocated) * 100,
                    100
                  )
                : 0;

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
                      {budget.department_name ||
                        budget.department ||
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
                    {budget.fiscalYear ||
                      budget.fiscal_year ||
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

      <style>{`
        .finance-app {
          --primary: #2864d9;
          --dark: #17243b;
          --muted: #8290a5;
          --border: #e8edf4;
          min-height: 100vh;
          display: flex;
          color: var(--dark);
          background: #f5f7fb;
          font-family: Inter, Arial, sans-serif;
        }

        .finance-sidebar {
          width: 245px;
          min-width: 245px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          background: #fff;
          border-right: 1px solid var(--border);
          z-index: 20;
        }

        .finance-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px 30px;
          font-size: 23px;
          font-weight: 800;
        }

        .finance-brand-icon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          color: white;
          background: linear-gradient(145deg,#3679ed,#194ba9);
          border-radius: 11px;
        }

        .finance-brand span:last-child span {
          color: var(--primary);
        }

        .finance-workspace-label {
          padding: 0 11px;
          color: #a0aabd;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .finance-nav {
          display: grid;
          gap: 6px;
        }

        .finance-nav button {
          width: 100%;
          min-height: 45px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #738198;
          background: transparent;
          border: 0;
          border-radius: 9px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .finance-nav button:hover,
        .finance-nav button.active {
          color: var(--primary);
          background: #edf3ff;
        }

        .finance-sidebar-bottom {
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid var(--border);
        }

        .finance-user-mini {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 5px 16px;
        }

        .finance-avatar,
        .finance-mini-avatar {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          color: #2d67ce;
          background: #eaf1ff;
          border-radius: 50%;
          font-weight: 800;
        }

        .finance-avatar {
          width: 36px;
          height: 36px;
        }

        .finance-user-mini strong,
        .finance-user-mini small {
          display: block;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .finance-user-mini strong {
          font-size: 11px;
        }

        .finance-user-mini small {
          margin-top: 4px;
          color: var(--muted);
          font-size: 9px;
        }

        .finance-logout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          color: #d14d5b;
          background: #fff5f5;
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }

        .finance-main {
          min-width: 0;
          flex: 1;
        }

        .finance-topbar {
          min-height: 72px;
          padding: 0 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #fff;
          border-bottom: 1px solid var(--border);
        }

        .finance-topbar-left,
        .finance-topbar-right {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .finance-topbar h1 {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
        }

        .finance-topbar p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 10px;
        }

        .finance-topbar-user {
          display: flex;
          align-items: center;
          gap: 9px;
          padding-left: 13px;
          border-left: 1px solid var(--border);
        }

        .finance-topbar-user strong,
        .finance-topbar-user small {
          display: block;
        }

        .finance-topbar-user strong {
          font-size: 11px;
        }

        .finance-topbar-user small {
          margin-top: 3px;
          color: var(--muted);
          font-size: 9px;
        }

        .finance-content {
          max-width: 1500px;
          margin: auto;
          padding: 30px 32px 45px;
        }

        .finance-welcome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 25px;
        }

        .finance-welcome h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
        }

        .finance-welcome p {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .finance-button {
          min-height: 38px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #52627a;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .finance-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .finance-button.primary {
          min-height: 41px;
          padding: 0 16px;
          color: #fff;
          background: var(--primary);
          border-color: var(--primary);
          font-size: 11px;
        }

        .finance-stats {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 15px;
          margin-bottom: 24px;
        }

        .finance-stat-card {
          min-width: 0;
          padding: 19px;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .finance-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .finance-stat-top small {
          color: var(--muted);
          font-size: 10px;
          font-weight: 600;
        }

        .finance-stat-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          color: var(--primary);
          background: #edf3ff;
          border-radius: 9px;
        }

        .finance-stat-card h3 {
          margin: 14px 0 4px;
          font-size: 22px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .finance-stat-card p {
          margin: 0;
          color: #9aa5b5;
          font-size: 9px;
        }

        .finance-panel {
          margin-bottom: 22px;
          padding: 21px;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .finance-panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .finance-panel-heading h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
        }

        .finance-panel-heading p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 10px;
        }

        .finance-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .finance-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
          text-align: left;
        }

        .finance-table th {
          padding: 12px 10px;
          color: #8996a9;
          background: #f8faff;
          border-bottom: 1px solid var(--border);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .finance-table td {
          padding: 13px 10px;
          color: #627087;
          border-bottom: 1px solid #f0f2f6;
          font-size: 10px;
          white-space: nowrap;
          vertical-align: middle;
        }

        .finance-table td strong {
          color: #2b3b54;
          font-size: 10px;
        }

        .sub-value {
          display: block;
          max-width: 150px;
          margin-top: 4px;
          color: #9aa5b5;
          font-size: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .finance-employee-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .finance-mini-avatar {
          width: 29px;
          height: 29px;
          font-size: 10px;
        }

        .finance-employee-cell strong,
        .finance-employee-cell small {
          display: block;
        }

        .finance-employee-cell small {
          max-width: 150px;
          margin-top: 4px;
          color: #96a2b3;
          font-size: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .finance-product-cell {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #34445c;
          font-weight: 600;
        }

        .finance-product-cell svg {
          color: var(--primary);
          flex-shrink: 0;
        }

        .finance-amount {
          color: #243651 !important;
          font-weight: 800;
        }

        .finance-status {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 800;
        }

        .finance-status.pending {
          color: #a76b0b;
          background: #fff5dc;
        }

        .finance-status.waiting {
          color: #3569bf;
          background: #edf3ff;
        }

        .finance-status.approved {
          color: #13834c;
          background: #e9f9f0;
        }

        .finance-status.rejected {
          color: #bd3445;
          background: #fff0f1;
        }

        .finance-status.default {
          color: #59677c;
          background: #edf0f5;
        }

        .finance-row-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .finance-icon-button,
        .finance-approve-button,
        .finance-reject-button {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 7px;
          cursor: pointer;
        }

        .finance-icon-button {
          color: #53647d;
          background: #eef2f7;
        }

        .finance-approve-button {
          color: #13834c;
          background: #e9f9f0;
        }

        .finance-reject-button {
          color: #bd3445;
          background: #fff0f1;
        }

        .finance-empty {
          min-height: 145px;
          text-align: center !important;
          color: #9aa6b7 !important;
        }

        .finance-empty svg,
        .finance-empty strong,
        .finance-empty span {
          display: block;
          margin: 0 auto 7px;
        }

        .finance-empty strong {
          color: #53627a !important;
        }

        .finance-empty span {
          font-size: 10px;
          white-space: normal;
        }

        .finance-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 17px;
          flex-wrap: wrap;
        }

        .finance-search {
          width: min(350px,100%);
          height: 38px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #8795a9;
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .finance-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          font-size: 11px;
        }

        .finance-filter {
          height: 38px;
          padding: 0 10px;
          color: #52627a;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 8px;
          outline: 0;
          font-size: 10px;
        }

        .finance-budget-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 13px;
        }

        .finance-budget-card {
          padding: 17px;
          border: 1px solid var(--border);
          border-radius: 9px;
        }

        .finance-budget-card-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 15px;
        }

        .finance-budget-card h4 {
          margin: 0 0 7px;
          font-size: 12px;
        }

        .finance-budget-card p {
          margin: 0;
          color: var(--muted);
          font-size: 10px;
        }

        .finance-budget-line {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 9px;
          color: #6f7d91;
          font-size: 9px;
        }

        .finance-budget-line strong {
          color: #273951;
        }

        .finance-available {
          color: #13834c !important;
        }

        .finance-progress {
          height: 6px;
          margin-top: 10px;
          overflow: hidden;
          background: #edf1f7;
          border-radius: 10px;
        }

        .finance-progress span {
          display: block;
          height: 100%;
          background: #3476e5;
          border-radius: inherit;
        }

        .finance-budget-meta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid #f0f2f6;
          color: #8a97a9;
          font-size: 9px;
        }

        .finance-budget-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 30px;
        }

        .finance-alert {
          margin-bottom: 17px;
          padding: 12px 14px;
          display: flex;
          align-items: flex-start;
          gap: 9px;
          border-radius: 8px;
          font-size: 10px;
          line-height: 1.5;
        }

        .finance-alert.error {
          color: #b42332;
          background: #fff0f1;
          border: 1px solid #ffdadd;
        }

        .finance-alert.success {
          color: #16804b;
          background: #edfff5;
          border: 1px solid #c9f1db;
        }

        .finance-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15,28,49,.48);
        }

        .finance-modal {
          width: min(760px,100%);
          max-height: 92vh;
          overflow-y: auto;
          padding: 24px;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 20px 70px rgba(0,0,0,.2);
        }

        .finance-modal-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 19px;
        }

        .finance-modal-heading h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .finance-modal-close {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          color: #64748b;
          background: #f1f4f8;
          border: 0;
          border-radius: 7px;
          cursor: pointer;
        }

        .finance-modal-close:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .finance-detail-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 10px;
          margin-bottom: 15px;
        }

        .finance-detail {
          min-width: 0;
          padding: 12px;
          background: #f7f9fc;
          border: 1px solid #edf0f5;
          border-radius: 8px;
        }

        .finance-detail small {
          display: block;
          margin-bottom: 6px;
          color: #8795a9;
          font-size: 9px;
        }

        .finance-detail strong {
          display: block;
          color: #293951;
          font-size: 11px;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .finance-all-fields {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 9px;
          margin-top: 15px;
        }

        .finance-history {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid var(--border);
        }

        .finance-history h4 {
          margin: 0 0 12px;
          font-size: 12px;
        }

        .finance-history-item {
          padding: 11px;
          margin-bottom: 8px;
          background: #f7f9fc;
          border-radius: 8px;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .finance-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        .finance-form-field {
          min-width: 0;
          margin-bottom: 13px;
        }

        .finance-form-field.full {
          grid-column: 1/-1;
        }

        .finance-form-field label,
        .finance-modal-field label {
          display: block;
          margin-bottom: 7px;
          color: #47566d;
          font-size: 10px;
          font-weight: 700;
        }

        .finance-form-field input,
        .finance-form-field select,
        .finance-form-field textarea,
        .finance-modal-field textarea {
          width: 100%;
          min-height: 39px;
          padding: 9px 10px;
          color: #293951;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 8px;
          outline: 0;
          font-size: 11px;
        }

        .finance-form-field textarea,
        .finance-modal-field textarea {
          min-height: 75px;
          resize: vertical;
        }

        .finance-modal-field {
          margin-top: 16px;
        }

        .finance-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 20px;
        }

        .finance-mobile-menu {
          display: none;
          width: 35px;
          height: 35px;
          place-items: center;
          color: #52627a;
          background: #f5f7fb;
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
        }

        .finance-loading {
          min-height: 250px;
          display: grid;
          place-items: center;
          color: #8290a5;
          font-size: 11px;
        }

        .finance-loading svg {
          animation: finance-spin 1s linear infinite;
        }

        @keyframes finance-spin {
          to { transform: rotate(360deg); }
        }

        @media(max-width:1050px) {
          .finance-sidebar {
            width: 220px;
            min-width: 220px;
          }

          .finance-content {
            padding: 25px 20px;
          }

          .finance-stats {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
        }

        @media(max-width:760px) {
          .finance-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-105%);
            transition: transform .25s;
            box-shadow: 10px 0 30px rgba(20,35,60,.08);
          }

          .finance-sidebar.open {
            transform: translateX(0);
          }

          .finance-mobile-menu {
            display: grid;
          }

          .finance-topbar {
            padding: 0 16px;
          }

          .finance-content {
            padding: 22px 15px;
          }

          .finance-welcome {
            align-items: flex-start;
            flex-direction: column;
          }

          .finance-panel {
            padding: 15px;
          }
        }

        @media(max-width:480px) {
          .finance-topbar-user > div:last-child {
            display: none;
          }

          .finance-stats {
            gap: 10px;
          }

          .finance-stat-card {
            padding: 14px;
          }

          .finance-stat-card h3 {
            font-size: 19px;
          }

          .finance-budget-grid,
          .finance-detail-grid,
          .finance-all-fields,
          .finance-form-grid {
            grid-template-columns: 1fr;
          }

          .finance-form-field.full {
            grid-column: auto;
          }

          .finance-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .finance-search {
            width: 100%;
          }

          .finance-modal-actions {
            flex-direction: column-reverse;
          }

          .finance-modal-actions button {
            width: 100%;
          }
        }
      `}</style>

      {/* ====================================================
          SIDEBAR
      ==================================================== */}

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

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

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

              {/* ============================================
                  OVERVIEW
              ============================================ */}

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

                      <h3>
                        {pendingFinanceRequests.length}
                      </h3>

                      <p>
                        Manager-approved requests
                      </p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Waiting for Manager</small>
                        <span className="finance-stat-icon">
                          <ClipboardList size={18} />
                        </span>
                      </div>

                      <h3>
                        {waitingForManagerRequests.length}
                      </h3>

                      <p>
                        Requests not yet forwarded to Finance
                      </p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Approved Requests</small>
                        <span className="finance-stat-icon">
                          <CheckCircle2 size={18} />
                        </span>
                      </div>

                      <h3>
                        {approvedRequests.length}
                      </h3>

                      <p>
                        Total approved requests
                      </p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Pending Amount</small>
                        <span className="finance-stat-icon">
                          <IndianRupee size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {money(pendingAmount)}
                      </h3>

                      <p>
                        Awaiting Finance review
                      </p>
                    </div>

                  </section>

                  {/* FINANCIAL SUMMARY */}

                  <section className="finance-stats">

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Total Allocated</small>
                        <span className="finance-stat-icon">
                          <Wallet size={18} />
                        </span>
                      </div>

                      <h3 style={{ fontSize: 18 }}>
                        {money(totalAllocatedBudget)}
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
                        {money(totalCommittedBudget)}
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
                        {money(totalSpentBudget)}
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
                        {money(totalAvailableBudget)}
                      </h3>

                      <p>Remaining budget amount</p>
                    </div>

                  </section>

                  {/* PENDING REQUESTS */}

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Requests Awaiting Finance</h3>
                        <p>
                          Only manager-approved requests can
                          be processed here.
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
                      pendingFinanceRequests
                    )}
                  </section>

                  {/* BUDGET SUMMARY */}

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Budget Summary</h3>

                        <p>
                          Total available:{" "}
                          {money(totalAvailableBudget)}
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

              {/* ============================================
                  EMPLOYEE REQUESTS
              ============================================ */}

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
                          Finance pending:{" "}
                          {pendingFinanceRequests.length}
                          {" | "}
                          Waiting for manager:{" "}
                          {waitingForManagerRequests.length}
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
                        <option value="all">
                          All requests
                        </option>

                        <option value="pending">
                          Awaiting Finance
                        </option>

                        <option value="waiting">
                          Waiting for Manager
                        </option>

                        <option value="approved">
                          Approved
                        </option>

                        <option value="rejected">
                          Rejected
                        </option>
                      </select>
                    </div>

                    {renderRequestsTable(filteredRequests)}
                  </section>
                </>
              )}

              {/* ============================================
                  BUDGETS
              ============================================ */}

              {activeTab === "budgets" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <h2>Budget Management</h2>

                      <p>
                        Manage department and organization
                        budget allocations.
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

              {/* ============================================
                  APPROVAL HISTORY
              ============================================ */}

              {activeTab === "approvals" && (
                <>
                  <section className="finance-welcome">
                    <div>
                      <h2>Finance Approval History</h2>

                      <p>
                        Review approved and rejected employee
                        procurement requests.
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

                      <p>
                        {money(approvedAmount)} total approved
                      </p>
                    </div>

                    <div className="finance-stat-card">
                      <div className="finance-stat-top">
                        <small>Rejected</small>
                        <XCircle size={19} />
                      </div>

                      <h3>{rejectedRequests.length}</h3>

                      <p>
                        {money(rejectedAmount)} total rejected
                      </p>
                    </div>
                  </section>

                  <section className="finance-panel">
                    <div className="finance-panel-heading">
                      <div>
                        <h3>Processed Requests</h3>

                        <p>
                          {approvedRequests.length +
                            rejectedRequests.length}{" "}
                          processed requests
                        </p>
                      </div>
                    </div>

                    {renderRequestsTable([
                      ...approvedRequests,
                      ...rejectedRequests
                    ])}
                  </section>
                </>
              )}

            </>
          )}
        </div>
      </main>

      {/* ====================================================
          COMPLETE EMPLOYEE REQUEST DETAILS MODAL
      ==================================================== */}

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
                  marginTop: 5
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

            <h4 style={{
              margin: "0 0 12px",
              fontSize: 12
            }}>
              <User
                size={14}
                style={{
                  display: "inline",
                  marginRight: 6
                }}
              />
              Employee Information
            </h4>

            <div className="finance-detail-grid">
              <div className="finance-detail">
                <small>Employee Name</small>
                <strong>
                  {getEmployeeName(selectedRequest)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Employee ID</small>
                <strong>
                  {getRequesterId(selectedRequest) || "Not provided"}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Email Address</small>
                <strong>
                  {getEmployeeEmail(selectedRequest)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Department</small>
                <strong>
                  {getDepartment(selectedRequest)}
                </strong>
              </div>
            </div>

            <h4 style={{
              margin: "18px 0 12px",
              fontSize: 12
            }}>
              <Package
                size={14}
                style={{
                  display: "inline",
                  marginRight: 6
                }}
              />
              Product Information
            </h4>

            <div className="finance-detail-grid">
              <div className="finance-detail">
                <small>Product Name</small>
                <strong>
                  {getProductName(selectedRequest)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Supplier</small>
                <strong>
                  {getSupplier(selectedRequest)}
                </strong>
              </div>

              <div className="finance-detail">
                <small>Quantity</small>
                <strong>
                  {displayValue(getQuantity(selectedRequest))}
                </strong>
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
                <strong>
                  {getCurrency(selectedRequest)}
                </strong>
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

            <h4 style={{
              margin: "18px 0 12px",
              fontSize: 12
            }}>
              Business Justification
            </h4>

            <div className="finance-detail">
              <strong>
                {selectedRequest.justification ||
                 selectedRequest.description ||
                 "No justification was returned by the API."}
              </strong>
            </div>

            {selectedRequest.description &&
             selectedRequest.justification && (
              <div className="finance-detail" style={{
                marginTop: 10
              }}>
                <small>Additional Description</small>
                <strong>
                  {selectedRequest.description}
                </strong>
              </div>
            )}

            <h4 style={{
              margin: "20px 0 10px",
              fontSize: 12
            }}>
              <History
                size={14}
                style={{
                  display: "inline",
                  marginRight: 6
                }}
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

            {/* APPROVAL HISTORY */}

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

            {/* ALL REMAINING API FIELDS */}

            <h4 style={{
              margin: "20px 0 10px",
              fontSize: 12
            }}>
              All Other Values Returned by the API
            </h4>

            <div className="finance-all-fields">
              {getRealRequestDetails(selectedRequest).map(
                ({ key, label, value }) => (
                  <div
                    className="finance-detail"
                    key={key}
                  >
                    <small>{label}</small>
                    <strong>
                      {displayValue(value)}
                    </strong>
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

              {FINANCE_REVIEW_STATUSES.includes(
                getStatus(selectedRequest)
              ) && (
                <>
                  <button
                    className="finance-button"
                    style={{
                      color: "#bd3445",
                      background: "#fff0f1"
                    }}
                    onClick={() => {
                      openDecisionModal(
                        selectedRequest,
                        "reject"
                      );
                      setSelectedRequest(null);
                    }}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>

                  <button
                    className="finance-button primary"
                    onClick={() => {
                      openDecisionModal(
                        selectedRequest,
                        "approve"
                      );
                      setSelectedRequest(null);
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          FINANCE APPROVE / REJECT MODAL
      ==================================================== */}

      {decisionModal.request && (
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
                      reason: event.target.value
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
                  fontSize: 9
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
                          borderColor: "#c83d4d"
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

      {/* ====================================================
          CREATE / EDIT BUDGET MODAL
      ==================================================== */}

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
                    placeholder="IT Department Annual Budget"
                    required
                  />
                </div>

                <div className="finance-form-field">
                  <label>Department</label>

                  <input
                    name="department"
                    value={budgetForm.department}
                    onChange={updateBudgetField}
                    placeholder="IT / HR / Finance"
                  />
                </div>

                <div className="finance-form-field">
                  <label>Category</label>

                  <input
                    name="category"
                    value={budgetForm.category}
                    onChange={updateBudgetField}
                    placeholder="Equipment / Software"
                  />
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

                <div className="finance-form-field full">
                  <label>Status</label>

                  <select
                    name="status"
                    value={budgetForm.status}
                    onChange={updateBudgetField}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="finance-form-field full">
                  <label>Description</label>

                  <textarea
                    name="description"
                    value={budgetForm.description}
                    onChange={updateBudgetField}
                    placeholder="Describe the purpose of this budget..."
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
