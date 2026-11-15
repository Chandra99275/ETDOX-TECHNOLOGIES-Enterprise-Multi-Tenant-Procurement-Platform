
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  PackageCheck,
  Building2,
  FileText,
  Search,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  ArrowUpRight,
  Eye,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Boxes,
  TrendingUp,
  UserCircle,
  ShieldCheck,
} from "lucide-react";

import "./ProcurementSpecialist.css";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const API_PREFIX = `${API_BASE_URL}/api/v1`;

const API_ENDPOINTS = {
  purchaseOrders: `${API_PREFIX}/purchase-orders?limit=100&offset=0`,
  purchaseRequests: `${API_PREFIX}/purchase-requests?limit=100&offset=0`,
  suppliers: `${API_PREFIX}/suppliers?limit=100&offset=0`,
  receipts: `${API_PREFIX}/receipts?limit=100&offset=0`,
  invoices: `${API_PREFIX}/invoices?limit=100&offset=0`,
  createPurchaseOrder: `${API_PREFIX}/purchase-orders`,
};

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Purchase Requests", icon: ClipboardList },
  { label: "Purchase Orders", icon: ShoppingCart },
  { label: "Suppliers", icon: Building2 },
  { label: "Goods Receipts", icon: PackageCheck },
  { label: "Invoices", icon: FileText },
];

// ============================================================
// HELPERS
// ============================================================

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken");

