import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  Users,
  Truck,
  Wallet,
  FileCheck,
  BarChart3,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Eye,
  Check,
  XCircle,
  Clock3,
  TrendingUp,
  Package,
  Building2,
  CalendarDays,
  ArrowUpRight,
  ShieldCheck,
  LogOut,
  Settings,
  CircleHelp,
  RefreshCw,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import "./ProcurementManagerPage.css";

// ---------------------------------------------------------
// API CONFIGURATION
// ---------------------------------------------------------

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken");

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();

  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error(
      "Unable to connect to the ETDOX backend. Check that the backend server is running."
    );
  }

  const contentType = response.headers.get("content-type") || "";

  let result;

  try {
    result = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null
        ? result.message || result.error
        : result;

    if (response.status === 401) {
      throw new Error("Session expired. Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error(
        message || "You do not have permission to access this resource."
      );
    }

    if (response.status === 404) {
      throw new Error(
        message || `The API endpoint ${endpoint} was not found.`
      );
    }

    throw new Error(
      message || `Request failed with status ${response.status}.`
    );
  }

  if (
    result &&
    typeof result === "object" &&
    result.success === false
  ) {
    throw new Error(result.message || "The backend request failed.");
  }

  return result;
};

// ---------------------------------------------------------
// RESPONSE NORMALIZERS
// ---------------------------------------------------------

const extractRecords = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  if (Array.isArray(response?.data?.results)) {
    return response.data.results;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  if (Array.isArray(response?.data?.data?.items)) {
    return response.data.data.items;
  }

  return [];
};

const extractObject = (response) =>
  response?.data?.data ||
  response?.data ||
  response ||
  {};

