
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Wallet,
  Receipt,
  UserRound,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Send,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Package,
  CalendarDays,
  Building2,
  ChevronRight,
  ShieldCheck,
  Landmark,
  UserCheck,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Laptop,
  Monitor,
  Keyboard,
  Printer,
  Headphones,
  Smartphone,
  SearchX,
  CreditCard,
  FileDown,
  Filter,
  Check,
  CircleDollarSign,
  History,
  Tag,
} from "lucide-react";

import "./EmployeePage.css";

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
)
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "")
  .replace(/\/api$/, "");

const API_ROOT = `${API_ORIGIN}/api/v1`;
const REFRESH_INTERVAL = 15000;
const ACTIVE_PAGE_STORAGE_KEY = "etdox_employee_active_page";

/* =========================================================
   SAMPLE STORE PRODUCTS

   Temporary frontend catalog.
   Later, replace this array with products from your API.
========================================================= */

const STORE_PRODUCTS = [
  {
    id: "ETD-001",
    name: "Business Laptop",
    category: "Computers",
    description: "Professional laptop for office and development work.",
    price: 65000,
    currency: "INR",
    icon: Laptop,
    supplier: "ETDOX Approved Supplier",
    stock: 15,
  },
  {
    id: "ETD-002",
    name: "Desktop Monitor",
    category: "Computers",
    description: "24-inch Full HD monitor for workplace productivity.",
    price: 12500,
    currency: "INR",
    icon: Monitor,
    supplier: "ETDOX Approved Supplier",
    stock: 20,
  },
  {
    id: "ETD-003",
    name: "Wireless Keyboard",
    category: "Accessories",
    description: "Wireless keyboard for everyday office use.",
    price: 1800,
    currency: "INR",
    icon: Keyboard,
    supplier: "ETDOX Approved Supplier",
    stock: 35,
  },
  {
    id: "ETD-004",
    name: "Office Headset",
    category: "Accessories",
    description: "Comfortable headset with microphone.",
    price: 3200,
    currency: "INR",
    icon: Headphones,
    supplier: "ETDOX Approved Supplier",
    stock: 25,
  },
  {
    id: "ETD-005",
    name: "Office Printer",
    category: "Office Equipment",
    description: "Multifunction printer for office documents.",
    price: 14500,
    currency: "INR",
    icon: Printer,
    supplier: "ETDOX Approved Supplier",
    stock: 8,
  },
  {
    id: "ETD-006",
    name: "Business Smartphone",
    category: "Electronics",
    description: "Business smartphone for work communication.",
    price: 22000,
    currency: "INR",
    icon: Smartphone,
    supplier: "ETDOX Approved Supplier",
    stock: 12,
  },
];

// Additional illustrative store catalogue entries. These remain frontend sample data.
STORE_PRODUCTS.push(
  { id: "ETD-007", name: "A4 Paper Pack", category: "Office Supplies", description: "Premium A4 copier paper for daily office printing.", price: 420, currency: "INR", icon: Printer, supplier: "ETDOX Approved Supplier", stock: 80 },
  { id: "ETD-008", name: "Ergonomic Office Chair", category: "Furniture", description: "Adjustable ergonomic chair for workstation comfort.", price: 7800, currency: "INR", icon: Building2, supplier: "ETDOX Approved Supplier", stock: 14 },
  { id: "ETD-009", name: "Business Software License", category: "Software & Licenses", description: "Annual productivity software license for business use.", price: 5400, currency: "INR", icon: Package, supplier: "ETDOX Approved Supplier", stock: 100 },
  { id: "ETD-010", name: "Wi-Fi 6 Router", category: "Networking", description: "Dual-band Wi-Fi 6 router for office connectivity.", price: 6900, currency: "INR", icon: Monitor, supplier: "ETDOX Approved Supplier", stock: 18 },
  { id: "ETD-011", name: "Endpoint Security Suite", category: "Security", description: "Endpoint protection subscription for company devices.", price: 3200, currency: "INR", icon: ShieldCheck, supplier: "ETDOX Approved Supplier", stock: 60 },
  { id: "ETD-012", name: "Office Maintenance Service", category: "Facilities", description: "Scheduled office equipment maintenance service.", price: 2500, currency: "INR", icon: Building2, supplier: "ETDOX Approved Supplier", stock: 30 },
  { id: "ETD-013", name: "IT Support Service", category: "Services", description: "On-site IT support and workstation setup service.", price: 1800, currency: "INR", icon: UserCheck, supplier: "ETDOX Approved Supplier", stock: 25 }
);

const STORE_CATEGORIES = [
  "All",
  "Computers",
  "Accessories",
  "Office Equipment",
  "Electronics",
  "Office Supplies",
  "Furniture",
  "Software & Licenses",
  "Networking",
  "Security",
  "Facilities",
  "Services",
];

/* =========================================================
   NAVIGATION
========================================================= */

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Order Products", icon: ShoppingCart },
  { label: "My Requests", icon: ClipboardList },
  { label: "Budgets", icon: Wallet },
  { label: "Invoices", icon: Receipt },
  { label: "My Profile", icon: UserRound },
];

const VALID_PAGES = navigation.map((item) => item.label);

const getInitialPage = () => {
  try {
    const savedPage = localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);

    return VALID_PAGES.includes(savedPage) ? savedPage : "Overview";
  } catch {
    return "Overview";
  }
};

/* =========================================================
   HELPERS
========================================================= */

const money = (value, currency = "INR") => {
  const amount = Number(value ?? 0);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `₹${
      Number.isFinite(amount)
        ? amount.toLocaleString("en-IN")
        : "0"
    }`;
  }
};

const normalizeStatus = (status) =>
  String(status || "UNKNOWN")
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .toUpperCase();

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Waiting for manager",
  PENDING: "Pending approval",
  PENDING_MANAGER: "Waiting for manager",
  MANAGER_PENDING: "Waiting for manager",
  MANAGER_APPROVED: "Approved by manager",
  APPROVED_BY_MANAGER: "Approved by manager",
  PENDING_FINANCE: "Waiting for Finance",
  FINANCE_PENDING: "Waiting for Finance",
  FINANCE_APPROVED: "Approved by Finance",
  APPROVED_BY_FINANCE: "Approved by Finance",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  REJECTED_MANAGER: "Rejected by manager",
  MANAGER_REJECTED: "Rejected by manager",
  REJECTED_BY_MANAGER: "Rejected by manager",
  REJECTED_FINANCE: "Rejected by Finance",
  FINANCE_REJECTED: "Rejected by Finance",
  REJECTED_BY_FINANCE: "Rejected by Finance",
  CANCELLED: "Cancelled",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  PARTIALLY_PAID: "Partially paid",
  ACTIVE: "Active",
};

const MANAGER_PENDING = [
  "SUBMITTED",
  "PENDING",
  "PENDING_MANAGER",
  "MANAGER_PENDING",
];

const MANAGER_APPROVED = [
  "MANAGER_APPROVED",
  "APPROVED_BY_MANAGER",
];

const FINANCE_PENDING = [
  "PENDING_FINANCE",
  "FINANCE_PENDING",
];

const FINANCE_APPROVED = [
  "FINANCE_APPROVED",
  "APPROVED_BY_FINANCE",
  "APPROVED",
  "COMPLETED",
];

const REJECTED_STATUSES = [
  "REJECTED",
  "REJECTED_MANAGER",
  "MANAGER_REJECTED",
  "REJECTED_BY_MANAGER",
  "REJECTED_FINANCE",
  "FINANCE_REJECTED",
  "REJECTED_BY_FINANCE",
];

const requestIdOf = (item) =>
  item?.id ??
  item?.requestId ??
  item?.request_id ??
  item?.procurementId ??
  item?.procurement_id ??
  null;

const requestNameOf = (item) =>
  item?.productName ||
  item?.product_name ||
  item?.title ||
  item?.name ||
  item?.itemName ||
  "Untitled request";

const requestAmountOf = (item) =>
  Number(
    item?.totalAmount ??
      item?.total_amount ??
      item?.total ??
      item?.amount ??
      item?.estimatedAmount ??
      item?.estimated_amount ??
      0
  );

const requestQuantityOf = (item) =>
  item?.quantity ??
  item?.requestedQuantity ??
  item?.requested_quantity ??
  0;

const requestDepartmentOf = (item) => {
  const department = item?.department;

  if (typeof department === "string") return department;

  if (department && typeof department === "object") {
    return (
      department.name ||
      department.label ||
      department.departmentName ||
      "—"
    );
  }

  return (
    item?.departmentName ||
    item?.department_name ||
    item?.departmentLabel ||
    "—"
  );
};

const requestDateOf = (item) =>
  item?.createdAt ||
  item?.created_at ||
  item?.submittedAt ||
  item?.submitted_at ||
  null;

const budgetIdOf = (budget) =>
  budget?.id ??
  budget?.budgetId ??
  budget?.budget_id ??
  "";

const budgetAllocatedOf = (budget) =>
  Number(
    budget?.allocatedAmount ??
      budget?.allocated_amount ??
      budget?.allocated ??
      budget?.totalAmount ??
      budget?.total_amount ??
      budget?.amount ??
      0
  );