const getValue = (object, ...keys) => {
  for (const key of keys) {
    const value = object?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
};

const getId = (record) =>
  getValue(
    record,
    "id",
    "uuid",
    "supplier_id",
    "purchase_order_id",
    "purchase_request_id",
    "receipt_id",
    "invoice_id"
  );

const getStatus = (record) => {
  const status = getValue(record, "status", "approval_status", "state");

  return String(status || "Unknown")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getAmount = (record) =>
  Number(
    getValue(
      record,
      "total_amount",
      "totalAmount",
      "amount",
      "grand_total",
      "grandTotal",
      "estimated_amount",
      "estimatedAmount",
      "total",
      "unit_price"
    ) || 0
  );

const formatCurrency = (amount, currency = "INR") => {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "INR";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }
};

const extractRows = (response) => {
  if (Array.isArray(response)) return response;

  const candidates = [
    response?.data,
    response?.data?.rows,
    response?.data?.items,
    response?.data?.results,
    response?.data?.records,
    response?.rows,
    response?.items,
    response?.results,
    response?.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const getErrorMessage = (body, fallback) =>
  body?.message ||
  body?.error?.message ||
  (typeof body?.error === "string" ? body.error : "") ||
  body?.details ||
  fallback;

// ============================================================
// PURCHASE REQUEST LINE ITEM HELPERS
// ============================================================

const getLineItems = (record) => {
  if (!record || typeof record !== "object") return [];

  const candidates = [
    record.items,
    record.line_items,
    record.lineItems,
    record.request_items,
    record.requestItems,
    record.purchase_request_items,
    record.purchaseRequestItems,
    record.purchase_request_lines,
    record.purchaseRequestLines,
    record.lines,
    record.data?.items,
    record.data?.line_items,
    record.data?.lineItems,
    record.purchaseRequest?.items,
    record.purchaseRequest?.line_items,
    record.purchase_request?.items,
    record.purchase_request?.line_items,
    record.request?.items,
    record.request?.line_items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const hasUsableLineItems = (record) => {
  const items = getLineItems(record);

  return items.some((item) => {
    if (!item || typeof item !== "object") return false;

    return Object.keys(item).length > 0;
  });
};

const getLineItemDescription = (item) =>
  getValue(
    item,
    "description",
    "item_description",
    "item_name",
    "product_name",
    "productName",
    "name",
    "title",
    "material_name"
  ) || "Purchase item";

async function apiRequest(url, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Your login session was not found. Please sign in again.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  let body;

  try {
    body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      typeof body === "string"
        ? body
        : getErrorMessage(body, `Request failed (${response.status})`);

    throw new Error(message);
  }

  return body;
}

// ============================================================
// NORMALIZERS
// ============================================================

const normalizePurchaseOrder = (record, suppliers, requests) => {
  const supplierId = getValue(record, "supplier_id", "supplierId");

  const requestId = getValue(
    record,
    "purchase_request_id",
    "purchaseRequestId",
    "request_id"
  );

  const supplier = suppliers.find(
    (item) => String(getId(item)) === String(supplierId)
  );

  const request = requests.find(
    (item) => String(getId(item)) === String(requestId)
  );

  const items = getLineItems(record).length
    ? getLineItems(record)
    : getLineItems(request);

  const itemDescription =
    items
      .map(getLineItemDescription)
      .filter(Boolean)
      .join(", ") ||
    getValue(record, "description", "item_description", "title") ||
    getValue(request, "title", "description", "request_title") ||
    "Purchase request items";

  return {
    ...record,
    id:
      getValue(record, "po_number", "purchase_order_number", "order_number") ||
      getId(record),
    databaseId: getId(record),
    supplierId,
    requestId,
    supplier:
      getValue(record, "supplier_name") ||
      getValue(
        supplier,
        "legal_name",
        "trading_name",
        "name",
        "supplier_name",
        "company_name"
      ) ||
      "Supplier",
    item: itemDescription,
    amount: getAmount(record),
    date: getDate(
      getValue(record, "created_at", "createdAt", "issued_at", "order_date")
    ),
    status: getStatus(record),
  };
};

const normalizePurchaseRequest = (record) => {
  const items = getLineItems(record);

  const title =
    getValue(record, "title", "request_title", "description", "subject") ||
    items
      .map(getLineItemDescription)
      .filter(Boolean)
      .join(", ") ||
    "Purchase Request";

  return {
    ...record,
    items,
    lineItems: items,
    hasLineItems: hasUsableLineItems(record),
    itemCount: items.filter(
      (item) => item && typeof item === "object" && Object.keys(item).length > 0
    ).length,
    id:
      getValue(record, "request_number", "pr_number", "reference_number") ||
      getId(record),
    databaseId: getId(record),
    title,
    department:
      getValue(record, "department_name", "department", "departmentName") ||
      "—",
    requester:
      getValue(
        record,
        "requester_name",
        "requested_by_name",
        "employee_name",
        "created_by_name"
      ) || "—",
    amount: getAmount(record),
    date: getDate(
      getValue(record, "created_at", "createdAt", "submitted_at")
    ),
    status: getStatus(record),
  };
};

const normalizeSupplier = (record) => ({
  ...record,
  id:
    getValue(record, "supplier_code", "vendor_code", "code") || getId(record),
  databaseId: getId(record),
  name:
    getValue(
      record,
      "legal_name",
      "trading_name",
      "name",
      "supplier_name",
      "company_name",
      "vendor_name"
    ) || "Unnamed Supplier",
  category:
    getValue(record, "category", "supplier_category", "business_type") || "—",
  email: getValue(record, "email", "contact_email") || "—",
  status: getStatus(record),
});

const normalizeReceipt = (record, orders, suppliers) => {
  const orderId = getValue(
    record,
    "purchase_order_id",
    "purchaseOrderId",
    "order_id"
  );

  const supplierId = getValue(record, "supplier_id", "supplierId");

  const order = orders.find(
    (item) => String(item.databaseId) === String(orderId)
  );

  const supplier = suppliers.find(
    (item) => String(item.databaseId) === String(supplierId)
  );

  return {
    ...record,
    id:
      getValue(record, "receipt_number", "gr_number", "reference_number") ||
      getId(record),
    order:
      getValue(record, "po_number", "purchase_order_number") ||
      order?.id ||
      orderId ||
      "—",
    supplier:
      getValue(record, "supplier_name") || supplier?.name || "—",
    received: getDate(
      getValue(record, "received_at", "received_date", "created_at")
    ),
    items: Array.isArray(record.items)
      ? record.items.length
      : Number(getValue(record, "item_count", "items_count", "quantity") || 0),
    status: getStatus(record),
  };
};

const normalizeInvoice = (record, orders, suppliers) => {
  const orderId = getValue(
    record,
    "purchase_order_id",
    "purchaseOrderId",
    "order_id"
  );

  const supplierId = getValue(record, "supplier_id", "supplierId");

  const order = orders.find(
    (item) => String(item.databaseId) === String(orderId)
  );

  const supplier = suppliers.find(
    (item) => String(item.databaseId) === String(supplierId)
  );

  return {
    ...record,
    id:
      getValue(record, "invoice_number", "invoice_code", "reference_number") ||
      getId(record),
    supplier:
      getValue(record, "supplier_name") || supplier?.name || "—",
    order:
      getValue(record, "po_number", "purchase_order_number") ||
      order?.id ||
      orderId ||
      "—",
    amount: getAmount(record),
    date: getDate(
      getValue(record, "invoice_date", "created_at", "createdAt")
    ),
    status: getStatus(record),
  };
};

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }) {
  const normalized = String(status || "Unknown")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span className={`ps-status ps-status-${normalized}`}>
      <span className="ps-status-dot" />
      {status || "Unknown"}
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function ProcurementSpecialistPage() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [loadWarnings, setLoadWarnings] = useState([]);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [formError, setFormError] = useState("");

  const [newOrder, setNewOrder] = useState({
    purchaseRequestId: "",
    supplierId: "",
  });

  // ==========================================================
  // LOAD ORGANIZATION DATA
  // ==========================================================

  const loadData = useCallback(async (isRefresh = false) => {
    if (!getToken()) {
      setError("Your login session was not found. Please sign in again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setLoadWarnings([]);

    const endpoints = [
      ["purchase orders", API_ENDPOINTS.purchaseOrders],
      ["purchase requests", API_ENDPOINTS.purchaseRequests],
      ["suppliers", API_ENDPOINTS.suppliers],
      ["goods receipts", API_ENDPOINTS.receipts],
      ["invoices", API_ENDPOINTS.invoices],
    ];

    try {
      const results = await Promise.allSettled(
        endpoints.map(([, url]) => apiRequest(url))
      );

      const resultData = {};
      const warnings = [];

      results.forEach((result, index) => {
        const [name] = endpoints[index];

        if (result.status === "fulfilled") {
          resultData[name] = extractRows(result.value);
        } else {
          resultData[name] = [];
          warnings.push(
            `${name}: ${result.reason?.message || "Unable to load"}`
          );
        }
      });

      const rawSuppliers = resultData.suppliers || [];
      const rawRequests = resultData["purchase requests"] || [];
      const rawOrders = resultData["purchase orders"] || [];

      const normalizedSuppliers = rawSuppliers.map(normalizeSupplier);
      const normalizedRequests = rawRequests.map(normalizePurchaseRequest);

      const normalizedOrders = rawOrders.map((record) =>
        normalizePurchaseOrder(record, rawSuppliers, rawRequests)
      );

      const normalizedReceipts = (resultData["goods receipts"] || []).map(
        (record) =>
          normalizeReceipt(record, normalizedOrders, normalizedSuppliers)
      );

      const normalizedInvoices = (resultData.invoices || []).map((record) =>
        normalizeInvoice(record, normalizedOrders, normalizedSuppliers)
      );

      setSuppliers(normalizedSuppliers);
      setRequests(normalizedRequests);
      setOrders(normalizedOrders);
      setGoodsReceipts(normalizedReceipts);
      setInvoices(normalizedInvoices);
      setLoadWarnings(warnings);

      if (warnings.length === endpoints.length) {
        setError(
          "Unable to load procurement data. Check your API server, login session, and API routes."
        );
      }
    } catch (err) {
      setError(err.message || "Unable to load procurement data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================================
  // FILTERED DATA
  // ==========================================================

  const filteredOrders = useMemo(() => {
    const term = search.toLowerCase();

    return orders.filter((order) => {
      const matchesSearch = [
        order.id,
        order.supplier,
        order.item,
      ].some((value) => String(value || "").toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const filteredSuppliers = useMemo(() => {
    const term = search.toLowerCase();

    return suppliers.filter((supplier) =>
      [supplier.name, supplier.category, supplier.email].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [suppliers, search]);

  const filteredRequests = useMemo(() => {
    const term = search.toLowerCase();

    return requests.filter((request) => {
      const matchesSearch = [
        request.id,
        request.title,
        request.department,
        request.requester,
      ].some((value) => String(value || "").toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "All" || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  // Include approved requests even if their items are missing.
  // The modal can explain why such a request cannot be used.
  const approvedRequests = useMemo(
    () =>
      requests.filter(
        (request) => String(request.status).trim().toLowerCase() === "approved"
      ),
    [requests]
  );

  const eligibleApprovedRequests = useMemo(
    () => approvedRequests.filter((request) => request.hasLineItems),
    [approvedRequests]
  );

  const selectedRequest = useMemo(
    () =>
      requests.find(
        (request) =>
          String(request.databaseId) ===
          String(newOrder.purchaseRequestId)
      ),
    [requests, newOrder.purchaseRequestId]
  );

  const activeSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) => {
        const rawStatus = String(
          getValue(supplier, "status", "approval_status") || ""
        ).toLowerCase();

        const explicitlyActive =
          supplier.is_active === true ||
          supplier.isActive === true ||
          supplier.active === true;

        const explicitlyInactive =
          supplier.is_active === false ||
          supplier.isActive === false ||
          supplier.active === false;

        if (explicitlyInactive) return false;
        if (explicitlyActive) return true;

        return (
          !rawStatus ||
          rawStatus === "active" ||
          rawStatus === "approved"
        );
      }),
    [suppliers]
  );

  // ==========================================================
  // DASHBOARD STATISTICS
  // ==========================================================

  const pendingRequests = requests.filter((request) =>
    ["pending", "submitted", "under review", "in review"].includes(
      request.status.toLowerCase()
    )
  ).length;

  const receivedCount = goodsReceipts.filter((receipt) =>
    ["received", "completed", "accepted"].includes(
      receipt.status.toLowerCase()
    )
  ).length;

  const totalSpend = orders.reduce(
    (total, order) => total + Number(order.amount || 0),
    0
  );

  const stats = [
    {
      title: "Purchase Orders",
      value: orders.length,
      icon: ShoppingCart,
      color: "blue",
    },
    {
      title: "Active Suppliers",
      value: activeSuppliers.length,
      icon: Building2,
      color: "purple",
    },
    {
      title: "Pending Requests",
      value: pendingRequests,
      icon: ClipboardList,
      color: "orange",
    },
    {
      title: "Goods Received",
      value: receivedCount,
      icon: PackageCheck,
      color: "green",
    },
  ];

  const monthlySpend = useMemo(() => {
    const currentYear = new Date().getFullYear();

    const months = Array.from({ length: 12 }, (_, index) => ({
      month: new Date(currentYear, index, 1).toLocaleDateString("en-IN", {
        month: "short",
      }),
      amount: 0,
    }));

    orders.forEach((order) => {
      const sourceDate = getValue(
        order,
        "created_at",
        "createdAt",
        "issued_at",
        "order_date"
      );

      if (!sourceDate) return;

      const date = new Date(sourceDate);

      if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== currentYear
      ) {
        return;
      }

      months[date.getMonth()].amount += Number(order.amount || 0);
    });

    const maximum = Math.max(...months.map((item) => item.amount), 1);

    return months.map((item) => ({
      ...item,
      height: Math.max(4, (item.amount / maximum) * 100),
    }));
  }, [orders]);

  const recentActivity = useMemo(() => {
    const orderActivities = orders.slice(0, 3).map((order) => ({
      id: `order-${order.databaseId || order.id}`,
      title: "Purchase order",
      description: `${order.id} · ${order.supplier}`,
      date: getValue(order, "created_at", "createdAt"),
      icon: ShoppingCart,
      color: "blue",
    }));

    const requestActivities = requests.slice(0, 2).map((request) => ({
      id: `request-${request.databaseId || request.id}`,
      title: "Purchase request",
      description: `${request.id} · ${request.title}`,
      date: getValue(request, "created_at", "createdAt"),
      icon: ClipboardList,
      color: "orange",
    }));

    return [...orderActivities, ...requestActivities]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 4);
  }, [orders, requests]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const handleNavigation = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
    setSearch("");
    setStatusFilter("All");
  };

  // ==========================================================
  // CREATE PURCHASE ORDER
  // ==========================================================

  const openCreateOrderModal = () => {
    setFormError("");
    setNewOrder({
      purchaseRequestId: "",
      supplierId: "",
    });
    setShowOrderModal(true);
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!newOrder.purchaseRequestId || !newOrder.supplierId) {
      setFormError(
        "Select an approved purchase request and an active supplier."
      );
      return;
    }

    const request = requests.find(
      (item) =>
        String(item.databaseId) === String(newOrder.purchaseRequestId)
    );

    if (!request) {
      setFormError(
        "The selected purchase request could not be found. Refresh the page and try again."
      );
      return;
    }

    if (String(request.status).trim().toLowerCase() !== "approved") {
      setFormError("Only approved purchase requests can be converted to orders.");
      return;
    }

    const requestItems = getLineItems(request);

    if (!hasUsableLineItems(request)) {
      setFormError(
        "This approved purchase request has no line items. Add at least one item to the purchase request before creating a purchase order."
      );
      return;
    }

    const supplier = activeSuppliers.find(
      (item) =>
        String(item.databaseId) === String(newOrder.supplierId)
    );

    if (!supplier) {
      setFormError(
        "The selected supplier is not active or is no longer available. Refresh the page and select another supplier."
      );
      return;
    }

    setCreatingOrder(true);

    try {
      const payload = {
        purchaseRequestId: request.databaseId,
        supplierId: supplier.databaseId,
      };

      await apiRequest(API_ENDPOINTS.createPurchaseOrder, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNewOrder({
        purchaseRequestId: "",
        supplierId: "",
      });

      setShowOrderModal(false);
      setActivePage("Purchase Orders");

      await loadData(true);
    } catch (err) {
      const message = err.message || "";

      if (
        message.toLowerCase().includes("at least one line item") ||
        message.toLowerCase().includes("line item")
      ) {
        setFormError(
          "The server could not find any line items for this purchase request. The request's items must be saved in the purchase request before an order can be created."
        );
      } else {
        setFormError(message || "Unable to create purchase order.");
      }
    } finally {
      setCreatingOrder(false);
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  // ==========================================================
  // EXPORT PURCHASE ORDERS
  // ==========================================================

  const exportOrders = () => {
    const headers = [
      "Order ID",
      "Supplier",
      "Item",
      "Amount",
      "Date",
      "Status",
    ];

    const rows = filteredOrders.map((order) => [
      order.id,
      order.supplier,
      order.item,
      order.amount,
      order.date,
      order.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "etdox-purchase-orders.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  // ==========================================================
  // PURCHASE ORDERS TABLE
  // ==========================================================

  const renderOrders = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Purchase Orders</h3>
          <p>Track and manage your purchase orders.</p>
        </div>

        <button
          className="ps-primary-button"
          onClick={openCreateOrderModal}
        >
          <Plus size={17} />
          Create Order
        </button>
      </div>

      <div className="ps-toolbar">
        <div className="ps-search ps-table-search">
          <Search size={17} />
          <input
            type="text"
            placeholder="Search purchase orders..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="ps-toolbar-actions">
          <select
            className="ps-filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All Statuses</option>
            {[...new Set(orders.map((order) => order.status))].map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>

          <button className="ps-outline-button" onClick={exportOrders}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="ps-table-wrapper">
        <table className="ps-table">
          <thead>
            <tr>
              <th>ORDER ID</th>
              <th>SUPPLIER</th>
              <th>ITEM</th>
              <th>AMOUNT</th>
              <th>DATE</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.databaseId || order.id}>
                <td className="ps-order-id">{order.id}</td>
                <td>{order.supplier}</td>
                <td>{order.item}</td>
                <td className="ps-amount">{formatCurrency(order.amount)}</td>
                <td>{order.date}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>
                  <button
                    className="ps-icon-button"
                    title="View order"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan="7" className="ps-empty">
                  No purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================================
  // OVERVIEW
  // ==========================================================

  const renderOverview = () => (
    <>
      <div className="ps-welcome">
        <div>
          <span className="ps-eyebrow">PROCUREMENT WORKSPACE</span>
          <h2>Procurement Overview</h2>
          <p>
            Monitor procurement activities, suppliers and purchase orders.
          </p>
        </div>

        <button
          className="ps-primary-button"
          onClick={openCreateOrderModal}
        >
          <Plus size={17} />
          Create Purchase Order
        </button>
      </div>

      <div className="ps-stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="ps-stat-card" key={stat.title}>
              <div className="ps-stat-top">
                <div className={`ps-stat-icon ${stat.color}`}>
                  <Icon size={21} />
                </div>
              </div>

              <h3>{loading ? "—" : stat.value}</h3>
              <p className="ps-stat-title">{stat.title}</p>
              <span className="ps-stat-description">
                Live organization data
              </span>
            </div>
          );
        })}
      </div>

      <div className="ps-overview-grid">
        <div className="ps-panel ps-spend-panel">
          <div className="ps-panel-header">
            <div>
              <h3>Procurement Spend</h3>
              <p>Purchase-order value for the current year</p>
            </div>
          </div>

          <div className="ps-spend-summary">
            <div>
              <span>Total Purchase Order Value</span>
              <h2>{formatCurrency(totalSpend)}</h2>
            </div>
            <span className="ps-spend-growth">
              <TrendingUp size={15} /> Live
            </span>
          </div>

          <div className="ps-chart">
            {monthlySpend.map(({ month, height, amount }) => (
              <div className="ps-chart-column" key={month}>
                <div
                  className="ps-chart-bar"
                  style={{ height: `${height}%` }}
                  title={`${month}: ${formatCurrency(amount)}`}
                />
                <span>{month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ps-panel ps-activity-panel">
          <div className="ps-panel-header">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest procurement records</p>
            </div>
            <button
              className="ps-icon-button"
              onClick={() => loadData(true)}
              title="Refresh activity"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="ps-activity-list">
            {recentActivity.map((activity) => {
              const Icon = activity.icon;

              return (
                <div className="ps-activity-item" key={activity.id}>
                  <div className={`ps-activity-icon ${activity.color}`}>
                    <Icon size={17} />
                  </div>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.description}</p>
                    <span>{getDate(activity.date)}</span>
                  </div>
                </div>
              );
            })}

            {!loading && recentActivity.length === 0 && (
              <p className="ps-empty">No recent activity found.</p>
            )}
          </div>
        </div>
      </div>

      <div className="ps-panel">
        <div className="ps-panel-header">
          <div>
            <h3>Recent Purchase Orders</h3>
            <p>Track your latest purchase orders.</p>
          </div>

          <button
            className="ps-outline-button"
            onClick={() => handleNavigation("Purchase Orders")}
          >
            View All <ArrowUpRight size={15} />
          </button>
        </div>

        <div className="ps-table-wrapper">
          <table className="ps-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>SUPPLIER</th>
                <th>ITEM</th>
                <th>AMOUNT</th>
                <th>DATE</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {orders.slice(0, 4).map((order) => (
                <tr key={order.databaseId || order.id}>
                  <td className="ps-order-id">{order.id}</td>
                  <td>{order.supplier}</td>
                  <td>{order.item}</td>
                  <td className="ps-amount">
                    {formatCurrency(order.amount)}
                  </td>
                  <td>{order.date}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <button
                      className="ps-icon-button"
                      onClick={() => setSelectedOrder(order)}
                      title="View order"
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan="7" className="ps-empty">
                    No purchase orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ==========================================================
  // PURCHASE REQUESTS
  // ==========================================================

  const renderRequests = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Purchase Requests</h3>
          <p>Review incoming purchase requests from departments.</p>
        </div>
        <span className="ps-count-label">
          {requests.length} total requests
        </span>
      </div>

      <div className="ps-toolbar">
        <div className="ps-search ps-table-search">
          <Search size={17} />
          <input
            placeholder="Search requests..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="ps-filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Statuses</option>
          {[...new Set(requests.map((request) => request.status))].map(
            (status) => (
              <option value={status} key={status}>
                {status}
              </option>
            )
          )}
        </select>
      </div>

      <div className="ps-table-wrapper">
        <table className="ps-table">
          <thead>
            <tr>
              <th>REQUEST ID</th>
              <th>REQUEST TITLE</th>
              <th>DEPARTMENT</th>
              <th>REQUESTER</th>
              <th>AMOUNT</th>
              <th>DATE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.databaseId || request.id}>
                <td className="ps-order-id">{request.id}</td>
                <td>{request.title}</td>
                <td>{request.department}</td>
                <td>{request.requester}</td>
                <td className="ps-amount">
                  {formatCurrency(request.amount)}
                </td>
                <td>{request.date}</td>
                <td>
                  <StatusBadge status={request.status} />
                </td>
              </tr>
            ))}

            {!loading && filteredRequests.length === 0 && (
              <tr>
                <td colSpan="7" className="ps-empty">
                  No purchase requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================================
  // SUPPLIERS
  // ==========================================================

  const renderSuppliers = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Supplier Directory</h3>
          <p>View registered suppliers.</p>
        </div>
        <span className="ps-count-label">
          {filteredSuppliers.length} suppliers
        </span>
      </div>

      <div className="ps-toolbar">
        <div className="ps-search ps-table-search">
          <Search size={17} />
          <input
            placeholder="Search suppliers..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="ps-table-wrapper">
        <table className="ps-table">
          <thead>
            <tr>
              <th>SUPPLIER ID</th>
              <th>SUPPLIER NAME</th>
              <th>CATEGORY</th>
              <th>EMAIL</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.databaseId || supplier.id}>
                <td className="ps-order-id">{supplier.id}</td>
                <td>{supplier.name}</td>
                <td>{supplier.category}</td>
                <td>{supplier.email}</td>
                <td>
                  <StatusBadge status={supplier.status} />
                </td>
                <td>
                  <button className="ps-icon-button" title="Supplier details">
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && filteredSuppliers.length === 0 && (
              <tr>
                <td colSpan="6" className="ps-empty">
                  No suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================================
  // GOODS RECEIPTS
  // ==========================================================

  const renderGoodsReceipts = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Goods Receipts</h3>
          <p>Track deliveries against purchase orders.</p>
        </div>
        <span className="ps-count-label">
          {goodsReceipts.length} receipts
        </span>
      </div>

      <div className="ps-table-wrapper">
        <table className="ps-table">
          <thead>
            <tr>
              <th>RECEIPT ID</th>
              <th>PURCHASE ORDER</th>
              <th>SUPPLIER</th>
              <th>RECEIVED DATE</th>
              <th>ITEMS</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {goodsReceipts.map((receipt) => (
              <tr key={getId(receipt) || receipt.id}>
                <td className="ps-order-id">{receipt.id}</td>
                <td>{receipt.order}</td>
                <td>{receipt.supplier}</td>
                <td>{receipt.received}</td>
                <td>{receipt.items}</td>
                <td>
                  <StatusBadge status={receipt.status} />
                </td>
                <td>
                  <button className="ps-icon-button" title="View receipt">
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && goodsReceipts.length === 0 && (
              <tr>
                <td colSpan="7" className="ps-empty">
                  No goods receipts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================================
  // INVOICES
  // ==========================================================

  const renderInvoices = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Supplier Invoices</h3>
          <p>Monitor invoice status and matching progress.</p>
        </div>
        <span className="ps-count-label">{invoices.length} invoices</span>
      </div>

      <div className="ps-table-wrapper">
        <table className="ps-table">
          <thead>
            <tr>
              <th>INVOICE ID</th>
              <th>SUPPLIER</th>
              <th>PURCHASE ORDER</th>
              <th>AMOUNT</th>
              <th>DATE</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={getId(invoice) || invoice.id}>
                <td className="ps-order-id">{invoice.id}</td>
                <td>{invoice.supplier}</td>
                <td>{invoice.order}</td>
                <td className="ps-amount">
                  {formatCurrency(invoice.amount)}
                </td>
                <td>{invoice.date}</td>
                <td>
                  <StatusBadge status={invoice.status} />
                </td>
                <td>
                  <button className="ps-icon-button" title="View invoice">
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))}

            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan="7" className="ps-empty">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================================
  // PAGE ROUTING
  // ==========================================================

  const pageDescriptions = {
    Overview: "Your procurement operations at a glance.",
    "Purchase Requests": "Review and monitor purchase requests.",
    "Purchase Orders": "Manage and track purchase orders.",
    Suppliers: "Manage your supplier relationships.",
    "Goods Receipts": "Track goods received from suppliers.",
    Invoices: "Monitor supplier invoices and matching.",
  };

  const renderPage = () => {
    switch (activePage) {
      case "Overview":
        return renderOverview();
      case "Purchase Requests":
        return renderRequests();
      case "Purchase Orders":
        return renderOrders();
      case "Suppliers":
        return renderSuppliers();
      case "Goods Receipts":
        return renderGoodsReceipts();
      case "Invoices":
        return renderInvoices();
      default:
        return renderOverview();
    }
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="ps-layout">
      {sidebarOpen && (
        <button
          className="ps-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside className={`ps-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="ps-brand">
          <div className="ps-brand-mark">
            <Boxes size={24} />
          </div>
          <div>
            <h2>ETDOX</h2>
            <span>TECHNOLOGIES</span>
          </div>
          <button
            className="ps-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="ps-workspace">
          <div className="ps-workspace-icon">
            <Building2 size={18} />
          </div>
          <div>
            <strong>Enterprise Workspace</strong>
            <span>Procurement Division</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="ps-nav-label">WORKSPACE</div>

        <nav className="ps-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`ps-nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => handleNavigation(item.label)}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "Purchase Requests" && (
                  <span className="ps-nav-count">{pendingRequests}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ps-sidebar-bottom">
          <div className="ps-nav-label">PREFERENCES</div>

          <button className="ps-nav-item">
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="ps-sidebar-help">
            <div className="ps-help-icon">
              <ShieldCheck size={20} />
            </div>
            <strong>Need assistance?</strong>
            <p>Contact your organization administrator for support.</p>
            <button
              onClick={() =>
                alert("Contact your organization administrator.")
              }
            >
              Get Support
            </button>
          </div>

          <button className="ps-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="ps-main">
        <header className="ps-topbar">
          <div className="ps-topbar-left">
            <button
              className="ps-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <div className="ps-breadcrumb">
              <span>Workspace</span>
              <span className="ps-breadcrumb-separator">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="ps-topbar-right">
            <div className="ps-search ps-global-search">
              <Search size={17} />
              <input
                type="text"
                placeholder="Search anything..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>

            <button
              className="ps-top-icon"
              onClick={() => loadData(true)}
              title="Refresh data"
              disabled={refreshing}
            >
              <RefreshCw
                size={18}
                className={refreshing ? "ps-refreshing" : ""}
              />
            </button>

            <div className="ps-notification-wrapper">
              <button
                className="ps-top-icon"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                aria-label="Notifications"
              >
                <Bell size={19} />
                <span className="ps-notification-dot" />
              </button>

              {showNotifications && (
                <div className="ps-dropdown ps-notification-dropdown">
                  <h4>Notifications</h4>

                  {pendingRequests > 0 ? (
                    <div className="ps-notification-item">
                      <AlertCircle size={18} />
                      <div>
                        <strong>Purchase requests need attention</strong>
                        <span>{pendingRequests} pending requests</span>
                      </div>
                    </div>
                  ) : (
                    <div className="ps-notification-item">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>No pending requests</strong>
                        <span>Your request queue is clear.</span>
                      </div>
                    </div>
                  )}

                  <div className="ps-notification-item">
                    <PackageCheck size={18} />
                    <div>
                      <strong>Goods receipts</strong>
                      <span>{goodsReceipts.length} receipt records loaded</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="ps-profile-wrapper">
              <button
                className="ps-profile-button"
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
              >
                <div className="ps-avatar">PS</div>
                <div className="ps-profile-info">
                  <strong>Procurement Specialist</strong>
                  <span>Procurement Team</span>
                </div>
                <ChevronDown size={15} />
              </button>

              {showProfileMenu && (
                <div className="ps-dropdown ps-profile-dropdown">
                  <button>
                    <UserCircle size={17} /> My Profile
                  </button>
                  <button>
                    <Settings size={17} /> Account Settings
                  </button>
                  <button onClick={handleLogout}>
                    <LogOut size={17} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="ps-content">
          <div className="ps-page-heading">
            <div>
              <h1>{activePage}</h1>
              <p>{pageDescriptions[activePage]}</p>
            </div>

            <div className="ps-date-display">
              <CalendarDays size={17} />
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>

          {error && (
            <div className="ps-panel" role="alert">
              <div className="ps-panel-header">
                <div>
                  <h3>Unable to load procurement data</h3>
                  <p>{error}</p>
                </div>
                <button
                  className="ps-outline-button"
                  onClick={() => loadData(true)}
                >
                  <RefreshCw size={16} /> Retry
                </button>
              </div>
            </div>
          )}

          {loadWarnings.length > 0 && !error && (
            <div className="ps-panel" role="status">
              <div className="ps-panel-header">
                <div>
                  <h3>Some data could not be loaded</h3>
                  {loadWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
                <button
                  className="ps-outline-button"
                  onClick={() => loadData(true)}
                >
                  <RefreshCw size={16} /> Retry
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="ps-panel">
              <div className="ps-panel-header">
                <div>
                  <h3>Loading procurement data...</h3>
                  <p>Retrieving records from your organization.</p>
                </div>
                <RefreshCw size={20} />
              </div>
            </div>
          ) : (
            renderPage()
          )}

          <footer className="ps-footer">
            <span>© 2026 ETDOX Technologies. All rights reserved.</span>
            <span>Enterprise Procurement Platform</span>
          </footer>
        </div>
      </main>

      {/* CREATE PURCHASE ORDER MODAL */}

      {showOrderModal && (
        <div
          className="ps-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingOrder) {
              setShowOrderModal(false);
            }
          }}
        >
          <div className="ps-modal">
            <div className="ps-modal-header">
              <div>
                <h2>Create Purchase Order</h2>
                <p>
                  Select an approved purchase request and an active supplier.
                </p>
              </div>

              <button
                className="ps-icon-button"
                onClick={() => setShowOrderModal(false)}
                aria-label="Close modal"
                disabled={creatingOrder}
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <label>
                Approved Purchase Request

                <select
                  value={newOrder.purchaseRequestId}
                  onChange={(event) => {
                    setNewOrder((previous) => ({
                      ...previous,
                      purchaseRequestId: event.target.value,
                    }));
                    setFormError("");
                  }}
                  required
                >
                  <option value="">Select an approved request</option>

                  {approvedRequests.map((request) => (
                    <option
                      key={request.databaseId || request.id}
                      value={request.databaseId}
                      disabled={!request.hasLineItems}
                    >
                      {request.id} — {request.title} (
                      {request.itemCount} items
                      {request.hasLineItems ? "" : " — Missing items"})
                    </option>
                  ))}
                </select>
              </label>

              {approvedRequests.length === 0 && (
                <p className="ps-form-hint">
                  No approved purchase requests are available. Approve a
                  purchase request before creating an order.
                </p>
              )}

              {approvedRequests.length > 0 &&
                eligibleApprovedRequests.length === 0 && (
                  <p className="ps-form-hint" role="alert">
                    Approved requests were found, but none contains line items.
                    Add at least one item to a purchase request before creating
                    a purchase order.
                  </p>
                )}

              {selectedRequest && !selectedRequest.hasLineItems && (
                <p className="ps-form-error" role="alert">
                  This request has no line items. Select another request or add
                  items to this purchase request first.
                </p>
              )}

              <label>
                Active Supplier

                <select
                  value={newOrder.supplierId}
                  onChange={(event) => {
                    setNewOrder((previous) => ({
                      ...previous,
                      supplierId: event.target.value,
                    }));
                    setFormError("");
                  }}
                  required
                >
                  <option value="">Select an active supplier</option>

                  {activeSuppliers.map((supplier) => (
                    <option
                      key={supplier.databaseId || supplier.id}
                      value={supplier.databaseId}
                    >
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              {activeSuppliers.length === 0 && (
                <p className="ps-form-hint">
                  No active suppliers are available.
                </p>
              )}

              {formError && (
                <p className="ps-form-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="ps-modal-actions">
                <button
                  type="button"
                  className="ps-outline-button"
                  onClick={() => setShowOrderModal(false)}
                  disabled={creatingOrder}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ps-primary-button"
                  disabled={
                    creatingOrder ||
                    eligibleApprovedRequests.length === 0 ||
                    activeSuppliers.length === 0 ||
                    !selectedRequest?.hasLineItems
                  }
                >
                  <Plus size={17} />
                  {creatingOrder ? "Creating..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE ORDER DETAILS */}

      {selectedOrder && (
        <div
          className="ps-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrder(null);
            }
          }}
        >
          <div className="ps-modal">
            <div className="ps-modal-header">
              <div>
                <h2>Purchase Order Details</h2>
                <p>{selectedOrder.id}</p>
              </div>

              <button
                className="ps-icon-button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close details"
              >
                <X size={21} />
              </button>
            </div>

            <div className="ps-detail-list">
              <div>
                <span>Supplier</span>
                <strong>{selectedOrder.supplier}</strong>
              </div>

              <div>
                <span>Item</span>
                <strong>{selectedOrder.item}</strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>{formatCurrency(selectedOrder.amount)}</strong>
              </div>

              <div>
                <span>Order Date</span>
                <strong>{selectedOrder.date}</strong>
              </div>

              <div>
                <span>Status</span>
                <StatusBadge status={selectedOrder.status} />
              </div>
            </div>

            <div className="ps-modal-actions">
              <button
                className="ps-primary-button"
                onClick={() => setSelectedOrder(null)}
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

export default ProcurementSpecialistPage;