const firstValue = (object, keys, fallback = "") => {
  for (const key of keys) {
    const value = object?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return fallback;
};

const toNumber = (value) => {
  if (typeof value === "string") {
    value = value.replace(/[₹,\s]/g, "");
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (amount, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(toNumber(amount));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (value, fallback = "Pending") => {
  if (!value) return fallback;

  const status = String(value)
    .replace(/[_-]/g, " ")
    .trim()
    .toLowerCase();

  const statusMap = {
    submitted: "Pending",
    pending: "Pending",
    "pending approval": "Pending",
    "awaiting approval": "Pending",
    "pending approval request": "Pending",

    "under review": "Under Review",
    "in review": "Under Review",
    reviewing: "Under Review",

    approved: "Approved",
    rejected: "Rejected",
    declined: "Rejected",

    issued: "Issued",
    acknowledged: "Acknowledged",
    delivered: "Delivered",
    received: "Delivered",
    "in transit": "In Transit",

    cancelled: "Cancelled",
    canceled: "Cancelled",

    paid: "Paid",
    unpaid: "Unpaid",
    overdue: "Overdue",
    matched: "Matched",
    "partially paid": "Partially Paid",

    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    draft: "Draft",
    closed: "Closed",
    exception: "Exception",
  };

  return (
    statusMap[status] ||
    status.replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
};

const getStatusClass = (status) =>
  String(status || "pending")
    .toLowerCase()
    .replace(/\s+/g, "-");

const getPriority = (item) => {
  const value = String(
    firstValue(
      item,
      ["priority", "urgency", "requestPriority"],
      "Medium"
    )
  ).toLowerCase();

  if (value.includes("high") || value.includes("urgent")) {
    return "High";
  }

  if (value.includes("low")) {
    return "Low";
  }

  return "Medium";
};

const getNestedName = (value) => {
  if (typeof value === "string") return value;

  if (value && typeof value === "object") {
    return firstValue(value, ["name", "fullName", "companyName"], "—");
  }

  return "—";
};

// ---------------------------------------------------------
// DATA NORMALIZERS
// ---------------------------------------------------------

const normalizeApproval = (item) => ({
  ...item,

  apiId: firstValue(
    item,
    ["id", "requestId", "purchaseRequestId"]
  ),

  id: firstValue(
    item,
    [
      "requestNumber",
      "requestNo",
      "prNumber",
      "referenceNumber",
      "code",
    ],
    firstValue(item, ["id"], "Unknown request")
  ),

  title: firstValue(
    item,
    [
      "title",
      "productName",
      "itemName",
      "description",
      "name",
    ],
    "Purchase request"
  ),

  requester: firstValue(
    item,
    [
      "requesterName",
      "requestedByName",
      "employeeName",
      "createdByName",
    ],
    getNestedName(item.requestedBy)
  ),

  department: firstValue(
    item,
    ["departmentName", "department", "department_name"],
    getNestedName(item.department)
  ),

  supplier: firstValue(
    item,
    ["supplierName", "vendorName"],
    getNestedName(item.supplier)
  ),

  amount: toNumber(
    firstValue(
      item,
      [
        "totalAmount",
        "amount",
        "estimatedAmount",
        "requestedAmount",
        "total",
      ],
      0
    )
  ),

  date: formatDate(
    firstValue(
      item,
      [
        "createdAt",
        "requestDate",
        "submittedAt",
        "created_at",
      ]
    )
  ),

  priority: getPriority(item),

  status: normalizeStatus(
    firstValue(
      item,
      ["status", "approvalStatus", "requestStatus"]
    )
  ),
});

const normalizeOrder = (item) => ({
  ...item,

  apiId: firstValue(
    item,
    ["id", "purchaseOrderId"]
  ),

  id: firstValue(
    item,
    [
      "poNumber",
      "orderNumber",
      "purchaseOrderNumber",
      "referenceNumber",
      "code",
    ],
    firstValue(item, ["id"], "Unknown order")
  ),

  title: firstValue(
    item,
    ["title", "description", "itemName", "productName"],
    "Purchase order"
  ),

  supplier: firstValue(
    item,
    ["supplierName", "vendorName"],
    getNestedName(item.supplier)
  ),

  department: firstValue(
    item,
    ["departmentName", "department"],
    getNestedName(item.department)
  ),

  amount: toNumber(
    firstValue(
      item,
      ["totalAmount", "amount", "grandTotal", "total"],
      0
    )
  ),

  date: formatDate(
    firstValue(
      item,
      ["createdAt", "orderDate", "issueDate", "created_at"]
    )
  ),

  delivery: formatDate(
    firstValue(
      item,
      [
        "expectedDeliveryDate",
        "deliveryDate",
        "expectedDate",
      ]
    )
  ),

  status: normalizeStatus(
    firstValue(item, ["status", "orderStatus", "poStatus"])
  ),
});

const normalizeSupplier = (item) => ({
  ...item,

  apiId: firstValue(item, ["id", "supplierId"]),

  name: firstValue(
    item,
    ["name", "supplierName", "companyName"],
    "Unnamed supplier"
  ),

  category: firstValue(
    item,
    ["category", "supplierCategory", "type"],
    "—"
  ),

  orders: toNumber(
    firstValue(
      item,
      ["totalOrders", "ordersCount", "orderCount"],
      0
    )
  ),

  spend: toNumber(
    firstValue(
      item,
      ["totalSpend", "totalAmount", "spend"],
      0
    )
  ),

  rating: firstValue(
    item,
    ["rating", "averageRating"],
    null
  ),

  status: normalizeStatus(
    firstValue(item, ["status"], "Active")
  ),
});

const normalizeBudget = (item) => ({
  ...item,

  apiId: firstValue(item, ["id", "budgetId"]),

  name: firstValue(
    item,
    [
      "name",
      "departmentName",
      "department",
      "budgetName",
    ],
    "Unnamed budget"
  ),

  department: firstValue(
    item,
    ["department", "departmentName"],
    getNestedName(item.department)
  ),

  allocated: toNumber(
    firstValue(
      item,
      [
        "allocatedAmount",
        "allocated",
        "totalAllocated",
      ],
      0
    )
  ),

  // Use the actual database "spent" value.
  // Do not treat "committed" or "reserved" as actual spend.
  spent: toNumber(
    firstValue(
      item,
      ["spentAmount", "spent", "actualSpend"],
      0
    )
  ),

  committed: toNumber(
    firstValue(item, ["committed"], 0)
  ),

  reserved: toNumber(
    firstValue(item, ["reserved"], 0)
  ),

  currency: firstValue(item, ["currency"], "INR"),

  status: normalizeStatus(
    firstValue(item, ["status"], "Active")
  ),
});

const normalizeInvoice = (item) => ({
  ...item,

  apiId: firstValue(item, ["id", "invoiceId"]),

  id: firstValue(
    item,
    [
      "invoiceNumber",
      "invoiceNo",
      "referenceNumber",
      "number",
    ],
    firstValue(item, ["id"], "Unknown invoice")
  ),

  supplier: firstValue(
    item,
    ["supplierName", "vendorName"],
    getNestedName(item.supplier)
  ),

  amount: toNumber(
    firstValue(
      item,
      [
        "totalAmount",
        "amount",
        "invoiceAmount",
        "total",
      ],
      0
    )
  ),

  date: formatDate(
    firstValue(
      item,
      [
        "invoiceDate",
        "createdAt",
        "created_at",
        "date",
      ]
    )
  ),

  dueDate: formatDate(
    firstValue(item, ["dueDate", "paymentDueDate"])
  ),

  status: normalizeStatus(
    firstValue(
      item,
      ["status", "invoiceStatus", "paymentStatus"]
    )
  ),
});

// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------

function ProcurementManagerPage() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [orderFilter, setOrderFilter] = useState("All");

  const [approvals, setApprovals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [analytics, setAnalytics] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageErrors, setPageErrors] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState("");

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [toast, setToast] = useState("");
  const [comments, setComments] = useState("");

  // -------------------------------------------------------
  // TOAST
  // -------------------------------------------------------

  const showToast = useCallback((message) => {
    setToast(message);

    window.setTimeout(() => {
      setToast((current) =>
        current === message ? "" : current
      );
    }, 3000);
  }, []);

  // -------------------------------------------------------
  // FETCH ALL MODULES
  // -------------------------------------------------------

  const fetchAllData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPageErrors([]);

      const requests = [
        {
          name: "Approvals",
          endpoint: "/approvals?page=1&limit=100",
          setter: setApprovals,
          normalize: normalizeApproval,
        },
        {
          name: "Purchase Orders",
          endpoint: "/purchase-orders?limit=100&offset=0",
          setter: setOrders,
          normalize: normalizeOrder,
        },
        {
          name: "Suppliers",
          endpoint: "/suppliers?page=1&limit=100",
          setter: setSuppliers,
          normalize: normalizeSupplier,
        },
        {
          name: "Budgets",
          endpoint: "/budgets?page=1&limit=100",
          setter: setBudgets,
          normalize: normalizeBudget,
        },
        {
          name: "Invoices",
          endpoint: "/invoices?page=1&limit=100",
          setter: setInvoices,
          normalize: normalizeInvoice,
        },
        {
          name: "Analytics",
          endpoint: "/analytics/dashboard",
          setter: setAnalytics,
          normalize: extractObject,
        },
      ];

      try {
        const results = await Promise.allSettled(
          requests.map((request) =>
            apiRequest(request.endpoint)
          )
        );

        const errors = [];

        results.forEach((result, index) => {
          const request = requests[index];

          if (result.status === "fulfilled") {
            const response = result.value;

            if (request.name === "Analytics") {
              request.setter(
                request.normalize(response)
              );
            } else {
              request.setter(
                extractRecords(response).map(
                  request.normalize
                )
              );
            }
          } else {
            errors.push({
              name: request.name,
              message:
                result.reason?.message ||
                "Unable to load data.",
            });
          }
        });

        setPageErrors(errors);

        if (isRefresh && errors.length === 0) {
          showToast("All procurement data refreshed.");
        }

        if (errors.length > 0) {
          showToast(
            `${errors.length} section(s) could not be loaded. Check the displayed errors.`
          );
        }
      } catch (error) {
        setPageErrors([
          {
            name: "Dashboard",
            message:
              error.message ||
              "Unable to load procurement dashboard.",
          },
        ]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // -------------------------------------------------------
  // DERIVED DATA
  // -------------------------------------------------------

  const pendingCount = approvals.filter((item) =>
    ["Pending", "Under Review"].includes(item.status)
  ).length;

  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const text = [
        item.id,
        item.title,
        item.requester,
        item.department,
        item.supplier,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(
        search.toLowerCase()
      );

      const matchesFilter =
        approvalFilter === "All" ||
        item.status === approvalFilter;

      return matchesSearch && matchesFilter;
    });
  }, [approvals, search, approvalFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      const text = [
        item.id,
        item.title,
        item.supplier,
        item.department,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(
        search.toLowerCase()
      );

      const matchesFilter =
        orderFilter === "All" ||
        item.status === orderFilter;

      return matchesSearch && matchesFilter;
    });
  }, [orders, search, orderFilter]);

  const totalSpend = toNumber(
    firstValue(
      analytics,
      [
        "totalSpend",
        "totalProcurementSpend",
        "total_spend",
      ],
      orders.reduce(
        (sum, item) => sum + item.amount,
        0
      )
    )
  );

  const totalRequests = toNumber(
    firstValue(
      analytics?.purchaseRequests,
      ["total", "totalRequests", "count"],
      approvals.length
    )
  );

  const activeOrders = orders.filter(
    (item) =>
      !["Delivered", "Cancelled"].includes(item.status)
  ).length;

  const totalAllocated = budgets.reduce(
    (sum, item) => sum + item.allocated,
    0
  );

  const totalBudgetSpent = budgets.reduce(
    (sum, item) => sum + item.spent,
    0
  );

  const invoicePending = invoices.filter((item) =>
    [
      "Pending",
      "Under Review",
      "Unpaid",
      "Overdue",
    ].includes(item.status)
  ).length;

  const invoiceMatched = invoices.filter((item) =>
    ["Matched", "Paid"].includes(item.status)
  ).length;

  const invoiceExceptions = invoices.filter((item) =>
    [
      "Rejected",
      "Overdue",
      "Exception",
    ].includes(item.status)
  ).length;

  // -------------------------------------------------------
  // MODAL
  // -------------------------------------------------------

  const openDetails = (item, type) => {
    setSelectedItem(item);
    setModalType(type);
    setComments("");
  };

  const closeModal = () => {
    if (actionLoading) return;

    setSelectedItem(null);
    setModalType("");
    setComments("");
  };

  // -------------------------------------------------------
  // APPROVAL ACTIONS
  // -------------------------------------------------------

  const updateApproval = async (status) => {
    if (!selectedItem?.apiId) {
      showToast(
        "The backend approval UUID is missing for this record."
      );
      return;
    }

    setActionLoading(true);

    try {
      const action =
        status === "Approved" ? "approve" : "reject";

      await apiRequest(
        `/approvals/${encodeURIComponent(
          selectedItem.apiId
        )}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ comments }),
        }
      );

      showToast(
        status === "Approved"
          ? "Purchase request approved successfully."
          : "Purchase request rejected successfully."
      );

      closeModalAfterAction();

      await fetchAllData(true);
    } catch (error) {
      showToast(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------------------------------------
  // PURCHASE ORDER ACTIONS
  // -------------------------------------------------------

  const updateOrderStatus = async (action) => {
    if (!selectedItem?.apiId) {
      showToast(
        "The purchase-order UUID is missing for this record."
      );
      return;
    }

    setActionLoading(true);

    try {
      await apiRequest(
        `/purchase-orders/${encodeURIComponent(
          selectedItem.apiId
        )}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const labels = {
        approve: "Purchase order approved.",
        issue: "Purchase order issued.",
        acknowledge: "Purchase order acknowledged.",
      };

      showToast(
        labels[action] ||
          "Purchase order updated successfully."
      );

      closeModalAfterAction();

      await fetchAllData(true);
    } catch (error) {
      showToast(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const closeModalAfterAction = () => {
    setSelectedItem(null);
    setModalType("");
    setComments("");
  };

  // -------------------------------------------------------
  // CSV EXPORT
  // -------------------------------------------------------

  const handleExport = () => {
    if (!orders.length) {
      showToast("There are no purchase orders to export.");
      return;
    }

    const rows = [
      [
        "Order ID",
        "Supplier",
        "Item",
        "Department",
        "Amount",
        "Order Date",
        "Delivery Date",
        "Status",
      ],

      ...orders.map((item) => [
        item.id,
        item.supplier,
        item.title,
        item.department,
        item.amount,
        item.date,
        item.delivery,
        item.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "etdox-procurement-orders.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Purchase orders exported.");
  };

  // -------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    window.location.href = "/login";
  };

  // -------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------

  const navigation = [
    {
      label: "WORKSPACE",
      items: [
        {
          name: "Overview",
          icon: LayoutDashboard,
        },
        {
          name: "Approvals",
          icon: ClipboardList,
          count: pendingCount,
        },
        {
          name: "Purchase Orders",
          icon: ShoppingCart,
        },
        {
          name: "Suppliers",
          icon: Truck,
        },
      ],
    },
    {
      label: "MANAGEMENT",
      items: [
        {
          name: "Budgets",
          icon: Wallet,
        },
        {
          name: "Invoices",
          icon: FileCheck,
        },
        {
          name: "Analytics",
          icon: BarChart3,
        },
      ],
    },
  ];

  const pageDescriptions = {
    Overview:
      "Monitor procurement operations across your organization.",

    Approvals:
      "Review and manage purchase requests awaiting your decision.",

    "Purchase Orders":
      "Track purchase orders and supplier deliveries.",

    Suppliers:
      "Manage supplier relationships and performance.",

    Budgets:
      "Monitor departmental budgets and spending.",

    Invoices:
      "Review invoices and procurement payment progress.",

    Analytics:
      "Analyze purchasing activity and procurement performance.",
  };

  const renderStatus = (status) => (
    <span
      className={`pm-status pm-status-${getStatusClass(status)}`}
    >
      <span className="pm-status-dot" />
      {status || "Unknown"}
    </span>
  );

  const renderLoading = () => (
    <section className="pm-panel">
      <div className="pm-placeholder">
        <RefreshCw size={30} />
        <h3>Loading procurement data...</h3>
        <p>Connecting to the ETDOX backend.</p>
      </div>
    </section>
  );

  const renderErrors = () => {
    if (!pageErrors.length) return null;

    return (
      <section
        className="pm-panel"
        style={{ marginBottom: 18 }}
      >
        <div className="pm-panel-header">
          <div>
            <h3>Some data could not be loaded</h3>
            <p>
              Check the permissions and API response for
              these sections.
            </p>
          </div>

          <button
            className="pm-outline-button"
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>

        {pageErrors.map((error) => (
          <div
            key={error.name}
            style={{
              padding: "9px 18px",
              color: "#b45309",
              fontSize: 13,
            }}
          >
            <strong>{error.name}:</strong>{" "}
            {error.message}
          </div>
        ))}
      </section>
    );
  };

  // -------------------------------------------------------
  // OVERVIEW
  // -------------------------------------------------------

  const renderOverview = () => (
    <>
      <div className="pm-welcome">
        <div>
          <span className="pm-eyebrow">
            PROCUREMENT MANAGEMENT
          </span>

          <h2>Good evening, Procurement Manager</h2>

          <p>
            Here is what's happening with your procurement
            operations today.
          </p>
        </div>

        <div className="pm-welcome-actions">
          <span className="pm-date">
            <CalendarDays size={15} />

            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>

          <button
            className="pm-primary-button"
            onClick={() => setActivePage("Approvals")}
          >
            <ClipboardList size={15} />
            Review Approvals
          </button>
        </div>
      </div>

      <div className="pm-stats-grid">
        <div className="pm-stat-card">
          <div className="pm-stat-top">
            <div className="pm-stat-icon blue">
              <ClipboardList size={20} />
            </div>

            <span className="pm-stat-change positive">
              <TrendingUp size={13} />
              Live
            </span>
          </div>

          <h3>{totalRequests}</h3>

          <p className="pm-stat-title">
            Total Purchase Requests
          </p>

          <span className="pm-stat-description">
            Retrieved from backend
          </span>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-top">
            <div className="pm-stat-icon orange">
              <Clock3 size={20} />
            </div>

            <span className="pm-stat-change negative">
              <AlertCircle size={13} />
              Attention
            </span>
          </div>

          <h3>{pendingCount}</h3>

          <p className="pm-stat-title">
            Pending Approvals
          </p>

          <span className="pm-stat-description">
            Requests requiring attention
          </span>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-top">
            <div className="pm-stat-icon purple">
              <ShoppingCart size={20} />
            </div>

            <span className="pm-stat-change positive">
              <TrendingUp size={13} />
              Live
            </span>
          </div>

          <h3>{activeOrders}</h3>

          <p className="pm-stat-title">
            Active Purchase Orders
          </p>

          <span className="pm-stat-description">
            Across available records
          </span>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-top">
            <div className="pm-stat-icon green">
              <IndianRupee size={20} />
            </div>

            <span className="pm-stat-change positive">
              <TrendingUp size={13} />
              Live
            </span>
          </div>

          <h3>{formatCurrency(totalSpend)}</h3>

          <p className="pm-stat-title">
            Total Procurement Spend
          </p>

          <span className="pm-stat-description">
            Analytics or order total
          </span>
        </div>
      </div>

      <div className="pm-overview-grid">
        <section className="pm-panel pm-spend-panel">
          <div className="pm-panel-header">
            <div>
              <h3>Procurement Spend Overview</h3>
              <p>Live procurement spending data</p>
            </div>

            <button
              className="pm-icon-button"
              onClick={() => fetchAllData(true)}
              aria-label="Refresh spend data"
              disabled={refreshing}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="pm-spend-summary">
            <div>
              <span>Total spend</span>
              <h2>{formatCurrency(totalSpend)}</h2>
            </div>

            <span className="pm-growth">
              <ArrowUpRight size={14} />
              Live
            </span>
          </div>

          <div className="pm-chart">
            {(() => {
              const trends = Array.isArray(
                analytics?.trends
              )
                ? analytics.trends
                : Array.isArray(analytics?.monthlySpend)
                  ? analytics.monthlySpend
                  : [];

              const values = trends.map((item) =>
                toNumber(
                  firstValue(
                    item,
                    [
                      "amount",
                      "spend",
                      "total",
                      "value",
                    ],
                    0
                  )
                )
              );

              const max = Math.max(...values, 1);

              const months = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];

              return values.length ? (
                values.slice(0, 12).map((value, index) => (
                  <div
                    className="pm-chart-column"
                    key={index}
                  >
                    <div
                      className="pm-chart-bar"
                      style={{
                        height: `${Math.max(
                          5,
                          (value / max) * 100
                        )}%`,
                      }}
                      title={formatCurrency(value)}
                    />

                    <span>
                      {firstValue(
                        trends[index],
                        ["month", "label", "period"],
                        months[index]
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: 20,
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  No monthly spend trend data returned
                  by the analytics API.
                </div>
              );
            })()}
          </div>
        </section>

        <section className="pm-panel pm-activity-panel">
          <div className="pm-panel-header">
            <div>
              <h3>Recent Procurement Data</h3>
              <p>Latest available records</p>
            </div>

            <button
              className="pm-icon-button"
              onClick={() => fetchAllData(true)}
              aria-label="Refresh recent data"
              disabled={refreshing}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="pm-activity-list">
            {[
              ...approvals.slice(0, 2).map((item) => ({
                icon: ClipboardList,
                color: "blue",
                title: `Purchase request ${item.status.toLowerCase()}`,
                description: `${item.id} · ${item.supplier}`,
                time: item.date,
              })),

              ...orders.slice(0, 2).map((item) => ({
                icon: ShoppingCart,
                color: "purple",
                title: `Purchase order ${item.status.toLowerCase()}`,
                description: `${item.id} · ${item.supplier}`,
                time: item.date,
              })),
            ]
              .slice(0, 4)
              .map((activity, index) => {
                const Icon = activity.icon;

                return (
                  <div
                    className="pm-activity-item"
                    key={index}
                  >
                    <div
                      className={`pm-activity-icon ${activity.color}`}
                    >
                      <Icon size={16} />
                    </div>

                    <div>
                      <strong>{activity.title}</strong>
                      <p>{activity.description}</p>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                );
              })}

            {!approvals.length && !orders.length && (
              <p style={{ padding: 16 }}>
                No recent records available.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="pm-panel">
        <div className="pm-panel-header">
          <div>
            <h3>Pending Approval Requests</h3>
            <p>
              Purchase requests that need your attention
            </p>
          </div>

          <button
            className="pm-text-button"
            onClick={() => setActivePage("Approvals")}
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>REQUEST ID</th>
                <th>REQUEST DETAILS</th>
                <th>REQUESTER</th>
                <th>DEPARTMENT</th>
                <th>AMOUNT</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {approvals
                .filter((item) =>
                  ["Pending", "Under Review"].includes(
                    item.status
                  )
                )
                .slice(0, 5)
                .map((item) => (
                  <tr key={item.apiId || item.id}>
                    <td className="pm-id">{item.id}</td>

                    <td>
                      <strong className="pm-cell-title">
                        {item.title}
                      </strong>

                      <span className="pm-cell-subtitle">
                        {item.supplier}
                      </span>
                    </td>

                    <td>{item.requester}</td>
                    <td>{item.department}</td>

                    <td className="pm-amount">
                      {formatCurrency(item.amount)}
                    </td>

                    <td>
                      <span
                        className={`pm-priority pm-priority-${item.priority.toLowerCase()}`}
                      >
                        {item.priority}
                      </span>
                    </td>

                    <td>{renderStatus(item.status)}</td>

                    <td>
                      <button
                        className="pm-icon-button"
                        onClick={() =>
                          openDetails(item, "approval")
                        }
                        aria-label={`View ${item.id}`}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}

              {!approvals.length && (
                <tr>
                  <td className="pm-empty" colSpan="8">
                    No approval records returned by the
                    backend.
                  </td>
                </tr>
              )}

              {approvals.length > 0 && pendingCount === 0 && (
                <tr>
                  <td className="pm-empty" colSpan="8">
                    No pending approval requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  // -------------------------------------------------------
  // APPROVALS
  // -------------------------------------------------------

  const renderApprovals = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Approval Management</h3>
          <p>
            Review purchase requests and make approval
            decisions.
          </p>
        </div>

        <span className="pm-count">
          {pendingCount} pending
        </span>
      </div>

      <div className="pm-toolbar">
        <div className="pm-search pm-table-search">
          <Search size={15} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search requests, suppliers or departments..."
          />
        </div>

        <div className="pm-toolbar-actions">
          <select
            className="pm-filter"
            value={approvalFilter}
            onChange={(event) =>
              setApprovalFilter(event.target.value)
            }
          >
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button
            className="pm-outline-button"
            onClick={() => {
              setSearch("");
              setApprovalFilter("All");
            }}
          >
            <Filter size={14} />
            Clear filters
          </button>
        </div>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th>REQUEST ID</th>
              <th>REQUEST DETAILS</th>
              <th>REQUESTER</th>
              <th>DEPARTMENT</th>
              <th>AMOUNT</th>
              <th>DATE</th>
              <th>PRIORITY</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>

          <tbody>
            {filteredApprovals.length ? (
              filteredApprovals.map((item) => (
                <tr key={item.apiId || item.id}>
                  <td className="pm-id">{item.id}</td>

                  <td>
                    <strong className="pm-cell-title">
                      {item.title}
                    </strong>

                    <span className="pm-cell-subtitle">
                      {item.supplier}
                    </span>
                  </td>

                  <td>{item.requester}</td>
                  <td>{item.department}</td>

                  <td className="pm-amount">
                    {formatCurrency(item.amount)}
                  </td>

                  <td>{item.date}</td>

                  <td>
                    <span
                      className={`pm-priority pm-priority-${item.priority.toLowerCase()}`}
                    >
                      {item.priority}
                    </span>
                  </td>

                  <td>{renderStatus(item.status)}</td>

                  <td>
                    <button
                      className="pm-icon-button"
                      onClick={() =>
                        openDetails(item, "approval")
                      }
                      aria-label="View request"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="pm-empty" colSpan="9">
                  No purchase requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  // -------------------------------------------------------
  // PURCHASE ORDERS
  // -------------------------------------------------------

  const renderOrders = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Purchase Order Management</h3>
          <p>
            Monitor order progress and supplier deliveries.
          </p>
        </div>

        <button
          className="pm-outline-button"
          onClick={handleExport}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="pm-toolbar">
        <div className="pm-search pm-table-search">
          <Search size={15} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search purchase orders..."
          />
        </div>

        <div className="pm-toolbar-actions">
          <select
            className="pm-filter"
            value={orderFilter}
            onChange={(event) =>
              setOrderFilter(event.target.value)
            }
          >
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Issued">Issued</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th>ORDER ID</th>
              <th>ITEM</th>
              <th>SUPPLIER</th>
              <th>DEPARTMENT</th>
              <th>AMOUNT</th>
              <th>ORDER DATE</th>
              <th>EXPECTED DELIVERY</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.length ? (
              filteredOrders.map((item) => (
                <tr key={item.apiId || item.id}>
                  <td className="pm-id">{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.supplier}</td>
                  <td>{item.department}</td>

                  <td className="pm-amount">
                    {formatCurrency(item.amount)}
                  </td>

                  <td>{item.date}</td>
                  <td>{item.delivery}</td>
                  <td>{renderStatus(item.status)}</td>

                  <td>
                    <button
                      className="pm-icon-button"
                      onClick={() =>
                        openDetails(item, "order")
                      }
                      aria-label="View order"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="pm-empty" colSpan="9">
                  No purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  // -------------------------------------------------------
  // SUPPLIERS
  // -------------------------------------------------------

  const renderSuppliers = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Supplier Management</h3>
          <p>
            Review supplier information and performance.
          </p>
        </div>

        <span className="pm-count">
          {suppliers.length} suppliers
        </span>
      </div>

      <div className="pm-toolbar">
        <div className="pm-search pm-table-search">
          <Search size={15} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search suppliers..."
          />
        </div>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th>SUPPLIER</th>
              <th>CATEGORY</th>
              <th>TOTAL ORDERS</th>
              <th>TOTAL SPEND</th>
              <th>RATING</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            {suppliers
              .filter((supplier) =>
                `${supplier.name} ${supplier.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase())
              )
              .map((supplier) => (
                <tr
                  key={supplier.apiId || supplier.name}
                >
                  <td>
                    <div className="pm-supplier-name">
                      <span className="pm-supplier-avatar">
                        {supplier.name.charAt(0)}
                      </span>

                      <strong>{supplier.name}</strong>
                    </div>
                  </td>

                  <td>{supplier.category}</td>
                  <td>{supplier.orders}</td>

                  <td className="pm-amount">
                    {formatCurrency(supplier.spend)}
                  </td>

                  <td>
                    <span className="pm-rating">
                      {supplier.rating !== null
                        ? `★ ${supplier.rating}`
                        : "—"}
                    </span>
                  </td>

                  <td>{renderStatus(supplier.status)}</td>
                </tr>
              ))}

            {!suppliers.length && (
              <tr>
                <td className="pm-empty" colSpan="6">
                  No suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  // -------------------------------------------------------
  // BUDGETS
  // -------------------------------------------------------

  const renderBudgets = () => (
    <>
      <div
        className="pm-panel"
        style={{ marginBottom: 18 }}
      >
        <div className="pm-panel-header">
          <div>
            <h3>Budget Summary</h3>
            <p>
              Live allocated and spent amounts from the
              budgets API.
            </p>
          </div>

          <span className="pm-count">
            {budgets.length} budgets
          </span>
        </div>

        <div className="pm-invoice-summary">
          <div>
            <span>Total allocated</span>
            <strong>
              {formatCurrency(totalAllocated)}
            </strong>
          </div>

          <div>
            <span>Total spent</span>
            <strong>
              {formatCurrency(totalBudgetSpent)}
            </strong>
          </div>

          <div>
            <span>Remaining</span>
            <strong>
              {formatCurrency(
                totalAllocated - totalBudgetSpent
              )}
            </strong>
          </div>

          <div>
            <span>Utilization</span>
            <strong>
              {totalAllocated
                ? `${Math.round(
                    (totalBudgetSpent / totalAllocated) *
                      100
                  )}%`
                : "—"}
            </strong>
          </div>
        </div>
      </div>

      <div className="pm-budget-grid">
        {budgets.map((budget, index) => {
          const percentage = budget.allocated
            ? Math.min(
                100,
                Math.round(
                  (budget.spent / budget.allocated) * 100
                )
              )
            : 0;

          const colors = [
            "blue",
            "purple",
            "orange",
            "green",
          ];

          const color = colors[index % colors.length];

          return (
            <section
              className="pm-panel pm-budget-card"
              key={
                budget.apiId ||
                `${budget.name}-${index}`
              }
            >
              <div className="pm-budget-heading">
                <div
                  className={`pm-budget-icon ${color}`}
                >
                  <Wallet size={19} />
                </div>

                <span className="pm-budget-percent">
                  {percentage}% used
                </span>
              </div>

              <h3>{budget.name}</h3>

              <p>
                {budget.department} · {budget.status}
              </p>

              <div className="pm-budget-values">
                <strong>
                  {formatCurrency(
                    budget.spent,
                    budget.currency
                  )}
                </strong>

                <span>
                  of{" "}
                  {formatCurrency(
                    budget.allocated,
                    budget.currency
                  )}
                </span>
              </div>

              <div className="pm-progress-track">
                <div
                  className={`pm-progress-fill ${color}`}
                  style={{
                    width: `${percentage}%`,
                  }}
                />
              </div>

              <span className="pm-budget-remaining">
                {formatCurrency(
                  budget.allocated - budget.spent,
                  budget.currency
                )}{" "}
                remaining
              </span>
            </section>
          );
        })}
      </div>

      {!budgets.length && (
        <section className="pm-panel">
          <div className="pm-placeholder">
            <Wallet size={32} />
            <h3>No budgets available</h3>
            <p>
              The budgets API returned no records for
              your account.
            </p>
          </div>
        </section>
      )}
    </>
  );

  // -------------------------------------------------------
  // INVOICES
  // -------------------------------------------------------

  const renderInvoices = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Invoice Overview</h3>
          <p>
            Live invoice processing and payment progress.
          </p>
        </div>

        <span className="pm-count">
          {invoices.length} invoices
        </span>
      </div>

      <div className="pm-invoice-summary">
        <div>
          <span>Total invoices</span>
          <strong>{invoices.length}</strong>
        </div>

        <div>
          <span>Awaiting review</span>
          <strong>{invoicePending}</strong>
        </div>

        <div>
          <span>Matched / paid</span>
          <strong>{invoiceMatched}</strong>
        </div>

        <div>
          <span>Exceptions</span>
          <strong>{invoiceExceptions}</strong>
        </div>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th>INVOICE ID</th>
              <th>SUPPLIER</th>
              <th>INVOICE DATE</th>
              <th>DUE DATE</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            {invoices.length ? (
              invoices.map((invoice) => (
                <tr
                  key={invoice.apiId || invoice.id}
                >
                  <td className="pm-id">
                    {invoice.id}
                  </td>

                  <td>{invoice.supplier}</td>
                  <td>{invoice.date}</td>
                  <td>{invoice.dueDate}</td>

                  <td className="pm-amount">
                    {formatCurrency(invoice.amount)}
                  </td>

                  <td>{renderStatus(invoice.status)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="pm-empty" colSpan="6">
                  No invoices returned by the backend.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  // -------------------------------------------------------
  // ANALYTICS
  // -------------------------------------------------------

  const renderAnalytics = () => {
    const purchaseAnalytics =
      analytics?.purchaseRequests || {};

    const invoiceAnalytics =
      analytics?.invoices || {};

    const budgetAnalytics =
      analytics?.budgetSummary || {};

    const analyticsSpend = toNumber(
      firstValue(
        analytics,
        [
          "totalSpend",
          "totalProcurementSpend",
          "total_spend",
        ],
        totalSpend
      )
    );

    const analyticsRequests = toNumber(
      firstValue(
        purchaseAnalytics,
        ["total", "totalRequests", "count"],
        totalRequests
      )
    );

    const analyticsInvoices = toNumber(
      firstValue(
        invoiceAnalytics,
        ["total", "totalInvoices", "count"],
        invoices.length
      )
    );

    const analyticsBudget = toNumber(
      firstValue(
        budgetAnalytics,
        [
          "totalAllocated",
          "allocatedAmount",
          "total",
        ],
        totalAllocated
      )
    );

    return (
      <>
        <div className="pm-stats-grid">
          <div className="pm-stat-card">
            <div className="pm-stat-icon blue">
              <IndianRupee size={20} />
            </div>

            <h3>{formatCurrency(analyticsSpend)}</h3>

            <p className="pm-stat-title">
              Total Spend
            </p>

            <span className="pm-stat-description">
              From analytics API
            </span>
          </div>

          <div className="pm-stat-card">
            <div className="pm-stat-icon green">
              <ClipboardList size={20} />
            </div>

            <h3>{analyticsRequests}</h3>

            <p className="pm-stat-title">
              Purchase Requests
            </p>

            <span className="pm-stat-description">
              Analytics summary
            </span>
          </div>

          <div className="pm-stat-card">
            <div className="pm-stat-icon purple">
              <FileCheck size={20} />
            </div>

            <h3>{analyticsInvoices}</h3>

            <p className="pm-stat-title">
              Invoices
            </p>

            <span className="pm-stat-description">
              Analytics summary
            </span>
          </div>

          <div className="pm-stat-card">
            <div className="pm-stat-icon orange">
              <Wallet size={20} />
            </div>

            <h3>
              {formatCurrency(analyticsBudget)}
            </h3>

            <p className="pm-stat-title">
              Budget Allocation
            </p>

            <span className="pm-stat-description">
              Analytics summary
            </span>
          </div>
        </div>

        <section className="pm-panel">
          <div className="pm-panel-header">
            <div>
              <h3>Procurement Performance</h3>
              <p>
                Analytics information returned by your
                backend.
              </p>
            </div>

            <button
              className="pm-outline-button"
              onClick={() => fetchAllData(true)}
              disabled={refreshing}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>METRIC</th>
                  <th>VALUE</th>
                </tr>
              </thead>

              <tbody>
                {[
                  [
                    "Total spend",
                    formatCurrency(analyticsSpend),
                  ],
                  [
                    "Total purchase requests",
                    analyticsRequests,
                  ],
                  [
                    "Total invoices",
                    analyticsInvoices,
                  ],
                  [
                    "Total budget allocation",
                    formatCurrency(analyticsBudget),
                  ],
                  [
                    "Total suppliers loaded",
                    suppliers.length,
                  ],
                  [
                    "Total purchase orders loaded",
                    orders.length,
                  ],
                  [
                    "Pending approvals loaded",
                    pendingCount,
                  ],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="pm-amount">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  };

  // -------------------------------------------------------
  // PAGE CONTENT
  // -------------------------------------------------------

  const renderPageContent = () => {
    if (loading) {
      return renderLoading();
    }

    switch (activePage) {
      case "Overview":
        return renderOverview();

      case "Approvals":
        return renderApprovals();

      case "Purchase Orders":
        return renderOrders();

      case "Suppliers":
        return renderSuppliers();

      case "Budgets":
        return renderBudgets();

      case "Invoices":
        return renderInvoices();

      case "Analytics":
        return renderAnalytics();

      default:
        return renderOverview();
    }
  };

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  return (
    <div className="pm-layout">
      {sidebarOpen && (
        <button
          className="pm-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`pm-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="pm-brand">
          <div className="pm-brand-mark">
            <Building2 size={22} />
          </div>

          <div>
            <h2>ETDOX</h2>
            <span>TECHNOLOGIES</span>
          </div>

          <button
            className="pm-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="pm-workspace">
          <div className="pm-workspace-icon">
            <Building2 size={17} />
          </div>

          <div>
            <strong>ETDOX Technologies</strong>
            <span>Enterprise Workspace</span>
          </div>

          <ChevronDown size={15} />
        </div>

        {navigation.map((group) => (
          <div
            className="pm-nav-group"
            key={group.label}
          >
            <p className="pm-nav-label">
              {group.label}
            </p>

            <nav className="pm-navigation">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.name}
                    className={`pm-nav-item ${
                      activePage === item.name
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setActivePage(item.name);
                      setSearch("");
                      setSidebarOpen(false);
                    }}
                  >
                    <Icon size={18} />

                    <span>{item.name}</span>

                    {item.count > 0 && (
                      <span className="pm-nav-count">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="pm-sidebar-bottom">
          <div className="pm-sidebar-help">
            <div className="pm-help-icon">
              <CircleHelp size={18} />
            </div>

            <strong>Need assistance?</strong>

            <p>
              Contact your platform administrator for
              support.
            </p>

            <button
              onClick={() =>
                showToast(
                  "Support contact is not configured."
                )
              }
            >
              Get support <ArrowUpRight size={13} />
            </button>
          </div>

          <button
            className="pm-logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="pm-main">
        <header className="pm-topbar">
          <div className="pm-topbar-left">
            <button
              className="pm-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="pm-breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="pm-topbar-right">
            <div className="pm-search pm-global-search">
              <Search size={15} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search anything..."
              />

              <kbd>⌘ K</kbd>
            </div>

            <button
              className="pm-top-icon"
              onClick={() => {
                setNotificationOpen(!notificationOpen);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
            >
              <Bell size={19} />

              {pendingCount > 0 && (
                <span className="pm-notification-dot" />
              )}
            </button>

            {notificationOpen && (
              <div className="pm-dropdown pm-notification-dropdown">
                <h4>Notifications</h4>

                <div className="pm-notification-item">
                  <AlertCircle size={17} />

                  <div>
                    <strong>
                      {pendingCount} approval(s) pending
                    </strong>

                    <span>
                      Review requests awaiting your decision.
                    </span>
                  </div>
                </div>

                <div className="pm-notification-item">
                  <Package size={17} />

                  <div>
                    <strong>
                      {activeOrders} active purchase orders
                    </strong>

                    <span>
                      Check the purchase order section for
                      updates.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pm-profile-wrapper">
              <button
                className="pm-profile-button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationOpen(false);
                }}
              >
                <div className="pm-avatar">PM</div>

                <div className="pm-profile-info">
                  <strong>Procurement Manager</strong>
                  <span>Procurement Team</span>
                </div>

                <ChevronDown size={15} />
              </button>

              {profileOpen && (
                <div className="pm-dropdown pm-profile-dropdown">
                  <button
                    onClick={() =>
                      showToast(
                        "Profile page is not connected."
                      )
                    }
                  >
                    <Users size={15} />
                    My Profile
                  </button>

                  <button
                    onClick={() =>
                      showToast(
                        "Settings are not connected."
                      )
                    }
                  >
                    <Settings size={15} />
                    Settings
                  </button>

                  <button onClick={handleLogout}>
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="pm-content">
          <div className="pm-page-heading">
            <div>
              <h1>{activePage}</h1>
              <p>{pageDescriptions[activePage]}</p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {activePage !== "Overview" && (
                <span className="pm-page-role">
                  <ShieldCheck size={14} />
                  Procurement Manager
                </span>
              )}

              <button
                className="pm-icon-button"
                onClick={() => fetchAllData(true)}
                disabled={refreshing}
                aria-label="Refresh all data"
                title="Refresh all backend data"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing ? "pm-spin" : ""
                  }
                />
              </button>
            </div>
          </div>

          {renderErrors()}
          {renderPageContent()}

          <footer className="pm-footer">
            <span>
              © 2026 ETDOX Technologies. All rights
              reserved.
            </span>

            <span>
              Enterprise Procurement Platform · v1.0
            </span>
          </footer>
        </div>
      </main>

      {/* ---------------------------------------------------
          DETAILS MODAL
      --------------------------------------------------- */}

      {selectedItem && (
        <div
          className="pm-modal-overlay"
          onClick={closeModal}
        >
          <section
            className="pm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pm-modal-header">
              <div>
                <span className="pm-eyebrow">
                  {modalType === "approval"
                    ? "PURCHASE REQUEST"
                    : "PURCHASE ORDER"}
                </span>

                <h2>{selectedItem.id}</h2>

                <p>
                  Review the procurement record details.
                </p>
              </div>

              <button
                className="pm-icon-button"
                onClick={closeModal}
                aria-label="Close dialog"
                disabled={actionLoading}
              >
                <X size={19} />
              </button>
            </div>

            <div className="pm-detail-list">
              <div>
                <span>Item / Description</span>
                <strong>{selectedItem.title}</strong>
              </div>

              {selectedItem.requester && (
                <div>
                  <span>Requester</span>
                  <strong>
                    {selectedItem.requester}
                  </strong>
                </div>
              )}

              <div>
                <span>Supplier</span>
                <strong>{selectedItem.supplier}</strong>
              </div>

              <div>
                <span>Department</span>
                <strong>
                  {selectedItem.department}
                </strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>
                  {formatCurrency(selectedItem.amount)}
                </strong>
              </div>

              <div>
                <span>Status</span>
                {renderStatus(selectedItem.status)}
              </div>

              {selectedItem.priority && (
                <div>
                  <span>Priority</span>
                  <strong>
                    {selectedItem.priority}
                  </strong>
                </div>
              )}

              {selectedItem.delivery && (
                <div>
                  <span>Expected delivery</span>
                  <strong>
                    {selectedItem.delivery}
                  </strong>
                </div>
              )}

              {selectedItem.date && (
                <div>
                  <span>Date</span>
                  <strong>{selectedItem.date}</strong>
                </div>
              )}
            </div>

            {modalType === "approval" &&
              ["Pending", "Under Review"].includes(
                selectedItem.status
              ) && (
                <div style={{ marginTop: 18 }}>
                  <label
                    htmlFor="approval-comments"
                    style={{
                      display: "block",
                      fontSize: 13,
                      marginBottom: 7,
                      fontWeight: 600,
                    }}
                  >
                    Decision comments (optional)
                  </label>

                  <textarea
                    id="approval-comments"
                    className="pm-filter"
                    value={comments}
                    onChange={(event) =>
                      setComments(event.target.value)
                    }
                    placeholder="Add comments for this approval decision..."
                    maxLength={2000}
                    rows={3}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      padding: 10,
                    }}
                  />
                </div>
              )}

            <div className="pm-modal-actions">
              {modalType === "approval" &&
                ["Pending", "Under Review"].includes(
                  selectedItem.status
                ) && (
                  <>
                    <button
                      className="pm-danger-button"
                      onClick={() =>
                        updateApproval("Rejected")
                      }
                      disabled={actionLoading}
                    >
                      <XCircle size={15} />

                      {actionLoading
                        ? "Processing..."
                        : "Reject"}
                    </button>

                    <button
                      className="pm-primary-button"
                      onClick={() =>
                        updateApproval("Approved")
                      }
                      disabled={actionLoading}
                    >
                      <Check size={15} />

                      {actionLoading
                        ? "Processing..."
                        : "Approve Request"}
                    </button>
                  </>
                )}

              {modalType === "order" && (
                <>
                  {["Pending", "Draft"].includes(
                    selectedItem.status
                  ) && (
                    <button
                      className="pm-primary-button"
                      onClick={() =>
                        updateOrderStatus("approve")
                      }
                      disabled={actionLoading}
                    >
                      <Check size={15} />
                      Approve Order
                    </button>
                  )}

                  {selectedItem.status === "Approved" && (
                    <button
                      className="pm-primary-button"
                      onClick={() =>
                        updateOrderStatus("issue")
                      }
                      disabled={actionLoading}
                    >
                      <Check size={15} />
                      Issue Order
                    </button>
                  )}

                  {selectedItem.status === "Issued" && (
                    <button
                      className="pm-primary-button"
                      onClick={() =>
                        updateOrderStatus("acknowledge")
                      }
                      disabled={actionLoading}
                    >
                      <Check size={15} />
                      Acknowledge Order
                    </button>
                  )}
                </>
              )}

              <button
                className="pm-outline-button"
                onClick={closeModal}
                disabled={actionLoading}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="pm-toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default ProcurementManagerPage;