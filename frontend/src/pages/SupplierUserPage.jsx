
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Truck,
  Building2,
  Search,
  RefreshCw,
  LogOut,
  Bell,
  Menu,
  X,
  Package,
  Clock3,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Eye,
  Send,
  CalendarDays,
  MapPin,
  Mail,
  Phone,
  UserRound,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

import "./SupplierUserPage.css";

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

const formatCurrency = (value, currency = "INR") => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
};

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

const getStatusClass = (status) => {
  const value = String(status || "pending").toLowerCase();

  if (
    value.includes("approved") ||
    value.includes("completed") ||
    value.includes("delivered") ||
    value.includes("accepted")
  ) {
    return "success";
  }

  if (
    value.includes("reject") ||
    value.includes("cancel") ||
    value.includes("overdue") ||
    value.includes("failed")
  ) {
    return "danger";
  }

  if (
    value.includes("pending") ||
    value.includes("review") ||
    value.includes("submitted") ||
    value.includes("progress")
  ) {
    return "warning";
  }

  return "neutral";
};

function StatusBadge({ status }) {
  return (
    <span className={`supplier-status supplier-status-${getStatusClass(status)}`}>
      <span className="supplier-status-dot" />
      {String(status || "Pending").replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="supplier-empty">
      <div className="supplier-empty-icon">
        <Package size={23} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default function SupplierUserPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [supplier, setSupplier] = useState(null);
  const [rfqs, setRfqs] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedRfq, setSelectedRfq] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    unitPrice: "",
    quantity: "",
    deliveryDays: "",
    remarks: "",
  });
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    }),
    []
  );

  const request = useCallback(
    async (path) => {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: authHeaders,
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
    [authHeaders]
  );

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!getToken()) {
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const results = await Promise.allSettled([
        request("/auth/me"),
        request("/supplier/rfqs?limit=100&offset=0"),
        request("/supplier/purchase-orders?limit=100&offset=0"),
        request("/supplier/deliveries?limit=100&offset=0"),
      ]);

      const [userResult, rfqResult, poResult, deliveryResult] = results;

      if (userResult.status === "fulfilled") {
        const userData =
          userResult.value?.user ||
          userResult.value?.data?.user ||
          userResult.value?.data ||
          userResult.value;

        setSupplier(userData);
      } else {
        setSupplier(null);
      }

      if (rfqResult.status === "fulfilled") {
        setRfqs(unwrapList(rfqResult.value, ["rfqs", "items"]));
      } else {
        setRfqs([]);
      }

      if (poResult.status === "fulfilled") {
        setPurchaseOrders(
          unwrapList(poResult.value, ["purchaseOrders", "orders", "items"])
        );
      } else {
        setPurchaseOrders([]);
      }

      if (deliveryResult.status === "fulfilled") {
        setDeliveries(
          unwrapList(deliveryResult.value, ["deliveries", "shipments", "items"])
        );
      } else {
        setDeliveries([]);
      }

      const failedRequests = results.filter(
        (result) => result.status === "rejected"
      );

      if (failedRequests.length === results.length) {
        setError(
          "Unable to load supplier portal data. Check your API routes and login session."
        );
      } else if (failedRequests.length > 0) {
        setError(
          "Some supplier information could not be loaded. Check that all supplier API endpoints are available."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [request]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const displayName =
    supplier?.supplier?.name ||
    supplier?.supplierName ||
    supplier?.companyName ||
    supplier?.name ||
    supplier?.fullName ||
    "Supplier Account";

  const email =
    supplier?.email ||
    supplier?.user?.email ||
    supplier?.supplier?.email ||
    "—";

  const companyName =
    supplier?.supplier?.name ||
    supplier?.supplierName ||
    supplier?.companyName ||
    supplier?.organization?.name ||
    "Supplier Company";

  const openRfqs = rfqs.filter((rfq) =>
    ["open", "published", "invited", "pending"].includes(
      String(rfq.status || "").toLowerCase()
    )
  );

  const activeOrders = purchaseOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return !["completed", "cancelled", "delivered", "closed"].includes(status);
  });

  const completedDeliveries = deliveries.filter((delivery) =>
    ["delivered", "completed", "received"].includes(
      String(delivery.status || "").toLowerCase()
    )
  );

  const totalOrderValue = purchaseOrders.reduce(
    (sum, order) =>
      sum +
      Number(
        order.totalAmount ??
          order.total_amount ??
          order.grandTotal ??
          order.grand_total ??
          0
      ),
    0
  );

  const filteredRfqs = rfqs.filter((rfq) => {
    const search = searchTerm.toLowerCase();

    return (
      String(rfq.title || rfq.name || "").toLowerCase().includes(search) ||
      String(rfq.rfqNumber || rfq.rfq_number || rfq.reference || "")
        .toLowerCase()
        .includes(search) ||
      String(rfq.description || "").toLowerCase().includes(search)
    );
  });

  const filteredOrders = purchaseOrders.filter((order) => {
    const search = searchTerm.toLowerCase();

    return (
      String(order.poNumber || order.po_number || order.orderNumber || "")
        .toLowerCase()
        .includes(search) ||
      String(order.title || order.description || order.requestTitle || "")
        .toLowerCase()
        .includes(search)
    );
  });

  const filteredDeliveries = deliveries.filter((delivery) => {
    const search = searchTerm.toLowerCase();

    return (
      String(
        delivery.deliveryNumber ||
          delivery.delivery_number ||
          delivery.reference ||
          ""
      )
        .toLowerCase()
        .includes(search) ||
      String(delivery.poNumber || delivery.po_number || "").toLowerCase().includes(search) ||
      String(delivery.status || "").toLowerCase().includes(search)
    );
  });

  const submitQuote = async (event) => {
    event.preventDefault();

    if (!selectedRfq) return;

    setSubmittingQuote(true);
    setQuoteMessage("");

    try {
      const rfqId = selectedRfq.id || selectedRfq.rfqId || selectedRfq.rfq_id;

      const response = await fetch(
        `${API_BASE}/supplier/rfqs/${rfqId}/quotes`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            unitPrice: Number(quoteForm.unitPrice),
            quantity: Number(quoteForm.quantity),
            deliveryDays: Number(quoteForm.deliveryDays),
            remarks: quoteForm.remarks,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message || result?.error || "Unable to submit quote."
        );
      }

      setQuoteMessage("Your quotation was submitted successfully.");
      setSelectedRfq(null);
      setQuoteForm({
        unitPrice: "",
        quantity: "",
        deliveryDays: "",
        remarks: "",
      });

      await loadDashboard(true);
    } catch (err) {
      setQuoteMessage(err.message || "Unable to submit quotation.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  const logout = () => {
    [
      "token",
      "accessToken",
      "authToken",
      "user",
      "refreshToken",
    ].forEach((key) => localStorage.removeItem(key));

    window.location.href = "/login";
  };

  const navigation = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "rfqs", label: "RFQ Invitations", icon: FileText, count: openRfqs.length },
    { id: "orders", label: "Purchase Orders", icon: ShoppingCart },
    { id: "deliveries", label: "Deliveries", icon: Truck },
    { id: "profile", label: "Company Profile", icon: Building2 },
  ];

  const pageTitles = {
    overview: ["Supplier Overview", "Monitor your invitations, orders and deliveries."],
    rfqs: ["RFQ Invitations", "Review procurement requests and submit quotations."],
    orders: ["Purchase Orders", "Track purchase orders assigned to your company."],
    deliveries: ["Delivery Tracking", "Review delivery progress and shipment records."],
    profile: ["Company Profile", "View your supplier account information."],
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setSidebarOpen(false);
  };

  const renderRfqTable = (items) => (
    <div className="supplier-table-wrap">
      <table className="supplier-table">
        <thead>
          <tr>
            <th>RFQ DETAILS</th>
            <th>QUANTITY</th>
            <th>SUBMISSION DEADLINE</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {items.map((rfq, index) => (
            <tr key={rfq.id || rfq.rfqId || rfq.rfq_id || index}>
              <td>
                <div className="supplier-primary-cell">
                  <strong>
                    {rfq.title || rfq.name || "Untitled RFQ"}
                  </strong>
                  <span>
                    {rfq.rfqNumber ||
                      rfq.rfq_number ||
                      rfq.reference ||
                      "RFQ reference unavailable"}
                  </span>
                </div>
              </td>
              <td>{rfq.quantity ?? rfq.requiredQuantity ?? "—"}</td>
              <td>
                {formatDate(
                  rfq.submissionDeadline ||
                    rfq.submission_deadline ||
                    rfq.dueDate ||
                    rfq.due_date
                )}
              </td>
              <td>
                <StatusBadge status={rfq.status} />
              </td>
              <td>
                <button
                  className="supplier-action-btn"
                  onClick={() => {
                    setSelectedRfq(rfq);
                    setQuoteMessage("");
                    setQuoteForm({
                      unitPrice: "",
                      quantity: String(rfq.quantity || rfq.requiredQuantity || ""),
                      deliveryDays: "",
                      remarks: "",
                    });
                  }}
                >
                  <Send size={14} />
                  Submit quote
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState
          title="No RFQ invitations found"
          description="New invitations from procurement teams will appear here."
        />
      )}
    </div>
  );

  const renderOrdersTable = (items) => (
    <div className="supplier-table-wrap">
      <table className="supplier-table">
        <thead>
          <tr>
            <th>PURCHASE ORDER</th>
            <th>ORDER DATE</th>
            <th>EXPECTED DELIVERY</th>
            <th>ORDER VALUE</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((order, index) => (
            <tr key={order.id || order.poId || order.po_id || index}>
              <td>
                <div className="supplier-primary-cell">
                  <strong>
                    {order.poNumber ||
                      order.po_number ||
                      order.orderNumber ||
                      "Purchase Order"}
                  </strong>
                  <span>
                    {order.title ||
                      order.description ||
                      order.requestTitle ||
                      "Procurement order"}
                  </span>
                </div>
              </td>
              <td>{formatDate(order.orderDate || order.order_date || order.createdAt)}</td>
              <td>
                {formatDate(
                  order.expectedDelivery ||
                    order.expected_delivery ||
                    order.deliveryDate ||
                    order.delivery_date
                )}
              </td>
              <td>
                <strong>
                  {formatCurrency(
                    order.totalAmount ??
                      order.total_amount ??
                      order.grandTotal ??
                      order.grand_total,
                    order.currency || "INR"
                  )}
                </strong>
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState
          title="No purchase orders found"
          description="Purchase orders issued to your supplier account will appear here."
        />
      )}
    </div>
  );

  const renderDeliveriesTable = (items) => (
    <div className="supplier-table-wrap">
      <table className="supplier-table">
        <thead>
          <tr>
            <th>DELIVERY REFERENCE</th>
            <th>PURCHASE ORDER</th>
            <th>EXPECTED DATE</th>
            <th>ACTUAL DATE</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((delivery, index) => (
            <tr key={delivery.id || delivery.deliveryId || index}>
              <td>
                <div className="supplier-primary-cell">
                  <strong>
                    {delivery.deliveryNumber ||
                      delivery.delivery_number ||
                      delivery.reference ||
                      "Delivery"}
                  </strong>
                  <span>{delivery.carrier || delivery.transportMode || "Shipment"}</span>
                </div>
              </td>
              <td>
                {delivery.poNumber ||
                  delivery.po_number ||
                  delivery.purchaseOrderNumber ||
                  "—"}
              </td>
              <td>
                {formatDate(
                  delivery.expectedDate ||
                    delivery.expected_date ||
                    delivery.estimatedDelivery
                )}
              </td>
              <td>
                {formatDate(
                  delivery.actualDate ||
                    delivery.actual_date ||
                    delivery.deliveredAt
                )}
              </td>
              <td>
                <StatusBadge status={delivery.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState
          title="No delivery records found"
          description="Your shipment and delivery updates will appear here."
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="supplier-loading-screen">
        <div className="supplier-loader" />
        <p>Loading supplier workspace...</p>
      </div>
    );
  }

  return (
    <div className="supplier-app">
      {sidebarOpen && (
        <button
          className="supplier-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`supplier-sidebar ${sidebarOpen ? "supplier-sidebar-open" : ""}`}>
        <div className="supplier-brand">
          <div className="supplier-brand-mark">
            <Building2 size={22} />
          </div>
          <div>
            <strong>ETDOX</strong>
            <span>Supplier Portal</span>
          </div>
          <button
            className="supplier-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="supplier-workspace-label">WORKSPACE</div>

        <nav className="supplier-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`supplier-nav-item ${
                  activeTab === item.id ? "active" : ""
                }`}
                onClick={() => changeTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.count > 0 && (
                  <small className="supplier-nav-count">{item.count}</small>
                )}
              </button>
            );
          })}
        </nav>

        <div className="supplier-sidebar-bottom">
          <div className="supplier-help-card">
            <div className="supplier-help-icon">
              <AlertCircle size={17} />
            </div>
            <strong>Need assistance?</strong>
            <p>Contact your procurement administrator for portal support.</p>
          </div>

          <button className="supplier-logout" onClick={logout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="supplier-main">
        <header className="supplier-topbar">
          <div className="supplier-topbar-left">
            <button
              className="supplier-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="supplier-breadcrumb">
              <span>Supplier Portal</span>
              <ChevronRight size={14} />
              <strong>{pageTitles[activeTab][0]}</strong>
            </div>
          </div>

          <div className="supplier-topbar-right">
            <button
              className="supplier-icon-button"
              onClick={() => loadDashboard(true)}
              title="Refresh data"
              disabled={refreshing}
            >
              <RefreshCw size={18} className={refreshing ? "supplier-spin" : ""} />
            </button>

            <div className="supplier-topbar-divider" />

            <div className="supplier-user">
              <div className="supplier-avatar">
                {String(displayName).charAt(0).toUpperCase()}
              </div>
              <div className="supplier-user-info">
                <strong>{displayName}</strong>
                <span>Supplier User</span>
              </div>
            </div>
          </div>
        </header>

        <div className="supplier-content">
          <section className="supplier-page-heading">
            <div>
              <div className="supplier-eyebrow">ETDOX / SUPPLIER WORKSPACE</div>
              <h1>{pageTitles[activeTab][0]}</h1>
              <p>{pageTitles[activeTab][1]}</p>
            </div>

            <div className="supplier-heading-actions">
              <span className="supplier-date-label">
                <CalendarDays size={15} />
                {new Date().toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </section>

          {error && (
            <div className="supplier-alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => loadDashboard(true)}>Retry</button>
            </div>
          )}

          {activeTab === "overview" && (
            <>
              <section className="supplier-welcome-card">
                <div>
                  <span className="supplier-welcome-label">SUPPLIER WORKSPACE</span>
                  <h2>Welcome, {displayName}</h2>
                  <p>
                    Manage your RFQ invitations, purchase orders and deliveries
                    from one place.
                  </p>
                </div>
                <div className="supplier-welcome-art">
                  <Building2 size={65} strokeWidth={1.2} />
                </div>
              </section>

              <section className="supplier-stats-grid">
                <div className="supplier-stat-card">
                  <div className="supplier-stat-top">
                    <span>Open RFQ Invitations</span>
                    <div className="supplier-stat-icon blue">
                      <FileText size={20} />
                    </div>
                  </div>
                  <strong>{openRfqs.length}</strong>
                  <small>Available invitations</small>
                </div>

                <div className="supplier-stat-card">
                  <div className="supplier-stat-top">
                    <span>Active Purchase Orders</span>
                    <div className="supplier-stat-icon purple">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                  <strong>{activeOrders.length}</strong>
                  <small>Orders in progress</small>
                </div>

                <div className="supplier-stat-card">
                  <div className="supplier-stat-top">
                    <span>Total Order Value</span>
                    <div className="supplier-stat-icon green">
                      <IndianRupee size={20} />
                    </div>
                  </div>
                  <strong className="supplier-stat-currency">
                    {formatCurrency(totalOrderValue)}
                  </strong>
                  <small>Based on loaded purchase orders</small>
                </div>

                <div className="supplier-stat-card">
                  <div className="supplier-stat-top">
                    <span>Completed Deliveries</span>
                    <div className="supplier-stat-icon orange">
                      <Truck size={20} />
                    </div>
                  </div>
                  <strong>{completedDeliveries.length}</strong>
                  <small>Successfully delivered</small>
                </div>
              </section>

              <section className="supplier-dashboard-grid">
                <div className="supplier-panel supplier-panel-large">
                  <div className="supplier-panel-heading">
                    <div>
                      <h3>Recent RFQ Invitations</h3>
                      <p>Latest opportunities shared with your company</p>
                    </div>
                    <button
                      className="supplier-text-link"
                      onClick={() => changeTab("rfqs")}
                    >
                      View all <ChevronRight size={15} />
                    </button>
                  </div>

                  {renderRfqTable(rfqs.slice(0, 5))}
                </div>

                <div className="supplier-panel supplier-quick-panel">
                  <div className="supplier-panel-heading">
                    <div>
                      <h3>Quick Overview</h3>
                      <p>Your supplier activity</p>
                    </div>
                  </div>

                  <div className="supplier-quick-item">
                    <div className="supplier-quick-icon blue">
                      <FileText size={18} />
                    </div>
                    <div>
                      <strong>{rfqs.length} RFQ records</strong>
                      <span>Invitations received</span>
                    </div>
                  </div>

                  <div className="supplier-quick-item">
                    <div className="supplier-quick-icon purple">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <strong>{purchaseOrders.length} purchase orders</strong>
                      <span>Orders assigned to you</span>
                    </div>
                  </div>

                  <div className="supplier-quick-item">
                    <div className="supplier-quick-icon green">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <strong>{completedDeliveries.length} completed</strong>
                      <span>Delivery records</span>
                    </div>
                  </div>

                  <div className="supplier-company-summary">
                    <span>REGISTERED COMPANY</span>
                    <strong>{companyName}</strong>
                    <small>{email}</small>
                  </div>
                </div>
              </section>

              <section className="supplier-panel">
                <div className="supplier-panel-heading">
                  <div>
                    <h3>Recent Purchase Orders</h3>
                    <p>Latest orders issued to your supplier account</p>
                  </div>
                  <button
                    className="supplier-text-link"
                    onClick={() => changeTab("orders")}
                  >
                    View all <ChevronRight size={15} />
                  </button>
                </div>
                {renderOrdersTable(purchaseOrders.slice(0, 5))}
              </section>
            </>
          )}

          {activeTab === "rfqs" && (
            <section className="supplier-panel">
              <div className="supplier-panel-heading supplier-list-heading">
                <div>
                  <h3>RFQ Invitations</h3>
                  <p>Review invitations and submit your quotations.</p>
                </div>
                <div className="supplier-search">
                  <Search size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search RFQs..."
                  />
                </div>
              </div>
              {renderRfqTable(filteredRfqs)}
            </section>
          )}

          {activeTab === "orders" && (
            <section className="supplier-panel">
              <div className="supplier-panel-heading supplier-list-heading">
                <div>
                  <h3>Purchase Orders</h3>
                  <p>Review orders issued to your company.</p>
                </div>
                <div className="supplier-search">
                  <Search size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search purchase orders..."
                  />
                </div>
              </div>
              {renderOrdersTable(filteredOrders)}
            </section>
          )}

          {activeTab === "deliveries" && (
            <section className="supplier-panel">
              <div className="supplier-panel-heading supplier-list-heading">
                <div>
                  <h3>Delivery Tracking</h3>
                  <p>Monitor shipment and delivery records.</p>
                </div>
                <div className="supplier-search">
                  <Search size={17} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search deliveries..."
                  />
                </div>
              </div>
              {renderDeliveriesTable(filteredDeliveries)}
            </section>
          )}

          {activeTab === "profile" && (
            <section className="supplier-profile-grid">
              <div className="supplier-panel supplier-profile-main">
                <div className="supplier-profile-cover">
                  <div className="supplier-profile-avatar">
                    {String(companyName).charAt(0).toUpperCase()}
                  </div>
                </div>

                <div className="supplier-profile-details">
                  <h2>{companyName}</h2>
                  <p>Registered supplier account</p>

                  <div className="supplier-profile-info-grid">
                    <div className="supplier-profile-info">
                      <span><UserRound size={16} /> ACCOUNT HOLDER</span>
                      <strong>{displayName}</strong>
                    </div>
                    <div className="supplier-profile-info">
                      <span><Mail size={16} /> EMAIL ADDRESS</span>
                      <strong>{email}</strong>
                    </div>
                    <div className="supplier-profile-info">
                      <span><Phone size={16} /> PHONE NUMBER</span>
                      <strong>
                        {supplier?.phone ||
                          supplier?.phoneNumber ||
                          supplier?.supplier?.phone ||
                          "Not provided"}
                      </strong>
                    </div>
                    <div className="supplier-profile-info">
                      <span><MapPin size={16} /> ADDRESS</span>
                      <strong>
                        {supplier?.address ||
                          supplier?.supplier?.address ||
                          "Not provided"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="supplier-panel supplier-account-panel">
                <h3>Account Information</h3>
                <div className="supplier-account-row">
                  <span>Account role</span>
                  <strong>Supplier User</strong>
                </div>
                <div className="supplier-account-row">
                  <span>Account status</span>
                  <StatusBadge status={supplier?.status || "Active"} />
                </div>
                <div className="supplier-account-row">
                  <span>Supplier ID</span>
                  <strong>
                    {supplier?.supplierId ||
                      supplier?.supplier_id ||
                      supplier?.supplier?.id ||
                      "—"}
                  </strong>
                </div>
                <div className="supplier-account-row">
                  <span>Member since</span>
                  <strong>{formatDate(supplier?.createdAt || supplier?.created_at)}</strong>
                </div>
                <p className="supplier-profile-note">
                  For changes to company registration details, contact your
                  ETDOX procurement administrator.
                </p>
              </div>
            </section>
          )}

          <footer className="supplier-footer">
            <span>© {new Date().getFullYear()} ETDOX Technologies</span>
            <span>Supplier Portal · Secure workspace</span>
          </footer>
        </div>
      </main>

      {selectedRfq && (
        <div className="supplier-modal-backdrop">
          <div className="supplier-modal">
            <div className="supplier-modal-header">
              <div>
                <span>RFQ RESPONSE</span>
                <h2>Submit Quotation</h2>
                <p>
                  {selectedRfq.title ||
                    selectedRfq.name ||
                    selectedRfq.rfqNumber ||
                    "RFQ invitation"}
                </p>
              </div>
              <button
                className="supplier-modal-close"
                onClick={() => setSelectedRfq(null)}
                aria-label="Close quotation form"
              >
                <X size={20} />
              </button>
            </div>

            {quoteMessage && (
              <div className="supplier-modal-message">
                <AlertCircle size={16} />
                {quoteMessage}
              </div>
            )}

            <form onSubmit={submitQuote} className="supplier-quote-form">
              <label>
                Unit price (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={quoteForm.unitPrice}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      unitPrice: event.target.value,
                    }))
                  }
                  placeholder="Enter your unit price"
                />
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  required
                  value={quoteForm.quantity}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      quantity: event.target.value,
                    }))
                  }
                  placeholder="Enter quantity"
                />
              </label>

              <label>
                Delivery time (days)
                <input
                  type="number"
                  min="1"
                  required
                  value={quoteForm.deliveryDays}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      deliveryDays: event.target.value,
                    }))
                  }
                  placeholder="Estimated delivery days"
                />
              </label>

              <label>
                Remarks
                <textarea
                  rows="3"
                  value={quoteForm.remarks}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      remarks: event.target.value,
                    }))
                  }
                  placeholder="Add product details, terms or notes..."
                />
              </label>

              <div className="supplier-modal-actions">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={() => setSelectedRfq(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={submittingQuote}
                >
                  <Send size={16} />
                  {submittingQuote ? "Submitting..." : "Submit quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