const budgetSpentOf = (budget) =>
  Number(
    budget?.spentAmount ??
      budget?.spent_amount ??
      budget?.spent ??
      0
  );

const budgetCommittedOf = (budget) =>
  Number(
    budget?.committedAmount ??
      budget?.committed_amount ??
      budget?.committed ??
      0
  );

const budgetReservedOf = (budget) =>
  Number(
    budget?.reservedAmount ??
      budget?.reserved_amount ??
      budget?.reserved ??
      0
  );

const budgetAvailableOf = (budget) => {
  const explicit =
    budget?.availableAmount ??
    budget?.available_amount ??
    budget?.remainingAmount ??
    budget?.remaining_amount ??
    budget?.available;

  if (explicit !== undefined && explicit !== null) {
    return Math.max(0, Number(explicit) || 0);
  }

  return Math.max(
    0,
    budgetAllocatedOf(budget) -
      budgetSpentOf(budget) -
      budgetCommittedOf(budget) -
      budgetReservedOf(budget)
  );
};

const budgetDepartmentIdOf = (budget) =>
  budget?.departmentId ??
  budget?.department_id ??
  budget?.department?.id ??
  null;

const budgetDepartmentOf = (budget) => {
  if (typeof budget?.department === "string") {
    return budget.department;
  }

  return (
    budget?.department?.name ||
    budget?.department?.label ||
    budget?.departmentName ||
    budget?.department_name ||
    budget?.name ||
    "Department budget"
  );
};

const unwrapArray = (response, preferredKeys = []) => {
  const keys = [
    ...preferredKeys,
    "requests",
    "budgets",
    "invoices",
    "products",
    "items",
    "records",
    "results",
    "data",
  ];

  let current = response;

  for (let depth = 0; depth < 8; depth += 1) {
    if (Array.isArray(current)) return current;
    if (!current || typeof current !== "object") return [];

    for (const key of keys) {
      if (Array.isArray(current[key])) return current[key];
    }

    let found = false;

    for (const key of ["data", "result", "payload", "response"]) {
      if (current[key] && typeof current[key] === "object") {
        current = current[key];
        found = true;
        break;
      }
    }

    if (!found) return [];
  }

  return [];
};

const getUser = (response) =>
  response?.user ||
  response?.data?.user ||
  response?.data?.data?.user ||
  response?.data ||
  null;

const getCreatedRequest = (response) =>
  response?.request ||
  response?.data?.request ||
  response?.data?.data?.request ||
  response?.data?.data ||
  response?.data ||
  response;

const findRequestId = (object, depth = 0) => {
  if (!object || typeof object !== "object" || depth > 5) {
    return null;
  }

  const directId = requestIdOf(object);
  if (directId) return directId;

  for (const key of [
    "request",
    "data",
    "result",
    "payload",
    "procurement",
  ]) {
    if (object[key] && typeof object[key] === "object") {
      const id = findRequestId(object[key], depth + 1);
      if (id) return id;
    }
  }

  return null;
};

const getRequestError = (result, fallback) => {
  const details = result?.details || result?.errors || result?.issues;

  if (Array.isArray(details)) {
    const messages = details
      .map((item) => item?.message || item?.msg || item?.path?.join?.("."))
      .filter(Boolean);

    if (messages.length) return messages.join("; ");
  }

  if (details && typeof details === "object") {
    return Object.entries(details)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");
  }

  return result?.message || result?.error || result?.detail || fallback;
};

const getToken = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("accessToken") ||
  sessionStorage.getItem("authToken") ||
  sessionStorage.getItem("token");

