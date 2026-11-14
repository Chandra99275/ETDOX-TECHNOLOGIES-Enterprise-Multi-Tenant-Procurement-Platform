
import React, { useMemo, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  Truck,
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
  ArrowDownRight,
  Eye,
  MoreHorizontal,
  Filter,
  Download,
  RefreshCw,
  Clock3,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Boxes,
  Wallet,
  Users,
  TrendingUp,
  CircleDollarSign,
  BarChart3,
  UserCircle,
  ShieldCheck,
} from "lucide-react";

import "./ProcurementSpecialist.css";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Purchase Requests", icon: ClipboardList },
  { label: "Purchase Orders", icon: ShoppingCart },
  { label: "Suppliers", icon: Building2 },
  { label: "Goods Receipts", icon: PackageCheck },
  { label: "Invoices", icon: FileText },
];

const initialOrders = [
  {
    id: "PO-2026-001",
    supplier: "Tech Solutions Pvt Ltd",
    item: "Dell Latitude Laptops",
    amount: 450000,
    date: "14 Nov 2026",
    status: "Pending",
  },
  {
    id: "PO-2026-002",
    supplier: "Global Office Supplies",
    item: "Office Furniture",
    amount: 125000,
    date: "13 Nov 2026",
    status: "Approved",
  },
  {
    id: "PO-2026-003",
    supplier: "Cloud Systems India",
    item: "Cloud Infrastructure",
    amount: 280000,
    date: "12 Nov 2026",
    status: "Delivered",
  },
  {
    id: "PO-2026-004",
    supplier: "Network Pro Services",
    item: "Network Equipment",
    amount: 95000,
    date: "11 Nov 2026",
    status: "Pending",
  },
];

const purchaseRequests = [
  {
    id: "PR-2026-014",
    title: "Laptop Procurement",
    department: "Engineering",
    requester: "Rahul Sharma",
    amount: 450000,
    date: "14 Nov 2026",
    status: "Approved",
  },
  {
    id: "PR-2026-013",
    title: "Office Furniture",
    department: "Administration",
    requester: "Priya Reddy",
    amount: 125000,
    date: "13 Nov 2026",
    status: "Pending",
  },
  {
    id: "PR-2026-012",
    title: "Network Equipment",
    department: "IT",
    requester: "Arjun Kumar",
    amount: 95000,
    date: "12 Nov 2026",
    status: "Under Review",
  },
  {
    id: "PR-2026-011",
    title: "Cloud Services",
    department: "Technology",
    requester: "Sneha Rao",
    amount: 280000,
    date: "11 Nov 2026",
    status: "Approved",
  },
];

const initialSuppliers = [
  {
    id: "SUP-001",
    name: "Tech Solutions Pvt Ltd",
    category: "IT Equipment",
    email: "sales@techsolutions.example",
    status: "Active",
  },
  {
    id: "SUP-002",
    name: "Global Office Supplies",
    category: "Office Supplies",
    email: "contact@globaloffice.example",
    status: "Active",
  },
  {
    id: "SUP-003",
    name: "Cloud Systems India",
    category: "Cloud Services",
    email: "support@cloudsystems.example",
    status: "Active",
  },
  {
    id: "SUP-004",
    name: "Network Pro Services",
    category: "Networking",
    email: "sales@networkpro.example",
    status: "Under Review",
  },
];

const goodsReceipts = [
  {
    id: "GR-2026-021",
    order: "PO-2026-003",
    supplier: "Cloud Systems India",
    received: "12 Nov 2026",
    items: 12,
    status: "Received",
  },
  {
    id: "GR-2026-020",
    order: "PO-2026-002",
    supplier: "Global Office Supplies",
    received: "13 Nov 2026",
    items: 8,
    status: "Received",
  },
  {
    id: "GR-2026-019",
    order: "PO-2026-004",
    supplier: "Network Pro Services",
    received: "14 Nov 2026",
    items: 5,
    status: "Pending",
  },
];

const invoices = [
  {
    id: "INV-2026-101",
    supplier: "Cloud Systems India",
    order: "PO-2026-003",
    amount: 280000,
    date: "13 Nov 2026",
    status: "Matched",
  },
  {
    id: "INV-2026-102",
    supplier: "Global Office Supplies",
    order: "PO-2026-002",
    amount: 125000,
    date: "14 Nov 2026",
    status: "Pending",
  },
  {
    id: "INV-2026-103",
    supplier: "Tech Solutions Pvt Ltd",
    order: "PO-2026-001",
    amount: 450000,
    date: "14 Nov 2026",
    status: "Under Review",
  },
];

