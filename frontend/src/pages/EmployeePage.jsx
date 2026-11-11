
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
} from "lucide-react";

import "./EmployeePage.css";

/* =========================================================
   API CONFIGURATION
========================================================= */

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
)
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "")
  .replace(/\/api$/, "");

const API_ROOT = `${API_ORIGIN}/api/v1`;
const REFRESH_INTERVAL = 15000;

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Order Products", icon: ShoppingCart },
  { label: "My Requests", icon: ClipboardList },
  { label: "Budgets", icon: Wallet },
  { label: "Invoices", icon: Receipt },
  { label: "My Profile", icon: UserRound },
];

/* =========================================================
   GENERAL HELPERS
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
    return `₹${Number.isFinite(amount) ? amount.toLocaleString("en-IN") : "0"}`;
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

  if (typeof department === "string") {
    return department;
  }

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

/* =========================================================
   API RESPONSE HELPERS
========================================================= */

const unwrapArray = (response, preferredKeys = []) => {
  const keys = [
    ...preferredKeys,
    "requests",
    "budgets",
    "invoices",
    "items",
    "records",
    "results",
    "data",
  ];

  let current = response;

  for (let depth = 0; depth < 8; depth += 1) {
    if (Array.isArray(current)) {
      return current;
    }

    if (!current || typeof current !== "object") {
      return [];
    }

    let found = false;

    for (const key of keys) {
      if (Array.isArray(current[key])) {
        return current[key];
      }
    }

    for (const key of [
      "data",
      "result",
      "payload",
      "response",
    ]) {
      if (
        current[key] &&
        typeof current[key] === "object"
      ) {
        current = current[key];
        found = true;
        break;
      }
    }

    if (!found) {
      return [];
    }
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

  if (directId) {
    return directId;
  }

  for (const key of [
    "request",
    "data",
    "result",
    "payload",
    "procurement",
  ]) {
    if (object[key] && typeof object[key] === "object") {
      const id = findRequestId(object[key], depth + 1);

      if (id) {
        return id;
      }
    }
  }

  return null;
};

const getRequestError = (result, fallback) => {
  const details =
    result?.details ||
    result?.errors ||
    result?.issues;

  if (Array.isArray(details)) {
    const messages = details
      .map((item) =>
        item?.message ||
        item?.msg ||
        item?.path?.join?.(".")
      )
      .filter(Boolean);

    if (messages.length) {
      return messages.join("; ");
    }
  }

  if (details && typeof details === "object") {
    return Object.entries(details)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");
  }

  return (
    result?.message ||
    result?.error ||
    result?.detail ||
    fallback
  );
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

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);

  return (
    <span className={`proc-status proc-status-${getStatusClass(normalized)}`}>
      {STATUS_LABELS[normalized] || normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ icon: Icon = ClipboardList, title, description }) {
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

/* =========================================================
   EMPLOYEE PAGE
========================================================= */

export default function EmployeePage() {
  const [activePage, setActivePage] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [employee, setEmployee] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [lastUpdated, setLastUpdated] = useState(null);

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
     LOGOUT
  ======================================================= */

  const logout = useCallback(() => {
    [
      "token",
      "accessToken",
      "authToken",
      "user",
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
        throw new Error(
          "Login token not found. Please log in again."
        );
      }

      const headers = new Headers(options.headers || {});

      headers.set("Accept", "application/json");
      headers.set("Authorization", `Bearer ${token}`);

      if (
        options.body &&
        !(options.body instanceof FormData)
      ) {
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

      const contentType =
        response.headers.get("content-type") || "";

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

        throw new Error(
          "Your login session expired. Please log in again."
        );
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
        throw new Error(
          getRequestError(result, "API operation failed.")
        );
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
     LOAD REAL DATABASE DATA
  ======================================================= */

  const loadDashboard = useCallback(
    async (quiet = false) => {
      if (refreshLock.current) {
        return;
      }

      refreshLock.current = true;

      if (!quiet && mounted.current) {
        setLoading(true);
      }

      try {
        const results = await Promise.allSettled([
          tryEndpoints([
            "/procurement/requests",
            "/procurement",
          ]),
          apiRequest("/budgets"),
          tryEndpoints([
            "/invoices",
            "/procurement/invoices",
          ]),
          apiRequest("/auth/me"),
        ]);

        if (!mounted.current) {
          return;
        }

        const [
          requestResult,
          budgetResult,
          invoiceResult,
          userResult,
        ] = results;

        const errors = [];

        /* Requests */

        if (requestResult.status === "fulfilled") {
          const loadedRequests = unwrapArray(
            requestResult.value,
            ["requests", "items"]
          );

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
            `Requests: ${requestResult.reason?.message || "Could not load requests."}`
          );
        }

        /* Budgets */

        if (budgetResult.status === "fulfilled") {
          const loadedBudgets = unwrapArray(
            budgetResult.value,
            ["budgets", "items"]
          );

          setBudgets(loadedBudgets);

          setForm((previous) => {
            const currentBudget = loadedBudgets.find(
              (item) =>
                String(budgetIdOf(item)) ===
                String(previous.budgetId)
            );

            const selectedBudget =
              currentBudget || null;

            return {
              ...previous,
              budgetId: selectedBudget
                ? String(budgetIdOf(selectedBudget))
                : previous.budgetId,
              currency:
                selectedBudget?.currency ||
                previous.currency ||
                "INR",
            };
          });
        } else {
          errors.push(
            `Budgets: ${budgetResult.reason?.message || "Could not load budgets."}`
          );
        }

        /* Invoices */

        if (invoiceResult.status === "fulfilled") {
          setInvoices(
            unwrapArray(invoiceResult.value, [
              "invoices",
              "items",
            ])
          );
        }

        /* Employee profile */

        if (userResult.status === "fulfilled") {
          setEmployee(getUser(userResult.value));
        } else {
          errors.push(
            `Profile: ${userResult.reason?.message || "Could not load profile."}`
          );
        }

        setError(errors.join(" "));
        setLastUpdated(new Date());
      } catch (err) {
        if (mounted.current) {
          setError(
            err.message || "Unable to load employee dashboard."
          );
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

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

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
        (item) =>
          String(budgetIdOf(item)) === String(value)
      );

      setForm((previous) => ({
        ...previous,
        budgetId: value,
        currency:
          selectedBudget?.currency ||
          previous.currency ||
          "INR",
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =======================================================
     CREATE AND SUBMIT REAL REQUEST
  ======================================================= */

  const submitRequest = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

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

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
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
      (item) =>
        String(budgetIdOf(item)) === String(form.budgetId)
    );

    if (
      selectedBudget &&
      total > budgetAvailableOf(selectedBudget)
    ) {
      setError(
        `Insufficient budget. Available: ${money(
          budgetAvailableOf(selectedBudget),
          selectedBudget.currency
        )}. Request total: ${money(total, form.currency)}.`
      );

      return;
    }

    const employeeDepartment =
      employee?.department &&
      typeof employee.department === "object"
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
      (selectedBudget
        ? budgetDepartmentOf(selectedBudget)
        : "");

    const description = [
      form.description.trim(),
      form.supplier.trim()
        ? `Preferred supplier: ${form.supplier.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    /*
      These fields support the procurement service's
      common input names.

      Do not send a fake employee ID or tenant ID.
      The backend must get those from authenticated req.user.
    */

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
      currency:
        selectedBudget?.currency ||
        form.currency ||
        "INR",
      department: departmentName,
      departmentName,
      ...(departmentId
        ? { departmentId }
        : {}),
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
      /* STEP 1: Save the request in PostgreSQL. */

      const createResponse = await apiRequest(
        "/procurement",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const createdRequest =
        getCreatedRequest(createResponse);

      const createdId =
        findRequestId(createResponse) ||
        requestIdOf(createdRequest);

      if (!createdId) {
        console.error(
          "[ETDOX] Create response did not contain an ID:",
          createResponse
        );

        throw new Error(
          "The server received the create request but did not return a request ID. Check the procurement controller's create response."
        );
      }

      /* STEP 2: Submit the saved request for manager approval. */

      try {
        await apiRequest(
          `/procurement/${encodeURIComponent(createdId)}/submit`,
          {
            method: "POST",
          }
        );
      } catch (submitError) {
        await loadDashboard(true);

        throw new Error(
          `Your request was saved with ID ${createdId}, but submission failed: ${submitError.message}`
        );
      }

      /* STEP 3: Clear the form. */

      setForm((previous) => ({
        ...previous,
        productName: "",
        description: "",
        supplier: "",
        quantity: "1",
        unitPrice: "",
        justification: "",
      }));

      /* STEP 4: Show success and reload real database records. */

      setSuccess(
        `Purchase request ${createdId} was successfully submitted for manager approval.`
      );

      setActivePage("My Requests");

      await loadDashboard(true);
    } catch (err) {
      console.error("[ETDOX] Purchase request error:", err);

      setError(
        err.message || "Could not create the purchase request."
      );

      await loadDashboard(true);
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================================================
     REAL REQUEST COUNTS
  ======================================================= */

  const pendingManagerCount = useMemo(
    () =>
      requests.filter((item) =>
        MANAGER_PENDING.includes(
          normalizeStatus(item.status)
        )
      ).length,
    [requests]
  );

  const managerApprovedCount = useMemo(
    () =>
      requests.filter((item) =>
        MANAGER_APPROVED.includes(
          normalizeStatus(item.status)
        )
      ).length,
    [requests]
  );

  const pendingFinanceCount = useMemo(
    () =>
      requests.filter((item) =>
        FINANCE_PENDING.includes(
          normalizeStatus(item.status)
        )
      ).length,
    [requests]
  );

  const financeApprovedCount = useMemo(
    () =>
      requests.filter((item) =>
        FINANCE_APPROVED.includes(
          normalizeStatus(item.status)
        )
      ).length,
    [requests]
  );

  const rejectedCount = useMemo(
    () =>
      requests.filter((item) =>
        REJECTED_STATUSES.includes(
          normalizeStatus(item.status)
        )
      ).length,
    [requests]
  );

  const pendingCount =
    pendingManagerCount + pendingFinanceCount;

  const totalRequested = useMemo(
    () =>
      requests.reduce(
        (sum, item) =>
          sum + requestAmountOf(item),
        0
      ),
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
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const normalizedStatus =
        normalizeStatus(item.status);

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
          .map(
            (cell) =>
              `"${String(cell ?? "").replaceAll('"', '""')}"`
          )
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
                  {money(
                    requestAmountOf(item),
                    item.currency || "INR"
                  )}
                </td>

                <td>{requestDepartmentOf(item)}</td>

                <td>
                  <StatusBadge status={item.status} />
                </td>

                <td>
                  {createdAt &&
                  !Number.isNaN(new Date(createdAt).getTime())
                    ? new Date(createdAt).toLocaleDateString("en-IN")
                    : "—"}
                </td>
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
              "Employee"}!
          </h2>

          <p>
            Create purchase requests, check budgets, and
            track approval progress from one workspace.
          </p>

          <button
            className="employee-primary-button"
            onClick={() =>
              setActivePage("Order Products")
            }
          >
            <ShoppingCart size={17} />
            Create purchase request
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
          <div className="employee-stat-number">
            {requests.length}
          </div>
          <div className="employee-stat-bottom">
            Real requests returned by the API
          </div>
        </article>

        <article className="employee-stat-card">
          <div className="employee-stat-top">
            <span>Awaiting approval</span>
            <Clock3 size={20} />
          </div>
          <div className="employee-stat-number">
            {pendingCount}
          </div>
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
            description="Create your first purchase request."
          />
        )}

        <button
          className="employee-secondary-button"
          onClick={() => setActivePage("My Requests")}
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
            onClick={() => setActivePage("Budgets")}
          >
            View budgets
            <ChevronRight size={15} />
          </button>
        </div>

        {budgets.length ? (
          <div className="proc-budget-grid">
            {budgets.slice(0, 3).map((budget, index) => {
              const allocated = budgetAllocatedOf(budget);
              const available = budgetAvailableOf(budget);

              const used =
                budgetSpentOf(budget) +
                budgetCommittedOf(budget);

              const percent =
                allocated > 0
                  ? Math.min(
                      100,
                      (used / allocated) * 100
                    )
                  : 0;

              return (
                <article
                  className="proc-budget-card"
                  key={budgetIdOf(budget) || index}
                >
                  <span>{budgetDepartmentOf(budget)}</span>

                  <h3>
                    {money(allocated, budget.currency)}
                  </h3>

                  <p>Allocated funds</p>

                  <div className="proc-budget-bar">
                    <span
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="proc-budget-row">
                    <span>Used / committed</span>
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
     ORDER PRODUCTS
  ======================================================= */

  const renderOrderForm = () => {
    const selectedBudget = budgets.find(
      (item) =>
        String(budgetIdOf(item)) === String(form.budgetId)
    );

    const quantity = Number(form.quantity || 0);
    const unitPrice = Number(form.unitPrice || 0);
    const total = quantity * unitPrice;

    const available = selectedBudget
      ? budgetAvailableOf(selectedBudget)
      : null;

    const exceedsBudget =
      Boolean(selectedBudget) &&
      total > available;

    return (
      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div>
            <h2>New purchase request</h2>
            <p>
              Enter product details and submit for approval.
            </p>
          </div>
          <ShoppingCart size={22} />
        </div>

        <form
          className="proc-form"
          onSubmit={submitRequest}
        >
          <div className="proc-form-grid">
            <label>
              Product name *
              <input
                name="productName"
                value={form.productName}
                onChange={updateField}
                placeholder="e.g. Office laptop"
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
                <option value="">
                  No specific allocation
                </option>

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
                  ? money(
                      available,
                      selectedBudget.currency
                    )
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
            Search your requests and monitor approval status.
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
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search request, product, department..."
          />
        </label>

        <select
          className="proc-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
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

      {renderRequestTable(filteredRequests)}

      <div className="proc-approval-explainer">
        <h3>Approval workflow</h3>
        <ol>
          <li>
            Employee creates and submits a purchase request.
          </li>
          <li>
            Manager reviews and approves or rejects the request.
          </li>
          <li>
            Manager-approved requests move to Finance.
          </li>
          <li>
            Finance reviews and makes the final decision.
          </li>
        </ol>
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
          <p>
            Review allocated, committed, spent, and available funds.
          </p>
        </div>
        <Wallet size={22} />
      </div>

      <div className="proc-budget-grid">
        {budgets.map((budget, index) => {
          const allocated = budgetAllocatedOf(budget);
          const available = budgetAvailableOf(budget);
          const spent = budgetSpentOf(budget);
          const committed = budgetCommittedOf(budget);

          const percent =
            allocated > 0
              ? Math.min(
                  100,
                  ((spent + committed) / allocated) * 100
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

                <StatusBadge
                  status={budget.status || "ACTIVE"}
                />
              </div>

              <span>{budgetDepartmentOf(budget)}</span>

              <h3>
                {money(allocated, budget.currency)}
              </h3>

              <p>Allocated budget</p>

              <div className="proc-budget-bar">
                <span
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="proc-budget-row">
                <span>Utilization</span>
                <strong>{percent.toFixed(1)}%</strong>
              </div>

              <div className="proc-budget-row">
                <span>Committed</span>
                <strong>
                  {money(committed, budget.currency)}
                </strong>
              </div>

              <div className="proc-budget-row">
                <span>Spent</span>
                <strong>
                  {money(spent, budget.currency)}
                </strong>
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

      {!budgets.length && (
        <EmptyState
          icon={Wallet}
          title="No budgets available"
          description="The backend did not return any budget records."
        />
      )}

      <p className="proc-note">
        Budget values are loaded from the backend.
        Only authorized Finance users can change allocations.
      </p>
    </section>
  );

  /* =======================================================
     INVOICES
  ======================================================= */

  const renderInvoices = () => (
    <section className="employee-content-card proc-card">
      <div className="employee-section-heading">
        <div>
          <h2>My invoices</h2>
          <p>
            Invoices made available for your purchase requests.
          </p>
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
      </div>

      <div className="proc-table-wrap">
        <table className="proc-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Product / Request</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice, index) => {
              const amount = Number(
                invoice.amount ??
                invoice.totalAmount ??
                invoice.total_amount ??
                0
              );

              const paid = Number(
                invoice.paidAmount ??
                invoice.paid_amount ??
                0
              );

              return (
                <tr
                  key={
                    invoice.id ||
                    invoice.invoiceNumber ||
                    index
                  }
                >
                  <td>
                    <strong>
                      {invoice.invoiceNumber ||
                        invoice.invoice_number ||
                        invoice.number ||
                        "—"}
                    </strong>
                    <small>{invoice.id || "—"}</small>
                  </td>

                  <td>
                    {invoice.productName ||
                      invoice.product_name ||
                      invoice.requestId ||
                      invoice.request_id ||
                      "—"}
                  </td>

                  <td>{money(amount, invoice.currency)}</td>
                  <td>{money(paid, invoice.currency)}</td>

                  <td>
                    {money(
                      Math.max(0, amount - paid),
                      invoice.currency
                    )}
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        invoice.paymentStatus ||
                        invoice.payment_status ||
                        invoice.status
                      }
                    />
                  </td>
                </tr>
              );
            })}

            {!invoices.length && (
              <tr>
                <td colSpan={6} className="proc-empty">
                  No invoices are available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

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
            <strong>
              {employee?.status || "Active session"}
            </strong>
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
    "Order Products": "Request a Product",
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
          mobileMenuOpen
            ? "employee-sidebar-open"
            : ""
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
                  activePage === item.label
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setActivePage(item.label);
                  setMobileMenuOpen(false);
                  setError("");
                  setSuccess("");
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "My Requests" &&
                  pendingCount > 0 && (
                    <span className="employee-nav-count">
                      {pendingCount}
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
              Contact your manager or Finance team if a
              request is delayed.
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
                ? `Updated ${lastUpdated.toLocaleTimeString(
                    "en-IN",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}`
                : "Not synced"}
            </div>

            <button
              className="proc-refresh"
              onClick={() => loadDashboard()}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "proc-spin" : ""
                }
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
            <div
              className="proc-alert proc-alert-error"
              role="alert"
            >
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
            <div
              className="proc-alert proc-alert-success"
              role="status"
            >
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
              <strong>
                Loading your ETDOX workspace...
              </strong>
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
    </div>
  );
}