const getStatusClass = (status) =>
  normalizeStatus(status).toLowerCase().replaceAll("_", "-");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatApprovalDate = (value) => {
  if (!value) return "Awaiting action";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Awaiting action";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* =========================================================
   APPROVAL PROGRESS
========================================================= */

const getApprovalProgress = (status) => {
  const normalized = normalizeStatus(status);

  const managerRejected = [
    "REJECTED_MANAGER",
    "MANAGER_REJECTED",
    "REJECTED_BY_MANAGER",
  ].includes(normalized);

  const financeRejected = [
    "REJECTED_FINANCE",
    "FINANCE_REJECTED",
    "REJECTED_BY_FINANCE",
    "REJECTED",
  ].includes(normalized);

  const managerApproved =
    MANAGER_APPROVED.includes(normalized) ||
    FINANCE_PENDING.includes(normalized) ||
    FINANCE_APPROVED.includes(normalized);

  const financeApproved = FINANCE_APPROVED.includes(normalized);

  return {
    managerApproved,
    financeApproved,
    managerRejected,
    financeRejected,
    rejected: REJECTED_STATUSES.includes(normalized),
    cancelled: normalized === "CANCELLED",
    managerState: managerRejected
      ? "rejected"
      : managerApproved
        ? "approved"
        : "pending",
    financeState: financeRejected
      ? "rejected"
      : financeApproved
        ? "approved"
        : managerApproved
          ? "pending"
          : "waiting",
  };
};

const canWithdrawRequest = (item) => {
  const status = normalizeStatus(item?.status);

  return [
    "DRAFT",
    "SUBMITTED",
    "PENDING",
    "PENDING_MANAGER",
    "MANAGER_PENDING",
    "PENDING_FINANCE",
    "FINANCE_PENDING",
  ].includes(status);
};

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);

  return (
    <span className={`proc-status proc-status-${getStatusClass(normalized)}`}>
      {STATUS_LABELS[normalized] || normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({
  icon: Icon = ClipboardList,
  title,
  description,
}) {
  return (
    <div className="employee-empty-state">
      <span className="employee-empty-icon">
        <Icon size={24} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function ApprovalTimeline({ request }) {
  const progress = getApprovalProgress(request.status);

  const submittedDate =
    request.submittedAt ||
    request.submitted_at ||
    request.createdAt ||
    request.created_at;

  const managerDate =
    request.managerApprovedAt ||
    request.manager_approved_at ||
    request.managerActionAt ||
    request.manager_action_at;

  const financeDate =
    request.financeApprovedAt ||
    request.finance_approved_at ||
    request.financeActionAt ||
    request.finance_action_at;

  const stages = [
    {
      key: "submitted",
      title: "Request submitted",
      subtitle: "Employee",
      date: submittedDate,
      state: "approved",
      icon: UserCheck,
    },
    {
      key: "manager",
      title: "Manager approval",
      subtitle: progress.managerRejected
        ? "Rejected by manager"
        : progress.managerApproved
          ? "Approved by manager"
          : "Waiting for manager",
      date: managerDate,
      state: progress.managerState,
      icon: ShieldCheck,
    },
    {
      key: "finance",
      title: "Finance approval",
      subtitle: progress.financeRejected
        ? "Rejected by Finance"
        : progress.financeApproved
          ? "Approved by Finance"
          : progress.managerApproved
            ? "Waiting for Finance"
            : "Pending manager approval",
      date: financeDate,
      state: progress.financeState,
      icon: Landmark,
    },
  ];

  return (
    <div className="approval-timeline">
      <div className="approval-timeline-heading">
        <div>
          <h4>Approval progress</h4>
          <p>Track each stage of your purchase request.</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="approval-track">
        {stages.map((stage, index) => {
          const Icon = stage.icon;

          return (
            <div
              className={`approval-stage approval-stage-${stage.state}`}
              key={stage.key}
            >
              <div className="approval-stage-indicator">
                <span className="approval-stage-icon">
                  {stage.state === "rejected" ? (
                    <X size={19} />
                  ) : stage.state === "approved" ? (
                    <CheckCircle2 size={19} />
                  ) : (
                    <Icon size={19} />
                  )}
                </span>

                {index !== stages.length - 1 && (
                  <span
                    className={`approval-stage-line ${
                      stage.state === "approved"
                        ? "approval-line-complete"
                        : ""
                    }`}
                  />
                )}
              </div>

              <div className="approval-stage-content">
                <strong>{stage.title}</strong>
                <span className="approval-stage-subtitle">
                  {stage.subtitle}
                </span>
                <small>{formatApprovalDate(stage.date)}</small>
              </div>
            </div>
          );
        })}
      </div>

      {progress.rejected && (
        <div className="approval-rejection-note">
          <AlertCircle size={17} />
          This request was rejected. Contact the relevant approver
          for further information.
        </div>
      )}

      {progress.cancelled && (
        <div className="approval-cancelled-note">
          This request has been cancelled.
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMPLOYEE PAGE
========================================================= */

export default function EmployeePage() {
  const [activePage, setActivePage] = useState(getInitialPage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("ALL");
  const [demoPayments, setDemoPayments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("etdox_demo_invoice_payments") || "{}");
    } catch {
      return {};
    }
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(null);

  /* Store state */
  const [storeSearch, setStoreSearch] = useState("");
  const [storeCategory, setStoreCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [checkoutBudgetId, setCheckoutBudgetId] = useState("");

  const refreshLock = useRef(false);
  const mounted = useRef(false);

  const [form, setForm] = useState({
    productName: "",
    description: "",
    supplier: "",
    quantity: "1",
    unitPrice: "",
    budgetId: "",
    justification: "",
    currency: "INR",
  });

  /* =======================================================
     PERSIST ACTIVE PAGE
  ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
    } catch (storageError) {
      console.warn("[ETDOX] Could not save active page:", storageError);
    }
  }, [activePage]);

  const navigateTo = useCallback((page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    setError("");
    setSuccess("");
  }, []);

  /* =======================================================
     LOGOUT
  ======================================================= */

  const logout = useCallback(() => {
    [
      "token",
      "accessToken",
      "authToken",
      "user",
      ACTIVE_PAGE_STORAGE_KEY,
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    window.location.assign("/login");
  }, []);

  /* =======================================================
     API REQUEST
  ======================================================= */

  const apiRequest = useCallback(
    async (path, options = {}) => {
      const token = getToken();

      if (!token) {
        throw new Error("Login token not found. Please log in again.");
      }

      const headers = new Headers(options.headers || {});
      headers.set("Accept", "application/json");
      headers.set("Authorization", `Bearer ${token}`);

      if (options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      let response;

      try {
        response = await fetch(`${API_ROOT}${path}`, {
          ...options,
          headers,
        });
      } catch {
        throw new Error(
          `Cannot connect to ${API_ROOT}. Start your backend server.`
        );
      }

      const contentType = response.headers.get("content-type") || "";
      let result = {};

      if (contentType.includes("application/json")) {
        result = await response.json().catch(() => ({}));
      } else {
        result.message = await response.text().catch(() => "");
      }

      if (import.meta.env.DEV) {
        console.info(
          `[ETDOX API] ${options.method || "GET"} ${path} -> ${response.status}`,
          result
        );
      }

      if (response.status === 401) {
        logout();
        throw new Error("Your login session expired. Please log in again.");
      }

      if (!response.ok) {
        const apiError = new Error(
          getRequestError(
            result,
            `API request failed with status ${response.status}.`
          )
        );

        apiError.status = response.status;
        apiError.response = result;
        throw apiError;
      }

      if (result?.success === false) {
        throw new Error(getRequestError(result, "API operation failed."));
      }

      return result;
    },
    [logout]
  );

  const tryEndpoints = useCallback(
    async (paths) => {
      let lastError;

      for (const path of paths) {
        try {
          return await apiRequest(path);
        } catch (err) {
          lastError = err;

          if (![404, 405].includes(err.status)) {
            throw err;
          }
        }
      }

      throw lastError || new Error("API endpoint not found.");
    },
    [apiRequest]
  );

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  const loadDashboard = useCallback(
    async (quiet = false) => {
      if (refreshLock.current) return;

      refreshLock.current = true;

      if (!quiet && mounted.current) {
        setLoading(true);
      }

      try {
        const results = await Promise.allSettled([
          tryEndpoints(["/procurement/requests", "/procurement"]),
          apiRequest("/budgets"),
          tryEndpoints(["/invoices", "/procurement/invoices"]),
          apiRequest("/auth/me"),
        ]);

        if (!mounted.current) return;

        const [requestResult, budgetResult, invoiceResult, userResult] =
          results;

        const errors = [];

        if (requestResult.status === "fulfilled") {
          const loadedRequests = unwrapArray(requestResult.value, [
            "requests",
            "items",
          ]);

          setRequests(loadedRequests);

          if (import.meta.env.DEV) {
            console.info(
              "[ETDOX] Loaded purchase requests:",
              loadedRequests.length,
              loadedRequests
            );
          }
        } else {
          errors.push(
            `Requests: ${
              requestResult.reason?.message ||
              "Could not load requests."
            }`
          );
        }

        if (budgetResult.status === "fulfilled") {
          const loadedBudgets = unwrapArray(budgetResult.value, [
            "budgets",
            "items",
          ]);

          setBudgets(loadedBudgets);

          setForm((previous) => {
            const selected = loadedBudgets.find(
              (item) =>
                String(budgetIdOf(item)) === String(previous.budgetId)
            );

            return {
              ...previous,
              budgetId: selected
                ? String(budgetIdOf(selected))
                : previous.budgetId,
              currency:
                selected?.currency || previous.currency || "INR",
            };
          });
        } else {
          errors.push(
            `Budgets: ${
              budgetResult.reason?.message ||
              "Could not load budgets."
            }`
          );
        }

        if (invoiceResult.status === "fulfilled") {
          setInvoices(
            unwrapArray(invoiceResult.value, ["invoices", "items"])
          );
        }

        if (userResult.status === "fulfilled") {
          setEmployee(getUser(userResult.value));
        } else {
          errors.push(
            `Profile: ${
              userResult.reason?.message ||
              "Could not load profile."
            }`
          );
        }

        setError(errors.join(" "));
        setLastUpdated(new Date());
      } catch (err) {
        if (mounted.current) {
          setError(err.message || "Unable to load employee dashboard.");
        }
      } finally {
        refreshLock.current = false;

        if (mounted.current && !quiet) {
          setLoading(false);
        }
      }
    },
    [apiRequest, tryEndpoints]
  );

  useEffect(() => {
    mounted.current = true;
    loadDashboard();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadDashboard(true);
      }
    }, REFRESH_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadDashboard(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [loadDashboard]);

  /* =======================================================
     FORM HANDLING
  ======================================================= */

  const updateField = (event) => {
    const { name, value } = event.target;

    if (name === "budgetId") {
      const selectedBudget = budgets.find(
        (item) => String(budgetIdOf(item)) === String(value)
      );

      setForm((previous) => ({
        ...previous,
        budgetId: value,
        currency: selectedBudget?.currency || previous.currency || "INR",
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =======================================================
     CREATE PURCHASE REQUEST
  ======================================================= */

  const createAndSubmitRequest = async (payload) => {
    const createResponse = await apiRequest("/procurement", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const createdRequest = getCreatedRequest(createResponse);
    const createdId =
      findRequestId(createResponse) || requestIdOf(createdRequest);

    if (!createdId) {
      throw new Error(
        "The server did not return a request ID. Check the procurement create response."
      );
    }

    try {
      await apiRequest(
        `/procurement/${encodeURIComponent(createdId)}/submit`,
        { method: "POST" }
      );
    } catch (submitError) {
      await loadDashboard(true);

      throw new Error(
        `Request ${createdId} was saved, but submission failed: ${submitError.message}`
      );
    }

    return createdId;
  };

  const submitRequest = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError("");
    setSuccess("");

    const productName = form.productName.trim();
    const justification = form.justification.trim();
    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);
    const total = quantity * unitPrice;

    if (!productName) {
      setError("Enter the product name.");
      return;
    }

    if (!justification) {
      setError("Enter the business justification.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0 ||
      !Number.isFinite(total)
    ) {
      setError("Enter a valid unit price.");
      return;
    }

    const selectedBudget = budgets.find(
      (item) => String(budgetIdOf(item)) === String(form.budgetId)
    );

    if (selectedBudget && total > budgetAvailableOf(selectedBudget)) {
      setError(
        `Insufficient budget. Available: ${money(
          budgetAvailableOf(selectedBudget),
          selectedBudget.currency
        )}. Request total: ${money(total, form.currency)}.`
      );
      return;
    }

    const employeeDepartment =
      employee?.department && typeof employee.department === "object"
        ? employee.department
        : null;

    const departmentId =
      employee?.departmentId ||
      employee?.department_id ||
      employeeDepartment?.id ||
      budgetDepartmentIdOf(selectedBudget);

    const departmentName =
      (typeof employee?.department === "string"
        ? employee.department
        : employeeDepartment?.name) ||
      employee?.departmentName ||
      employee?.department_name ||
      (selectedBudget ? budgetDepartmentOf(selectedBudget) : "");

    const description = [
      form.description.trim(),
      form.supplier.trim()
        ? `Preferred supplier: ${form.supplier.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      title: productName,
      productName,
      description,
      justification,
      supplier: form.supplier.trim(),
      quantity,
      unitPrice,
      amount: total,
      total,
      currency: selectedBudget?.currency || form.currency || "INR",
      department: departmentName,
      departmentName,
      ...(departmentId ? { departmentId } : {}),
      ...(selectedBudget
        ? {
            budgetId: budgetIdOf(selectedBudget),
            ...(selectedBudget.costCenterId ||
            selectedBudget.cost_center_id ||
            selectedBudget.costCenter?.id
              ? {
                  costCenterId:
                    selectedBudget.costCenterId ||
                    selectedBudget.cost_center_id ||
                    selectedBudget.costCenter?.id,
                }
              : {}),
          }
        : {}),
    };

    setSubmitting(true);

    try {
      const createdId = await createAndSubmitRequest(payload);

      setForm((previous) => ({
        ...previous,
        productName: "",
        description: "",
        supplier: "",
        quantity: "1",
        unitPrice: "",
        justification: "",
      }));

      setSuccess(
        `Purchase request ${createdId} was successfully submitted for manager approval.`
      );

      navigateTo("My Requests");
      await loadDashboard(true);
    } catch (err) {
      console.error("[ETDOX] Purchase request error:", err);
      setError(err.message || "Could not create the purchase request.");
      await loadDashboard(true);
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================================================
     PRODUCT STORE
  ======================================================= */

  const filteredProducts = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();

    return STORE_PRODUCTS.filter((product) => {
      const matchesCategory =
        storeCategory === "All" ||
        product.category === storeCategory;

      const matchesSearch =
        !query ||
        [
          product.name,
          product.category,
          product.description,
          product.id,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      return matchesCategory && matchesSearch;
    });
  }, [storeSearch, storeCategory]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    [cart]
  );

  const addToCart = (product) => {
    setCart((previous) => {
      const existing = previous.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return previous.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Math.min(
                  product.stock,
                  item.quantity + 1
                ),
              }
            : item
        );
      }

      return [
        ...previous,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          supplier: product.supplier,
          quantity: 1,
        },
      ];
    });

    setSuccess(`${product.name} added to your cart.`);
    setError("");
  };

  const updateCartQuantity = (productId, change) => {
    setCart((previous) =>
      previous
        .map((item) => {
          if (item.id !== productId) return item;

          const product = STORE_PRODUCTS.find(
            (entry) => entry.id === productId
          );

          const nextQuantity = item.quantity + change;

          return {
            ...item,
            quantity: Math.min(
              product?.stock || 99,
              nextQuantity
            ),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((previous) =>
      previous.filter((item) => item.id !== productId)
    );
  };

  const checkoutStore = async () => {
    if (submitting) return;

    if (!cart.length) {
      setError("Your cart is empty.");
      return;
    }

    const selectedBudget = budgets.find(
      (item) =>
        String(budgetIdOf(item)) === String(checkoutBudgetId)
    );

    if (!checkoutBudgetId) {
      setError("Select a budget allocation before placing your order.");
      return;
    }

    if (!selectedBudget) {
      setError("The selected budget could not be found. Refresh your budgets.");
      return;
    }

    if (cartTotal > budgetAvailableOf(selectedBudget)) {
      setError(
        `Insufficient budget. Available: ${money(
          budgetAvailableOf(selectedBudget),
          selectedBudget.currency
        )}. Cart total: ${money(cartTotal, selectedBudget.currency)}.`
      );
      return;
    }

    const department =
      typeof employee?.department === "string"
        ? employee.department
        : employee?.department?.name ||
          employee?.departmentName ||
          employee?.department_name ||
          budgetDepartmentOf(selectedBudget);

    const departmentId =
      employee?.departmentId ||
      employee?.department_id ||
      employee?.department?.id ||
      budgetDepartmentIdOf(selectedBudget);

    const orderDescription = cart
      .map(
        (item) =>
          `${item.name} | Product ID: ${item.id} | Quantity: ${item.quantity} | Unit price: ${money(item.price, item.currency)} | Line total: ${money(item.price * item.quantity, item.currency)}`
      )
      .join("\n");

    const totalQuantity = cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const payload = {
      title: `Store order - ${cart.length} product type(s)`,
      productName: `Store order - ${cart.length} product type(s)`,
      description: orderDescription,
      justification:
        "Purchase requested through the ETDOX employee product store.",
      supplier: "Multiple approved store suppliers",
      quantity: totalQuantity,
      unitPrice: Number((cartTotal / totalQuantity).toFixed(2)),
      amount: cartTotal,
      total: cartTotal,
      currency: selectedBudget.currency || "INR",
      department,
      departmentName: department,
      ...(departmentId ? { departmentId } : {}),
      budgetId: budgetIdOf(selectedBudget),
      ...(selectedBudget.costCenterId ||
      selectedBudget.cost_center_id ||
      selectedBudget.costCenter?.id
        ? {
            costCenterId:
              selectedBudget.costCenterId ||
              selectedBudget.cost_center_id ||
              selectedBudget.costCenter?.id,
          }
        : {}),
    };

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const createdId = await createAndSubmitRequest(payload);

      setCart([]);
      setCheckoutBudgetId("");

      setSuccess(
        `Your store order was submitted successfully. Request ID: ${createdId}. It is now waiting for manager approval.`
      );

      navigateTo("My Requests");
      await loadDashboard(true);
    } catch (err) {
      console.error("[ETDOX] Store checkout error:", err);
      setError(err.message || "Could not place your store order.");
      await loadDashboard(true);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStore = () => (
    <div className="employee-store">
      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>ETDOX Product Store</h2>
            <p>
              Browse workplace products and submit them for procurement
              approval.
            </p>
          </div>

          <div className="employee-store-cart-indicator">
            <ShoppingBag size={20} />
            <strong>{cartCount}</strong>
            <span>Cart items</span>
          </div>
        </div>

        <div className="employee-store-toolbar">
          <label className="proc-search-box">
            <Search size={17} />
            <input
              value={storeSearch}
              onChange={(event) => setStoreSearch(event.target.value)}
              placeholder="Search products..."
            />
          </label>

          <div className="employee-store-categories">
            {STORE_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  storeCategory === category
                    ? "employee-store-category active"
                    : "employee-store-category"
                }
                onClick={() => setStoreCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="employee-store-grid">
          {filteredProducts.map((product) => {
            const Icon = product.icon;
            const inCart = cart.find(
              (item) => item.id === product.id
            );

            return (
              <article
                className="employee-store-product"
                key={product.id}
              >
                <div className="employee-store-product-image">
                  <Icon size={42} strokeWidth={1.5} />
                </div>

                <div className="employee-store-product-info">
                  <span className="employee-store-product-category">
                    {product.category}
                  </span>

                  <h3>{product.name}</h3>
                  <p>{product.description}</p>

                  <div className="employee-store-product-stock">
                    <Package size={14} />
                    {product.stock} available
                  </div>

                  <div className="employee-store-product-bottom">
                    <strong>
                      {money(product.price, product.currency)}
                    </strong>

                    <button
                      type="button"
                      className="employee-primary-button"
                      onClick={() => addToCart(product)}
                      disabled={
                        product.stock <= 0 ||
                        (inCart && inCart.quantity >= product.stock)
                      }
                    >
                      <Plus size={16} />
                      {inCart ? "Add more" : "Add to cart"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredProducts.length && (
          <EmptyState
            icon={SearchX}
            title="No products found"
            description="Try another product name or category."
          />
        )}

        <p className="proc-note">
          Product listings are currently sample store data. The catalogue
          will be connected to the ETDOX database in the next backend update.
        </p>
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>Your shopping cart</h2>
            <p>Review your selected products before submitting an order.</p>
          </div>
          <ShoppingCart size={22} />
        </div>

        {cart.length ? (
          <>
            <div className="employee-store-cart-list">
              {cart.map((item) => (
                <div className="employee-store-cart-item" key={item.id}>
                  <div className="employee-store-cart-item-info">
                    <strong>{item.name}</strong>
                    <span>
                      {item.id} · {money(item.price, item.currency)} each
                    </span>
                  </div>

                  <div className="employee-store-quantity">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => updateCartQuantity(item.id, -1)}
                    >
                      <Minus size={15} />
                    </button>

                    <strong>{item.quantity}</strong>

                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => updateCartQuantity(item.id, 1)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <strong className="employee-store-line-total">
                    {money(item.price * item.quantity, item.currency)}
                  </strong>

                  <button
                    type="button"
                    className="employee-store-remove"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>

            <div className="employee-store-checkout">
              <label>
                Charge to budget *
                <select
                  value={checkoutBudgetId}
                  onChange={(event) =>
                    setCheckoutBudgetId(event.target.value)
                  }
                >
                  <option value="">Select budget allocation</option>
                  {budgets.map((budget, index) => (
                    <option
                      key={budgetIdOf(budget) || index}
                      value={budgetIdOf(budget)}
                    >
                      {budget.name ||
                        budget.budgetName ||
                        budget.budget_name ||
                        budgetDepartmentOf(budget)}
                      {" — Available "}
                      {money(
                        budgetAvailableOf(budget),
                        budget.currency
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <div className="employee-store-total">
                <span>Order total</span>
                <strong>{money(cartTotal)}</strong>
              </div>

              {checkoutBudgetId &&
                budgets.find(
                  (item) =>
                    String(budgetIdOf(item)) ===
                    String(checkoutBudgetId)
                ) &&
                cartTotal >
                  budgetAvailableOf(
                    budgets.find(
                      (item) =>
                        String(budgetIdOf(item)) ===
                        String(checkoutBudgetId)
                    )
                  ) && (
                  <p className="proc-inline-warning">
                    <AlertCircle size={17} />
                    Your cart total exceeds the available budget.
                  </p>
                )}

              <button
                type="button"
                className="employee-primary-button employee-store-checkout-button"
                onClick={checkoutStore}
                disabled={
                  submitting ||
                  !cart.length ||
                  !checkoutBudgetId ||
                  !budgets.some(
                    (item) =>
                      String(budgetIdOf(item)) ===
                        String(checkoutBudgetId) &&
                      cartTotal <= budgetAvailableOf(item)
                  )
                }
              >
                <Send size={17} />
                {submitting
                  ? "Submitting order..."
                  : "Place order for approval"}
              </button>

              <p className="proc-note">
                Placing this order creates a procurement request. It does
                not immediately purchase the products. Your manager and
                Finance team must complete the approval workflow.
              </p>
            </div>
          </>
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Add products from the store to create a purchase order."
          />
        )}
      </section>
    </div>
  );

  /* =======================================================
     WITHDRAW REQUEST
  ======================================================= */

  const withdrawRequest = (request) => {
    if (!canWithdrawRequest(request)) return;
    setConfirmWithdraw(request);
  };

  const confirmWithdrawRequest = async () => {
    if (!confirmWithdraw) return;

    setConfirmWithdraw(null);

    setError(
      "Withdrawal is not connected yet. Add or confirm the employee-authorized withdrawal endpoint in the backend before enabling this action."
    );
  };

  /* =======================================================
     COUNTS
  ======================================================= */

  const pendingManagerCount = useMemo(
    () =>
      requests.filter((item) =>
        MANAGER_PENDING.includes(normalizeStatus(item.status))
      ).length,
    [requests]
  );

  const managerApprovedCount = useMemo(
    () =>
      requests.filter((item) =>
        MANAGER_APPROVED.includes(normalizeStatus(item.status))
      ).length,
    [requests]
  );

  const pendingFinanceCount = useMemo(
    () =>
      requests.filter((item) =>
        FINANCE_PENDING.includes(normalizeStatus(item.status))
      ).length,
    [requests]
  );

  const financeApprovedCount = useMemo(
    () =>
      requests.filter((item) =>
        FINANCE_APPROVED.includes(normalizeStatus(item.status))
      ).length,
    [requests]
  );

  const rejectedCount = useMemo(
    () =>
      requests.filter((item) =>
        REJECTED_STATUSES.includes(normalizeStatus(item.status))
      ).length,
    [requests]
  );

  const pendingCount = pendingManagerCount + pendingFinanceCount;

  const totalRequested = useMemo(
    () =>
      requests.reduce((sum, item) => sum + requestAmountOf(item), 0),
    [requests]
  );

  const totalInvoiced = useMemo(
    () =>
      invoices.reduce(
        (sum, item) =>
          sum +
          Number(
            item.amount ??
              item.totalAmount ??
              item.total_amount ??
              0
          ),
        0
      ),
    [invoices]
  );

  /* =======================================================
     FILTER REQUESTS
  ======================================================= */

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((item) => {
      const searchableValues = [
        requestIdOf(item),
        item.requestNumber,
        item.request_number,
        requestNameOf(item),
        requestDepartmentOf(item),
        item.status,
        item.supplier,
      ];

      const matchesSearch =
        !query ||
        searchableValues.some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const normalizedStatus = normalizeStatus(item.status);

      const matchesStatus =
        statusFilter === "ALL" ||
        normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  /* =======================================================
     CSV EXPORT
  ======================================================= */

  const exportRequests = () => {
    const rows = [
      [
        "Request ID",
        "Product",
        "Quantity",
        "Amount",
        "Currency",
        "Department",
        "Status",
        "Created",
      ],
      ...filteredRequests.map((item) => [
        item.requestNumber ||
          item.request_number ||
          requestIdOf(item) ||
          "",
        requestNameOf(item),
        requestQuantityOf(item),
        requestAmountOf(item),
        item.currency || "INR",
        requestDepartmentOf(item),
        item.status || "",
        requestDateOf(item) || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "etdox-my-purchase-requests.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  };

  /* =======================================================
     REQUEST TABLE
  ======================================================= */

  const renderRequestTable = (items) => (
    <div className="proc-table-wrap">
      <table className="proc-table">
        <thead>
          <tr>
            <th>Request / Product</th>
            <th>Quantity</th>
            <th>Total</th>
            <th>Department</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => {
            const id = requestIdOf(item);
            const createdAt = requestDateOf(item);

            return (
              <tr key={id || `${requestNameOf(item)}-${index}`}>
                <td>
                  <strong>{requestNameOf(item)}</strong>
                  <small>
                    {item.requestNumber ||
                      item.request_number ||
                      id ||
                      "—"}
                  </small>
                </td>
                <td>{requestQuantityOf(item) || "—"}</td>
                <td>
                  {money(requestAmountOf(item), item.currency || "INR")}
                </td>
                <td>{requestDepartmentOf(item)}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>{formatDate(createdAt)}</td>
              </tr>
            );
          })}

          {!items.length && (
            <tr>
              <td colSpan={6} className="proc-empty">
                No purchase requests found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  /* =======================================================
     OVERVIEW
  ======================================================= */

  const renderOverview = () => (
    <>
      <section className="employee-welcome-banner">
        <div className="employee-welcome-copy">
          <span className="employee-eyebrow">
            ETDOX PROCUREMENT WORKSPACE
          </span>

          <h2>
            Welcome,{" "}
            {employee?.name ||
              employee?.firstName ||
              employee?.first_name ||
              "Employee"}
            !
          </h2>

          <p>
            Create purchase requests, check budgets, and track approval
            progress from one workspace.
          </p>

          <button
            className="employee-primary-button"
            onClick={() => navigateTo("Order Products")}
          >
            <ShoppingCart size={17} />
            Browse product store
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="employee-welcome-graphic">
          <Package size={64} strokeWidth={1.25} />
        </div>
      </section>

      <section className="employee-stats-grid">
        <article className="employee-stat-card">
          <div className="employee-stat-top">
            <span>My requests</span>
            <ClipboardList size={20} />
          </div>
          <div className="employee-stat-number">{requests.length}</div>
          <div className="employee-stat-bottom">
            Purchase requests in your account
          </div>
        </article>

        <article className="employee-stat-card">
          <div className="employee-stat-top">
            <span>Awaiting approval</span>
            <Clock3 size={20} />
          </div>
          <div className="employee-stat-number">{pendingCount}</div>
          <div className="employee-stat-bottom">
            Manager: {pendingManagerCount} · Finance: {pendingFinanceCount}
          </div>
        </article>

        <article className="employee-stat-card">
          <div className="employee-stat-top">
            <span>Approved by Finance</span>
            <CheckCircle2 size={20} />
          </div>
          <div className="employee-stat-number">
            {financeApprovedCount}
          </div>
          <div className="employee-stat-bottom">
            Final approvals and completed requests
          </div>
        </article>

        <article className="employee-stat-card">
          <div className="employee-stat-top">
            <span>Total requested</span>
            <Wallet size={20} />
          </div>
          <div className="employee-stat-number proc-total-number">
            {money(totalRequested)}
          </div>
          <div className="employee-stat-bottom">
            Total value of your requests
          </div>
        </article>
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>Approval summary</h2>
            <p>Current status of your purchase requests.</p>
          </div>
          <ClipboardList size={22} />
        </div>

        <div className="proc-invoice-summary">
          <div>
            <span>Waiting for manager</span>
            <strong>{pendingManagerCount}</strong>
          </div>
          <div>
            <span>Approved by manager</span>
            <strong>{managerApprovedCount}</strong>
          </div>
          <div>
            <span>Waiting for Finance</span>
            <strong>{pendingFinanceCount}</strong>
          </div>
          <div>
            <span>Rejected</span>
            <strong>{rejectedCount}</strong>
          </div>
        </div>
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>Recent purchase requests</h2>
            <p>Latest requests and their current approval status.</p>
          </div>

          <button
            className="proc-refresh"
            onClick={() => loadDashboard()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {requests.length ? (
          renderRequestTable(requests.slice(0, 5))
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No requests yet"
            description="Browse the product store or create a custom purchase request."
          />
        )}

        <button
          className="employee-secondary-button"
          onClick={() => navigateTo("My Requests")}
        >
          View all requests
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>Budget snapshot</h2>
            <p>Current budget allocation and available funds.</p>
          </div>

          <button
            className="employee-text-button"
            onClick={() => navigateTo("Budgets")}
          >
            View budgets <ChevronRight size={15} />
          </button>
        </div>

        {budgets.length ? (
          <div className="proc-budget-grid">
            {budgets.slice(0, 3).map((budget, index) => {
              const allocated = budgetAllocatedOf(budget);
              const available = budgetAvailableOf(budget);
              const used =
                budgetSpentOf(budget) +
                budgetCommittedOf(budget) +
                budgetReservedOf(budget);

              const percent =
                allocated > 0
                  ? Math.min(100, (used / allocated) * 100)
                  : 0;

              return (
                <article
                  className="proc-budget-card"
                  key={budgetIdOf(budget) || index}
                >
                  <span>{budgetDepartmentOf(budget)}</span>
                  <h3>{money(allocated, budget.currency)}</h3>
                  <p>Allocated funds</p>

                  <div className="proc-budget-bar">
                    <span style={{ width: `${percent}%` }} />
                  </div>

                  <div className="proc-budget-row">
                    <span>Used / reserved</span>
                    <strong>{percent.toFixed(1)}%</strong>
                  </div>

                  <div className="proc-budget-row">
                    <span>Available</span>
                    <strong>
                      {money(available, budget.currency)}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Wallet}
            title="No budget data"
            description="No budget records were returned by the budget API."
          />
        )}
      </section>
    </>
  );

  /* =======================================================
     CUSTOM ORDER FORM
  ======================================================= */

  const renderOrderForm = () => {
    const selectedBudget = budgets.find(
      (item) => String(budgetIdOf(item)) === String(form.budgetId)
    );

    const quantity = Number(form.quantity || 0);
    const unitPrice = Number(form.unitPrice || 0);
    const total = quantity * unitPrice;

    const available = selectedBudget
      ? budgetAvailableOf(selectedBudget)
      : null;

    const exceedsBudget =
      Boolean(selectedBudget) && total > available;

    return (
      <>
        <section className="employee-content-card proc-card">
          <div className="employee-section-heading">
            <div>
              <h2>Product Store</h2>
              <p>Choose from available workplace products.</p>
            </div>

            <button
              className="employee-primary-button"
              onClick={() => {
                setError("");
                setSuccess("");
                setStoreSearch("");
                setStoreCategory("All");
              }}
            >
              <ShoppingBag size={17} />
              Browse products below
            </button>
          </div>

          {renderStore()}
        </section>

        <section className="employee-content-card proc-card">
          <div className="employee-section-heading">
            <div>
              <h2>Custom purchase request</h2>
              <p>Request a product that is not listed in the store.</p>
            </div>
            <ShoppingCart size={22} />
          </div>

          <form className="proc-form" onSubmit={submitRequest}>
            <div className="proc-form-grid">
              <label>
                Product name *
                <input
                  name="productName"
                  value={form.productName}
                  onChange={updateField}
                  placeholder="e.g. Special office equipment"
                  maxLength={160}
                  required
                />
              </label>

              <label>
                Supplier / vendor
                <input
                  name="supplier"
                  value={form.supplier}
                  onChange={updateField}
                  placeholder="Vendor name (optional)"
                  maxLength={160}
                />
              </label>

              <label>
                Quantity *
                <input
                  type="number"
                  name="quantity"
                  value={form.quantity}
                  onChange={updateField}
                  min="1"
                  step="1"
                  required
                />
              </label>

              <label>
                Unit price ({form.currency}) *
                <input
                  type="number"
                  name="unitPrice"
                  value={form.unitPrice}
                  onChange={updateField}
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>

              <label>
                Budget allocation
                <select
                  name="budgetId"
                  value={form.budgetId}
                  onChange={updateField}
                >
                  <option value="">No specific allocation</option>

                  {budgets.map((budget, index) => (
                    <option
                      key={budgetIdOf(budget) || index}
                      value={budgetIdOf(budget)}
                    >
                      {budget.name ||
                        budget.budgetName ||
                        budget.budget_name ||
                        budgetDepartmentOf(budget)}
                      {" — Available "}
                      {money(
                        budgetAvailableOf(budget),
                        budget.currency
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label className="proc-full-field">
                Product description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  rows={3}
                  maxLength={2000}
                  placeholder="Specifications, model, features, or requirements."
                />
              </label>

              <label className="proc-full-field">
                Business justification *
                <textarea
                  name="justification"
                  value={form.justification}
                  onChange={updateField}
                  rows={3}
                  maxLength={2000}
                  placeholder="Explain why this product is needed for your work."
                  required
                />
              </label>
            </div>

            <div className="proc-estimate">
              <div>
                <span>Estimated request total</span>
                <strong>{money(total, form.currency)}</strong>
              </div>

              <div>
                <span>Available allocation</span>
                <strong>
                  {selectedBudget
                    ? money(available, selectedBudget.currency)
                    : "Not assigned"}
                </strong>
              </div>
            </div>

            {exceedsBudget && (
              <p className="proc-inline-warning">
                <AlertCircle size={17} />
                The request exceeds the selected budget's available amount.
              </p>
            )}

            <button
              className="employee-primary-button"
              type="submit"
              disabled={
                submitting ||
                exceedsBudget ||
                !form.productName.trim() ||
                !form.justification.trim()
              }
            >
              <Send size={17} />
              {submitting
                ? "Creating and submitting..."
                : "Submit for approval"}
            </button>
          </form>
        </section>
      </>
    );
  };

  /* =======================================================
     MY REQUESTS
  ======================================================= */

  const renderRequests = () => (
    <section className="employee-content-card proc-card">
      <div className="employee-section-heading">
        <div>
          <h2>My purchase requests</h2>
          <p>
            Follow manager and Finance approvals for each purchase request.
          </p>
        </div>

        <div className="proc-action-group">
          <button
            className="proc-refresh"
            onClick={exportRequests}
            disabled={!filteredRequests.length}
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            className="proc-refresh"
            onClick={() => loadDashboard()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="proc-filter-row">
        <label className="proc-search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search request, product, department..."
          />
        </label>

        <select
          className="proc-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="SUBMITTED">Waiting for manager</option>
          <option value="PENDING_MANAGER">Pending manager</option>
          <option value="MANAGER_APPROVED">Approved by manager</option>
          <option value="PENDING_FINANCE">Waiting for Finance</option>
          <option value="FINANCE_APPROVED">Approved by Finance</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED_MANAGER">Rejected by manager</option>
          <option value="REJECTED_FINANCE">Rejected by Finance</option>
        </select>
      </div>

      <div className="request-approval-list">
        {filteredRequests.map((item, index) => {
          const id = requestIdOf(item);
          const withdrawAllowed = canWithdrawRequest(item);

          return (
            <article
              className="request-approval-card"
              key={id || index}
            >
              <div className="request-approval-top">
                <div className="request-product-icon">
                  <Package size={22} />
                </div>

                <div className="request-product-info">
                  <h3>{requestNameOf(item)}</h3>
                  <span>
                    Request ID:{" "}
                    {item.requestNumber ||
                      item.request_number ||
                      id ||
                      "—"}
                  </span>
                </div>

                <StatusBadge status={item.status} />
              </div>

              <div className="request-approval-meta">
                <div>
                  <span>Quantity</span>
                  <strong>{requestQuantityOf(item) || "—"}</strong>
                </div>

                <div>
                  <span>Request amount</span>
                  <strong>
                    {money(
                      requestAmountOf(item),
                      item.currency || "INR"
                    )}
                  </strong>
                </div>

                <div>
                  <span>Department</span>
                  <strong>{requestDepartmentOf(item)}</strong>
                </div>

                <div>
                  <span>Submitted</span>
                  <strong>{formatDate(requestDateOf(item))}</strong>
                </div>
              </div>

              <ApprovalTimeline request={item} />

              {withdrawAllowed && (
                <div className="request-card-actions">
                  <button
                    className="proc-withdraw-button"
                    type="button"
                    disabled
                    title="Backend withdrawal endpoint must be connected first"
                    onClick={() => withdrawRequest(item)}
                  >
                    <Trash2 size={15} />
                    Withdraw request
                  </button>

                  <span>
                    Withdrawal becomes available after backend support
                    is connected.
                  </span>
                </div>
              )}
            </article>
          );
        })}

        {!filteredRequests.length && (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase requests found"
            description="Try changing your search or status filter, or create a new request."
          />
        )}
      </div>

      <div className="proc-approval-explainer">
        <h3>How the approval process works</h3>

        <div className="proc-approval-steps">
          <div>
            <span>01</span>
            <strong>Employee submission</strong>
            <p>Your purchase request is submitted to your manager.</p>
          </div>

          <div>
            <span>02</span>
            <strong>Manager review</strong>
            <p>Your manager approves or rejects the request.</p>
          </div>

          <div>
            <span>03</span>
            <strong>Finance review</strong>
            <p>Manager-approved requests move to Finance.</p>
          </div>

          <div>
            <span>04</span>
            <strong>Final decision</strong>
            <p>Finance completes the final approval decision.</p>
          </div>
        </div>
      </div>
    </section>
  );

  /* =======================================================
     BUDGETS
  ======================================================= */

  const renderBudgets = () => (
    <section className="employee-content-card proc-card">
      <div className="employee-section-heading">
        <div>
          <h2>Department budgets</h2>
          <p>Review allocated, committed, spent, and available funds.</p>
        </div>
        <Wallet size={22} />
      </div>

      <div className="proc-budget-grid">
        {budgets.map((budget, index) => {
          const allocated = budgetAllocatedOf(budget);
          const available = budgetAvailableOf(budget);
          const spent = budgetSpentOf(budget);
          const committed = budgetCommittedOf(budget);
          const reserved = budgetReservedOf(budget);

          const percent =
            allocated > 0
              ? Math.min(
                  100,
                  ((spent + committed + reserved) / allocated) * 100
                )
              : 0;

          return (
            <article
              className="proc-budget-card"
              key={budgetIdOf(budget) || index}
            >
              <div className="proc-budget-card-top">
                <span className="proc-budget-icon">
                  <Building2 size={18} />
                </span>
                <StatusBadge status={budget.status || "ACTIVE"} />
              </div>

              <span>{budgetDepartmentOf(budget)}</span>
              <h3>{money(allocated, budget.currency)}</h3>
              <p>Allocated budget</p>

              <div className="proc-budget-bar">
                <span style={{ width: `${percent}%` }} />
              </div>

              <div className="proc-budget-row">
                <span>Utilization</span>
                <strong>{percent.toFixed(1)}%</strong>
              </div>

              <div className="proc-budget-row">
                <span>Reserved</span>
                <strong>{money(reserved, budget.currency)}</strong>
              </div>

              <div className="proc-budget-row">
                <span>Committed</span>
                <strong>{money(committed, budget.currency)}</strong>
              </div>

              <div className="proc-budget-row">
                <span>Spent</span>
                <strong>{money(spent, budget.currency)}</strong>
              </div>

              <div className="proc-budget-row">
                <span>Available</span>
                <strong>{money(available, budget.currency)}</strong>
              </div>
            </article>
          );
        })}
      </div>

      {!budgets.length && (
        <EmptyState
          icon={Wallet}
          title="No budgets available"
          description="The backend did not return any budget records."
        />
      )}

      <p className="proc-note">
        Budget values are loaded from the backend. Only authorized
        Finance users can change allocations.
      </p>
    </section>
  );

  /* =======================================================
     INVOICE DOWNLOAD + FRONTEND-ONLY DEMO PAYMENT
     These actions intentionally do not call or modify the backend.
  ======================================================= */

  const invoiceIdOf = (invoice, index = 0) =>
    String(
      invoice?.id ||
      invoice?.invoiceId ||
      invoice?.invoice_id ||
      invoice?.invoiceNumber ||
      invoice?.invoice_number ||
      `invoice-${index}`
    );

  const invoiceAmountOf = (invoice) =>
    Number(
      invoice?.amount ??
      invoice?.totalAmount ??
      invoice?.total_amount ??
      invoice?.total ??
      0
    );

  const invoicePaidOf = (invoice, index = 0) => {
    const id = invoiceIdOf(invoice, index);
    const backendPaid = Number(invoice?.paidAmount ?? invoice?.paid_amount ?? 0);
    const demoPaid = Number(demoPayments[id]?.paidAmount || 0);
    return Math.min(invoiceAmountOf(invoice), Math.max(backendPaid, demoPaid));
  };

  const invoiceStatusOf = (invoice, index = 0) => {
    const amount = invoiceAmountOf(invoice);
    const paid = invoicePaidOf(invoice, index);
    if (amount > 0 && paid >= amount) return "PAID";
    if (paid > 0) return "PARTIALLY_PAID";
    return (
      invoice.paymentStatus ||
      invoice.payment_status ||
      invoice.status ||
      "UNPAID"
    );
  };

  const downloadInvoice = (invoice, index) => {
    const amount = invoiceAmountOf(invoice);
    const paid = invoicePaidOf(invoice, index);
    const currency = invoice.currency || "INR";
    const number =
      invoice.invoiceNumber ||
      invoice.invoice_number ||
      invoice.number ||
      invoiceIdOf(invoice, index);
    const invoiceDate = formatDate(
      invoice.invoiceDate || invoice.invoice_date || invoice.createdAt || invoice.created_at
    );
    const dueDate = formatDate(invoice.dueDate || invoice.due_date);
    const product =
      invoice.productName ||
      invoice.product_name ||
      invoice.description ||
      invoice.requestId ||
      invoice.request_id ||
      "Procurement purchase";
    const safe = (value) =>
      String(value ?? "—").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[char]));

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ETDOX Invoice ${safe(number)}</title>
<style>
  *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:36px;background:#f4f6fa}
  .sheet{max-width:820px;margin:0 auto;background:#fff;padding:48px;border:1px solid #e4e8ef}
  .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #1d4ed8;padding-bottom:24px}
  .brand{font-size:26px;font-weight:800;letter-spacing:2px;color:#1d4ed8}.muted{color:#64748b}
  h1{font-size:30px;margin:24px 0 8px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:26px 0}
  .meta div{padding:14px;background:#f8fafc;border:1px solid #e8edf4;border-radius:8px}
  table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;padding:14px;border-bottom:1px solid #e8edf4}
  th{background:#f8fafc;font-size:12px;text-transform:uppercase;color:#64748b}
  .totals{margin-left:auto;max-width:340px}.totals div{display:flex;justify-content:space-between;padding:9px 0}
  .grand{font-size:19px;font-weight:800;border-top:2px solid #1d4ed8;margin-top:8px;padding-top:14px!important}
  .stamp{display:inline-block;padding:7px 12px;border-radius:30px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:12px}
  .foot{margin-top:44px;padding-top:18px;border-top:1px solid #e8edf4;font-size:12px;color:#64748b}
  @media print{body{padding:0;background:#fff}.sheet{border:0;max-width:none;padding:24px}}
</style>
</head>
<body><main class="sheet">
  <div class="top"><div><div class="brand">ETDOX</div><div class="muted">PROCUREMENT WORKSPACE</div></div><div style="text-align:right"><strong>INVOICE</strong><div class="muted">Invoice #${safe(number)}</div><div class="stamp">${safe(invoiceStatusOf(invoice, index))}</div></div></div>
  <h1>Purchase invoice</h1><p class="muted">Generated from the employee invoice view.</p>
  <div class="meta"><div><small class="muted">Invoice date</small><br><strong>${safe(invoiceDate)}</strong></div><div><small class="muted">Due date</small><br><strong>${safe(dueDate)}</strong></div><div><small class="muted">Employee</small><br><strong>${safe(employee?.name || employee?.firstName || employee?.email || "Employee")}</strong></div><div><small class="muted">Invoice reference</small><br><strong>${safe(invoice.id || invoice.invoice_id || number)}</strong></div></div>
  <table><thead><tr><th>Description</th><th>Request reference</th><th>Amount</th></tr></thead><tbody><tr><td>${safe(product)}</td><td>${safe(invoice.requestNumber || invoice.request_number || invoice.requestId || invoice.request_id || "—")}</td><td>${safe(money(amount, currency))}</td></tr></tbody></table>
  <section class="totals"><div><span>Invoice total</span><strong>${safe(money(amount, currency))}</strong></div><div><span>Paid</span><strong>${safe(money(paid, currency))}</strong></div><div><span>Outstanding</span><strong>${safe(money(Math.max(0, amount-paid), currency))}</strong></div><div class="grand"><span>Balance due</span><strong>${safe(money(Math.max(0, amount-paid), currency))}</strong></div></section>
  <div class="foot">This is a printable copy of invoice information returned to the employee workspace. Payment demo entries are browser-local and are not proof of a real payment.</div>
</main><script>window.onload=()=>window.print();</script></body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ETDOX-Invoice-${String(number).replace(/[^a-z0-9_-]/gi, "_")}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const runDemoPayment = (invoice, index) => {
    const id = invoiceIdOf(invoice, index);
    const amount = invoiceAmountOf(invoice);
    const alreadyPaid = invoicePaidOf(invoice, index);
    const outstanding = Math.max(0, amount - alreadyPaid);

    if (!outstanding) {
      setSuccess("This invoice is already marked as paid.");
      return;
    }

    const accepted = window.confirm(
      `DEMO PAYMENT ONLY\n\nSimulate payment of ${money(outstanding, invoice.currency || "INR")} for invoice ${invoice.invoiceNumber || invoice.invoice_number || id}?\n\nNo real money will be charged and no backend payment record will be created.`
    );
    if (!accepted) return;

    const transactionId = `DEMO-${Date.now().toString(36).toUpperCase()}`;
    const next = {
      ...demoPayments,
      [id]: {
        paidAmount: amount,
        transactionId,
        paidAt: new Date().toISOString(),
        mode: "DEMO",
      },
    };

    setDemoPayments(next);
    try {
      localStorage.setItem("etdox_demo_invoice_payments", JSON.stringify(next));
    } catch (storageError) {
      console.warn("[ETDOX] Could not persist demo payment in this browser:", storageError);
    }
    setSuccess(
      `Demo payment recorded locally for invoice ${invoice.invoiceNumber || invoice.invoice_number || id}. Transaction: ${transactionId}. This is not a real payment.`
    );
  };

  const filteredInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    return invoices.filter((invoice, index) => {
      const searchable = [
        invoice.invoiceNumber,
        invoice.invoice_number,
        invoice.number,
        invoice.id,
        invoice.productName,
        invoice.product_name,
        invoice.requestId,
        invoice.request_id,
        invoice.supplier,
        invoice.vendor,
      ];
      const matchesSearch =
        !query ||
        searchable.some((value) => String(value || "").toLowerCase().includes(query));
      const status = normalizeStatus(invoiceStatusOf(invoice, index));
      const matchesStatus =
        invoiceStatusFilter === "ALL" ||
        (invoiceStatusFilter === "OUTSTANDING"
          ? ["UNPAID", "PARTIALLY_PAID", "PENDING"].includes(status)
          : status === invoiceStatusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [invoices, invoiceSearch, invoiceStatusFilter, demoPayments]);

  /* =======================================================
     INVOICES
  ======================================================= */

  const renderInvoices = () => {
    const paidTotal = invoices.reduce(
      (sum, invoice, index) => sum + invoicePaidOf(invoice, index),
      0
    );
    const outstandingTotal = invoices.reduce(
      (sum, invoice, index) =>
        sum + Math.max(0, invoiceAmountOf(invoice) - invoicePaidOf(invoice, index)),
      0
    );

    return (
      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>My invoices</h2>
            <p>Review invoice details, download printable copies, and test the demo payment flow.</p>
          </div>
          <Receipt size={22} />
        </div>

        <div className="proc-invoice-summary">
          <div>
            <span>Total invoices</span>
            <strong>{invoices.length}</strong>
          </div>
          <div>
            <span>Total invoiced</span>
            <strong>{money(totalInvoiced)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>{money(paidTotal)}</strong>
          </div>
          <div>
            <span>Outstanding</span>
            <strong>{money(outstandingTotal)}</strong>
          </div>
        </div>

        <div className="proc-invoice-demo-notice">
          <span className="proc-invoice-demo-icon"><CreditCard size={18} /></span>
          <div>
            <strong>Demo payment mode</strong>
            <p>Payment simulation is stored only in this browser. It does not charge a card, contact a payment gateway, or update the procurement backend.</p>
          </div>
          <span className="proc-demo-pill">LOCAL DEMO</span>
        </div>

        <div className="proc-filter-row proc-invoice-filters">
          <label className="proc-search-box">
            <Search size={17} />
            <input
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder="Search invoice, request, supplier..."
            />
          </label>
          <label className="proc-invoice-status-select">
            <Filter size={16} />
            <select
              value={invoiceStatusFilter}
              onChange={(event) => setInvoiceStatusFilter(event.target.value)}
              aria-label="Filter invoices by payment status"
            >
              <option value="ALL">All invoices</option>
              <option value="OUTSTANDING">Outstanding</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
        </div>

        <div className="proc-table-wrap">
          <table className="proc-table proc-invoice-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Product / Request</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => {
                const index = invoices.indexOf(invoice);
                const amount = invoiceAmountOf(invoice);
                const paid = invoicePaidOf(invoice, index);
                const outstanding = Math.max(0, amount - paid);
                const status = invoiceStatusOf(invoice, index);
                const id = invoiceIdOf(invoice, index);
                const demoPayment = demoPayments[id];

                return (
                  <tr key={id}>
                    <td>
                      <strong>
                        {invoice.invoiceNumber ||
                          invoice.invoice_number ||
                          invoice.number ||
                          "—"}
                      </strong>
                      <small>{invoice.id || invoice.invoice_id || "—"}</small>
                      {demoPayment?.transactionId && (
                        <small className="proc-demo-transaction">
                          Demo ref: {demoPayment.transactionId}
                        </small>
                      )}
                    </td>
                    <td>
                      <strong>{invoice.productName || invoice.product_name || invoice.requestId || invoice.request_id || "—"}</strong>
                      <small>{invoice.supplier || invoice.vendor || invoice.requestNumber || invoice.request_number || ""}</small>
                    </td>
                    <td>{money(amount, invoice.currency)}</td>
                    <td>{money(paid, invoice.currency)}</td>
                    <td>{money(outstanding, invoice.currency)}</td>
                    <td><StatusBadge status={status} /></td>
                    <td>
                      <div className="proc-invoice-actions">
                        <button
                          type="button"
                          className="proc-invoice-download"
                          onClick={() => downloadInvoice(invoice, index)}
                          title="Download printable invoice"
                        >
                          <FileDown size={15} />
                          Download
                        </button>
                        <button
                          type="button"
                          className="proc-invoice-pay"
                          onClick={() => runDemoPayment(invoice, index)}
                          disabled={outstanding <= 0}
                          title="Simulate a local demo payment; no real charge"
                        >
                          {outstanding <= 0 ? <Check size={15} /> : <CreditCard size={15} />}
                          {outstanding <= 0 ? "Paid" : "Pay (Demo)"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredInvoices.length && (
                <tr>
                  <td colSpan={7} className="proc-empty">
                    {invoices.length
                      ? "No invoices match your search or status filter."
                      : "No invoices are available yet. Invoices appear here when Finance or Procurement makes them available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="proc-invoice-footer-note">
          <History size={16} />
          <span>Backend invoice data remains authoritative. Local demo payment records can be cleared by clearing this browser's site data.</span>
        </div>
      </section>
    );
  };

  /* =======================================================
     PROFILE
  ======================================================= */

  const renderProfile = () => {
    const fullName =
      employee?.name ||
      [
        employee?.firstName || employee?.first_name,
        employee?.lastName || employee?.last_name,
      ]
        .filter(Boolean)
        .join(" ") ||
      "Employee";

    const department =
      typeof employee?.department === "object"
        ? employee.department?.name ||
          employee.department?.label ||
          "—"
        : employee?.department ||
          employee?.departmentName ||
          employee?.department_name ||
          "—";

    const role =
      employee?.role ||
      employee?.roles?.[0]?.name ||
      employee?.roles?.[0] ||
      "employee";

    return (
      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>Employee information</h2>
            <p>Your authenticated account details.</p>
          </div>
          <UserRound size={22} />
        </div>

        <div className="proc-profile-hero">
          <div className="employee-avatar employee-avatar-large">
            {fullName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div>
            <h3>{fullName}</h3>
            <p>{role}</p>
          </div>
        </div>

        <div className="proc-profile-grid">
          <div>
            <span>Full name</span>
            <strong>{fullName}</strong>
          </div>

          <div>
            <span>Email address</span>
            <strong>{employee?.email || "—"}</strong>
          </div>

          <div>
            <span>Account ID</span>
            <strong>
              {employee?.id ||
                employee?.userId ||
                employee?.user_id ||
                "—"}
            </strong>
          </div>

          <div>
            <span>Role</span>
            <strong>{role}</strong>
          </div>

          <div>
            <span>Department</span>
            <strong>{department}</strong>
          </div>

          <div>
            <span>Account status</span>
            <strong>{employee?.status || "Active session"}</strong>
          </div>
        </div>
      </section>
    );
  };

  /* =======================================================
     PAGE CONTENT
  ======================================================= */

  const pageHeading = {
    Overview: "Employee Overview",
    "Order Products": "Product Store & Purchase Requests",
    "My Requests": "My Purchase Requests",
    Budgets: "Department Budgets",
    Invoices: "My Invoices",
    "My Profile": "My Profile",
  }[activePage];

  const renderContent = () => {
    switch (activePage) {
      case "Order Products":
        return renderOrderForm();

      case "My Requests":
        return renderRequests();

      case "Budgets":
        return renderBudgets();

      case "Invoices":
        return renderInvoices();

      case "My Profile":
        return renderProfile();

      default:
        return renderOverview();
    }
  };

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="employee-dashboard">
      {mobileMenuOpen && (
        <button
          className="employee-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`employee-sidebar ${
          mobileMenuOpen ? "employee-sidebar-open" : ""
        }`}
      >
        <div className="employee-brand">
          <div className="employee-brand-mark">E</div>

          <div className="employee-brand-copy">
            <strong>ETDOX</strong>
            <span>PROCUREMENT</span>
          </div>

          <button
            className="employee-close-menu"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <div className="employee-sidebar-label">
          EMPLOYEE WORKSPACE
        </div>

        <nav className="employee-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`employee-nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => navigateTo(item.label)}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "My Requests" && pendingCount > 0 && (
                  <span className="employee-nav-count">
                    {pendingCount}
                  </span>
                )}

                {item.label === "Order Products" && cartCount > 0 && (
                  <span className="employee-nav-count">
                    {cartCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="employee-sidebar-bottom">
          <div className="employee-help-card">
            <strong>Need approval support?</strong>
            <p>
              Contact your manager or Finance team if a request is delayed.
            </p>
          </div>

          <button
            className="employee-logout-button"
            onClick={logout}
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      <main className="employee-main">
        <header className="employee-topbar">
          <div className="employee-topbar-left">
            <button
              className="employee-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div>
              <div className="employee-breadcrumb">
                ETDOX <span>/</span> {activePage}
              </div>
              <h1>{pageHeading}</h1>
            </div>
          </div>

          <div className="employee-topbar-actions">
            <div className="employee-last-updated">
              <CalendarDays size={14} />
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Not synced"}
            </div>

            <button
              className="proc-refresh"
              onClick={() => loadDashboard()}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "proc-spin" : ""}
              />
              Refresh
            </button>

            <div className="employee-header-profile">
              <div className="employee-avatar">
                {(
                  employee?.name ||
                  employee?.firstName ||
                  employee?.first_name ||
                  "E"
                )
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="employee-header-profile-text">
                <strong>
                  {employee?.name ||
                    employee?.firstName ||
                    employee?.first_name ||
                    "Employee"}
                </strong>
                <span>
                  {employee?.role ||
                    employee?.roles?.[0]?.name ||
                    "employee"}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="employee-page-content">
          {error && (
            <div className="proc-alert proc-alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div className="proc-alert proc-alert-success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
              <button
                onClick={() => setSuccess("")}
                aria-label="Dismiss success"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {loading ? (
            <section className="employee-content-card proc-card employee-loading">
              <span className="employee-loader" />
              <strong>Loading your ETDOX workspace...</strong>
              <p>Connecting to the procurement API.</p>
            </section>
          ) : (
            renderContent()
          )}
        </div>

        <footer className="employee-footer">
          <span>
            © {new Date().getFullYear()} ETDOX Technologies
          </span>
          <span>Employee Procurement Workspace</span>
        </footer>
      </main>

      {confirmWithdraw && (
        <div className="proc-modal-backdrop">
          <div
            className="proc-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
          >
            <span className="proc-modal-icon">
              <AlertCircle size={24} />
            </span>

            <h2 id="withdraw-title">
              Withdraw purchase request?
            </h2>

            <p>
              This will request cancellation of{" "}
              <strong>{requestNameOf(confirmWithdraw)}</strong>. Approval
              history should remain available for audit purposes.
            </p>

            <div className="proc-modal-actions">
              <button
                className="proc-modal-cancel"
                onClick={() => setConfirmWithdraw(null)}
              >
                Keep request
              </button>

              <button
                className="proc-modal-confirm"
                onClick={confirmWithdrawRequest}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