const stats = [
  {
    title: "Purchase Orders",
    value: "128",
    change: "+12.8%",
    trend: "up",
    description: "Compared to last month",
    icon: ShoppingCart,
    color: "blue",
  },
  {
    title: "Active Suppliers",
    value: "46",
    change: "+5.2%",
    trend: "up",
    description: "Compared to last month",
    icon: Building2,
    color: "purple",
  },
  {
    title: "Pending Requests",
    value: "18",
    change: "-3.4%",
    trend: "down",
    description: "Compared to last month",
    icon: ClipboardList,
    color: "orange",
  },
  {
    title: "Goods Received",
    value: "92",
    change: "+8.6%",
    trend: "up",
    description: "Compared to last month",
    icon: PackageCheck,
    color: "green",
  },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

function StatusBadge({ status }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`ps-status ps-status-${normalized}`}>
      <span className="ps-status-dot" />
      {status}
    </span>
  );
}

function ProcurementSpecialistPage() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [orders, setOrders] = useState(initialOrders);
  const [suppliers] = useState(initialSuppliers);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [newOrder, setNewOrder] = useState({
    supplier: "",
    item: "",
    amount: "",
  });

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(search.toLowerCase()) ||
        order.supplier.toLowerCase().includes(search.toLowerCase()) ||
        order.item.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      return (
        supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        supplier.category.toLowerCase().includes(search.toLowerCase()) ||
        supplier.email.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [suppliers, search]);

  const filteredRequests = useMemo(() => {
    return purchaseRequests.filter((request) => {
      const matchesSearch =
        request.id.toLowerCase().includes(search.toLowerCase()) ||
        request.title.toLowerCase().includes(search.toLowerCase()) ||
        request.department.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const handleNavigation = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
    setSearch("");
    setStatusFilter("All");
  };

  const handleCreateOrder = (event) => {
    event.preventDefault();

    if (
      !newOrder.supplier.trim() ||
      !newOrder.item.trim() ||
      !newOrder.amount ||
      Number(newOrder.amount) <= 0
    ) {
      return;
    }

    const order = {
      id: `PO-2026-${String(
        Math.max(...orders.map((item) => Number(item.id.split("-").pop())), 0) + 1
      ).padStart(3, "0")}`,
      supplier: newOrder.supplier.trim(),
      item: newOrder.item.trim(),
      amount: Number(newOrder.amount),
      date: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: "Pending",
    };

    setOrders((previous) => [order, ...previous]);
    setNewOrder({ supplier: "", item: "", amount: "" });
    setShowOrderModal(false);
    setActivePage("Purchase Orders");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

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
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "etdox-purchase-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderOrders = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Purchase Orders</h3>
          <p>Track and manage your purchase orders.</p>
        </div>

        <button
          className="ps-primary-button"
          onClick={() => setShowOrderModal(true)}
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
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Delivered">Delivered</option>
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
              <tr key={order.id}>
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

            {filteredOrders.length === 0 && (
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
          onClick={() => setShowOrderModal(true)}
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

                <span
                  className={`ps-stat-change ${
                    stat.trend === "up" ? "positive" : "negative"
                  }`}
                >
                  {stat.trend === "up" ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {stat.change}
                </span>
              </div>

              <h3>{stat.value}</h3>
              <p className="ps-stat-title">{stat.title}</p>
              <span className="ps-stat-description">
                {stat.description}
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
              <p>Monthly procurement spending overview</p>
            </div>

            <button className="ps-select-button">
              This Year <ChevronDown size={15} />
            </button>
          </div>

          <div className="ps-spend-summary">
            <div>
              <span>Total Procurement Spend</span>
              <h2>₹24,80,000</h2>
            </div>
            <span className="ps-spend-growth">
              <TrendingUp size={15} /> 12.5%
            </span>
          </div>

          <div className="ps-chart">
            {[
              ["Jan", 48],
              ["Feb", 65],
              ["Mar", 42],
              ["Apr", 75],
              ["May", 58],
              ["Jun", 88],
              ["Jul", 67],
              ["Aug", 78],
              ["Sep", 52],
              ["Oct", 94],
              ["Nov", 72],
              ["Dec", 62],
            ].map(([month, height]) => (
              <div className="ps-chart-column" key={month}>
                <div
                  className="ps-chart-bar"
                  style={{ height: `${height}%` }}
                  title={`${month}: ${height}%`}
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
              <p>Latest procurement updates</p>
            </div>
            <button className="ps-icon-button" aria-label="More activity">
              <MoreHorizontal size={20} />
            </button>
          </div>

          <div className="ps-activity-list">
            <div className="ps-activity-item">
              <div className="ps-activity-icon blue">
                <ShoppingCart size={17} />
              </div>
              <div>
                <strong>Purchase order created</strong>
                <p>PO-2026-004 was created.</p>
                <span>30 minutes ago</span>
              </div>
            </div>

            <div className="ps-activity-item">
              <div className="ps-activity-icon green">
                <CheckCircle2 size={17} />
              </div>
              <div>
                <strong>Goods received</strong>
                <p>Cloud infrastructure delivered.</p>
                <span>2 hours ago</span>
              </div>
            </div>

            <div className="ps-activity-item">
              <div className="ps-activity-icon purple">
                <Building2 size={17} />
              </div>
              <div>
                <strong>Supplier updated</strong>
                <p>Tech Solutions profile updated.</p>
                <span>Yesterday</span>
              </div>
            </div>

            <div className="ps-activity-item">
              <div className="ps-activity-icon orange">
                <ClipboardList size={17} />
              </div>
              <div>
                <strong>Request submitted</strong>
                <p>New laptop request submitted.</p>
                <span>Yesterday</span>
              </div>
            </div>
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
                <tr key={order.id}>
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
                      onClick={() => setSelectedOrder(order)}
                      title="View order"
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderRequests = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Purchase Requests</h3>
          <p>Review incoming purchase requests from departments.</p>
        </div>
        <span className="ps-count-label">18 total requests</span>
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
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Under Review">Under Review</option>
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
              <tr key={request.id}>
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
            {filteredRequests.length === 0 && (
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

  const renderSuppliers = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Supplier Directory</h3>
          <p>View and manage registered suppliers.</p>
        </div>
        <button className="ps-primary-button">
          <Plus size={17} /> Add Supplier
        </button>
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
        <span className="ps-count-label">
          {filteredSuppliers.length} suppliers
        </span>
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
              <tr key={supplier.id}>
                <td className="ps-order-id">{supplier.id}</td>
                <td>{supplier.name}</td>
                <td>{supplier.category}</td>
                <td>{supplier.email}</td>
                <td>
                  <StatusBadge status={supplier.status} />
                </td>
                <td>
                  <button className="ps-icon-button" title="View supplier">
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredSuppliers.length === 0 && (
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

  const renderGoodsReceipts = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Goods Receipts</h3>
          <p>Track deliveries against purchase orders.</p>
        </div>
        <button className="ps-primary-button">
          <Plus size={17} /> Record Receipt
        </button>
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
              <tr key={receipt.id}>
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
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInvoices = () => (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <div>
          <h3>Supplier Invoices</h3>
          <p>Monitor invoice status and matching progress.</p>
        </div>
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
              <tr key={invoice.id}>
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
          </tbody>
        </table>
      </div>
    </div>
  );

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
                  <span className="ps-nav-count">18</span>
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
            <button onClick={() => alert("Contact your organization administrator.")}>
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
                  <div className="ps-notification-item">
                    <AlertCircle size={18} />
                    <div>
                      <strong>Purchase order awaiting review</strong>
                      <span>PO-2026-001 · 30 minutes ago</span>
                    </div>
                  </div>
                  <div className="ps-notification-item">
                    <PackageCheck size={18} />
                    <div>
                      <strong>Goods receipt updated</strong>
                      <span>GR-2026-021 · 2 hours ago</span>
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

          {renderPage()}

          <footer className="ps-footer">
            <span>© 2026 ETDOX Technologies. All rights reserved.</span>
            <span>Enterprise Procurement Platform</span>
          </footer>
        </div>
      </main>

      {showOrderModal && (
        <div
          className="ps-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowOrderModal(false);
            }
          }}
        >
          <div className="ps-modal">
            <div className="ps-modal-header">
              <div>
                <h2>Create Purchase Order</h2>
                <p>Enter the purchase order details below.</p>
              </div>
              <button
                className="ps-icon-button"
                onClick={() => setShowOrderModal(false)}
                aria-label="Close modal"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <label>
                Supplier Name
                <input
                  type="text"
                  placeholder="Enter supplier name"
                  value={newOrder.supplier}
                  onChange={(event) =>
                    setNewOrder({
                      ...newOrder,
                      supplier: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Item / Product
                <input
                  type="text"
                  placeholder="Enter item or product"
                  value={newOrder.item}
                  onChange={(event) =>
                    setNewOrder({
                      ...newOrder,
                      item: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Order Amount (INR)
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={newOrder.amount}
                  onChange={(event) =>
                    setNewOrder({
                      ...newOrder,
                      amount: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <div className="ps-modal-actions">
                <button
                  type="button"
                  className="ps-outline-button"
                  onClick={() => setShowOrderModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ps-primary-button">
                  <Plus size={17} />
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
