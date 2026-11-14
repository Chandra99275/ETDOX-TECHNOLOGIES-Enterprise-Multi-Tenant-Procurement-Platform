
import React, { useMemo, useState } from "react";
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
  Plus,
  Download,
  Filter,
  Eye,
  Check,
  XCircle,
  Clock3,
  TrendingUp,
  TrendingDown,
  Package,
  Building2,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  ShieldCheck,
  LogOut,
  Settings,
  CircleHelp,
  RefreshCw,
  IndianRupee,
  AlertCircle,
  FileText,
  CheckCircle2,
  Activity,
} from "lucide-react";

import "./ProcurementManagerPage.css";

const initialApprovals = [
  {
    id: "PR-2026-1048",
    title: "Laptop Workstations",
    requester: "Rahul Sharma",
    department: "Engineering",
    supplier: "Dell Technologies",
    amount: 485000,
    date: "14 Nov 2026",
    priority: "High",
    status: "Pending",
  },
  {
    id: "PR-2026-1047",
    title: "Office Networking Equipment",
    requester: "Priya Reddy",
    department: "IT",
    supplier: "Cisco Systems",
    amount: 275000,
    date: "14 Nov 2026",
    priority: "Medium",
    status: "Pending",
  },
  {
    id: "PR-2026-1046",
    title: "Office Furniture",
    requester: "Arjun Kumar",
    department: "Administration",
    supplier: "Godrej Interio",
    amount: 126000,
    date: "13 Nov 2026",
    priority: "Low",
    status: "Pending",
  },
  {
    id: "PR-2026-1045",
    title: "Cloud Infrastructure",
    requester: "Sneha Patel",
    department: "Engineering",
    supplier: "Amazon Web Services",
    amount: 320000,
    date: "13 Nov 2026",
    priority: "High",
    status: "Under Review",
  },
];

const initialOrders = [
  {
    id: "PO-2026-0872",
    supplier: "Dell Technologies",
    title: "Laptop Workstations",
    department: "Engineering",
    amount: 485000,
    date: "12 Nov 2026",
    delivery: "22 Nov 2026",
    status: "Approved",
  },
  {
    id: "PO-2026-0871",
    supplier: "Cisco Systems",
    title: "Networking Equipment",
    department: "IT",
    amount: 275000,
    date: "11 Nov 2026",
    delivery: "19 Nov 2026",
    status: "In Transit",
  },
  {
    id: "PO-2026-0870",
    supplier: "Godrej Interio",
    title: "Office Furniture",
    department: "Administration",
    amount: 126000,
    date: "10 Nov 2026",
    delivery: "18 Nov 2026",
    status: "Delivered",
  },
  {
    id: "PO-2026-0869",
    supplier: "Amazon Web Services",
    title: "Cloud Infrastructure",
    department: "Engineering",
    amount: 320000,
    date: "09 Nov 2026",
    delivery: "20 Nov 2026",
    status: "Pending",
  },
];

const suppliers = [
  {
    name: "Dell Technologies",
    category: "IT Hardware",
    orders: 24,
    spend: 1850000,
    rating: 4.8,
    status: "Active",
  },
  {
    name: "Cisco Systems",
    category: "Networking",
    orders: 18,
    spend: 1240000,
    rating: 4.7,
    status: "Active",
  },
  {
    name: "Godrej Interio",
    category: "Office Furniture",
    orders: 12,
    spend: 680000,
    rating: 4.5,
    status: "Active",
  },
  {
    name: "Amazon Web Services",
    category: "Cloud Services",
    orders: 15,
    spend: 980000,
    rating: 4.9,
    status: "Active",
  },
];

const activities = [
  {
    icon: CheckCircle2,
    color: "green",
    title: "Purchase request approved",
    description: "PR-2026-1042 · Dell Technologies",
    time: "10 minutes ago",
  },
  {
    icon: ShoppingCart,
    color: "blue",
    title: "Purchase order created",
    description: "PO-2026-0872 · Engineering",
    time: "45 minutes ago",
  },
  {
    icon: Users,
    color: "purple",
    title: "Supplier profile updated",
    description: "Cisco Systems",
    time: "2 hours ago",
  },
  {
    icon: FileCheck,
    color: "orange",
    title: "Invoice submitted for review",
    description: "INV-2026-0331 · Godrej Interio",
    time: "4 hours ago",
  },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const getStatusClass = (status) =>
  status.toLowerCase().replace(/\s+/g, "-");

function ProcurementManagerPage() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("All");
  const [orderFilter, setOrderFilter] = useState("All");
  const [approvals, setApprovals] = useState(initialApprovals);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState("");

  const pendingCount = approvals.filter(
    (item) => item.status === "Pending"
  ).length;

  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const matchesSearch = [
        item.id,
        item.title,
        item.requester,
        item.department,
        item.supplier,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        approvalFilter === "All" || item.status === approvalFilter;

      return matchesSearch && matchesFilter;
    });
  }, [approvals, search, approvalFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      const matchesSearch = [
        item.id,
        item.title,
        item.supplier,
        item.department,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        orderFilter === "All" || item.status === orderFilter;

      return matchesSearch && matchesFilter;
    });
  }, [orders, search, orderFilter]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const openDetails = (item, type) => {
    setSelectedItem(item);
    setModalType(type);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setModalType("");
  };

  const updateApproval = (id, status) => {
    setApprovals((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );

    showToast(
      status === "Approved"
        ? "Purchase request approved."
        : "Purchase request rejected."
    );

    closeModal();
  };

  const updateOrderStatus = (id, status) => {
    setOrders((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );

    showToast("Purchase order status updated.");
    closeModal();
  };

  const handleExport = () => {
    const rows = [
      ["Order ID", "Supplier", "Item", "Department", "Amount", "Status"],
      ...orders.map((item) => [
        item.id,
        item.supplier,
        item.title,
        item.department,
        item.amount,
        item.status,
      ]),
    ];

    const csv = rows
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
    link.download = "etdox-procurement-orders.csv";
    link.click();
    URL.revokeObjectURL(url);

    showToast("Orders exported successfully.");
  };

  const navigation = [
    {
      label: "WORKSPACE",
      items: [
        { name: "Overview", icon: LayoutDashboard },
        { name: "Approvals", icon: ClipboardList, count: pendingCount },
        { name: "Purchase Orders", icon: ShoppingCart },
        { name: "Suppliers", icon: Truck },
      ],
    },
    {
      label: "MANAGEMENT",
      items: [
        { name: "Budgets", icon: Wallet },
        { name: "Invoices", icon: FileCheck },
        { name: "Analytics", icon: BarChart3 },
      ],
    },
  ];

  const pageDescriptions = {
    Overview: "Monitor procurement operations across your organization.",
    Approvals: "Review and manage purchase requests awaiting your decision.",
    "Purchase Orders": "Track purchase orders and supplier deliveries.",
    Suppliers: "Manage supplier relationships and performance.",
    Budgets: "Monitor departmental budgets and spending.",
    Invoices: "Review invoices and procurement payment progress.",
    Analytics: "Analyze purchasing activity and procurement performance.",
  };

  const renderStatus = (status) => (
    <span className={`pm-status pm-status-${getStatusClass(status)}`}>
      <span className="pm-status-dot" />
      {status}
    </span>
  );

  const renderOverview = () => (
    <>
      <div className="pm-welcome">
        <div>
          <span className="pm-eyebrow">PROCUREMENT MANAGEMENT</span>
          <h2>Good evening, Procurement Manager</h2>
          <p>
            Here is what's happening with your procurement operations today.
          </p>
        </div>

        <div className="pm-welcome-actions">
          <span className="pm-date">
            <CalendarDays size={15} />
            14 November 2026
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
              <TrendingUp size={13} /> 12.5%
            </span>
          </div>
          <h3>128</h3>
          <p className="pm-stat-title">Total Purchase Requests</p>
          <span className="pm-stat-description">
            Compared with last month
          </span>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-top">
            <div className="pm-stat-icon orange">
              <Clock3 size={20} />
            </div>
            <span className="pm-stat-change negative">
              <TrendingDown size={13} /> 4.2%
            </span>
          </div>
          <h3>{pendingCount + 12}</h3>
          <p className="pm-stat-title">Pending Approvals</p>
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
              <TrendingUp size={13} /> 8.4%
            </span>
          </div>
          <h3>76</h3>
          <p className="pm-stat-title">Active Purchase Orders</p>
          <span className="pm-stat-description">
            Across all departments
          </span>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-top">
            <div className="pm-stat-icon green">
              <IndianRupee size={20} />
            </div>
            <span className="pm-stat-change positive">
              <TrendingUp size={13} /> 6.8%
            </span>
          </div>
          <h3>₹42.8L</h3>
          <p className="pm-stat-title">Total Procurement Spend</p>
          <span className="pm-stat-description">
            Current financial period
          </span>
        </div>
      </div>

      <div className="pm-overview-grid">
        <section className="pm-panel pm-spend-panel">
          <div className="pm-panel-header">
            <div>
              <h3>Procurement Spend Overview</h3>
              <p>Monthly purchasing expenditure</p>
            </div>
            <select className="pm-select" defaultValue="2026">
              <option value="2026">Year 2026</option>
              <option value="2025">Year 2025</option>
            </select>
          </div>

          <div className="pm-spend-summary">
            <div>
              <span>Total spend this year</span>
              <h2>₹42,80,000</h2>
            </div>
            <span className="pm-growth">
              <ArrowUpRight size={14} /> 8.6%
            </span>
          </div>

          <div className="pm-chart">
            {[42, 57, 48, 72, 62, 84, 68, 92, 75, 80, 66, 96].map(
              (height, index) => (
                <div className="pm-chart-column" key={index}>
                  <div
                    className="pm-chart-bar"
                    style={{ height: `${height}%` }}
                    title={`Month ${index + 1}`}
                  />
                  <span>
                    {[
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
                    ][index]}
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        <section className="pm-panel pm-activity-panel">
          <div className="pm-panel-header">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest procurement updates</p>
            </div>
            <button
              className="pm-icon-button"
              onClick={() => showToast("Activity list refreshed.")}
              aria-label="Refresh activity"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="pm-activity-list">
            {activities.map((activity, index) => {
              const Icon = activity.icon;

              return (
                <div className="pm-activity-item" key={index}>
                  <div className={`pm-activity-icon ${activity.color}`}>
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
          </div>
        </section>
      </div>

      <section className="pm-panel">
        <div className="pm-panel-header">
          <div>
            <h3>Pending Approval Requests</h3>
            <p>Purchase requests that need your attention</p>
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
              {approvals.slice(0, 3).map((item) => (
                <tr key={item.id}>
                  <td className="pm-id">{item.id}</td>
                  <td>
                    <strong className="pm-cell-title">{item.title}</strong>
                    <span className="pm-cell-subtitle">{item.supplier}</span>
                  </td>
                  <td>{item.requester}</td>
                  <td>{item.department}</td>
                  <td className="pm-amount">{formatCurrency(item.amount)}</td>
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
                      onClick={() => openDetails(item, "approval")}
                      aria-label={`View ${item.id}`}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const renderApprovals = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Approval Management</h3>
          <p>Review purchase requests and make approval decisions.</p>
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
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search requests, suppliers or departments..."
          />
        </div>

        <div className="pm-toolbar-actions">
          <select
            className="pm-filter"
            value={approvalFilter}
            onChange={(event) => setApprovalFilter(event.target.value)}
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
            <Filter size={14} /> Clear filters
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
                <tr key={item.id}>
                  <td className="pm-id">{item.id}</td>
                  <td>
                    <strong className="pm-cell-title">{item.title}</strong>
                    <span className="pm-cell-subtitle">{item.supplier}</span>
                  </td>
                  <td>{item.requester}</td>
                  <td>{item.department}</td>
                  <td className="pm-amount">{formatCurrency(item.amount)}</td>
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
                      onClick={() => openDetails(item, "approval")}
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

  const renderOrders = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Purchase Order Management</h3>
          <p>Monitor order progress and supplier deliveries.</p>
        </div>
        <button className="pm-outline-button" onClick={handleExport}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="pm-toolbar">
        <div className="pm-search pm-table-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search purchase orders..."
          />
        </div>

        <div className="pm-toolbar-actions">
          <select
            className="pm-filter"
            value={orderFilter}
            onChange={(event) => setOrderFilter(event.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Approved">Approved</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Pending">Pending</option>
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
                <tr key={item.id}>
                  <td className="pm-id">{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.supplier}</td>
                  <td>{item.department}</td>
                  <td className="pm-amount">{formatCurrency(item.amount)}</td>
                  <td>{item.date}</td>
                  <td>{item.delivery}</td>
                  <td>{renderStatus(item.status)}</td>
                  <td>
                    <button
                      className="pm-icon-button"
                      onClick={() => openDetails(item, "order")}
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

  const renderSuppliers = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Supplier Management</h3>
          <p>Review supplier information and performance.</p>
        </div>
        <span className="pm-count">{suppliers.length} suppliers</span>
      </div>

      <div className="pm-toolbar">
        <div className="pm-search pm-table-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
                <tr key={supplier.name}>
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
                    <span className="pm-rating">★ {supplier.rating}</span>
                  </td>
                  <td>{renderStatus(supplier.status)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderBudgets = () => (
    <div className="pm-budget-grid">
      {[
        {
          name: "Engineering",
          allocated: 2500000,
          spent: 1850000,
          color: "blue",
        },
        {
          name: "Information Technology",
          allocated: 1800000,
          spent: 1120000,
          color: "purple",
        },
        {
          name: "Administration",
          allocated: 1200000,
          spent: 680000,
          color: "orange",
        },
        {
          name: "Operations",
          allocated: 1500000,
          spent: 920000,
          color: "green",
        },
      ].map((budget) => {
        const percentage = Math.round(
          (budget.spent / budget.allocated) * 100
        );

        return (
          <section className="pm-panel pm-budget-card" key={budget.name}>
            <div className="pm-budget-heading">
              <div className={`pm-budget-icon ${budget.color}`}>
                <Wallet size={19} />
              </div>
              <span className="pm-budget-percent">{percentage}% used</span>
            </div>
            <h3>{budget.name}</h3>
            <p>Department budget utilization</p>
            <div className="pm-budget-values">
              <strong>{formatCurrency(budget.spent)}</strong>
              <span>of {formatCurrency(budget.allocated)}</span>
            </div>
            <div className="pm-progress-track">
              <div
                className={`pm-progress-fill ${budget.color}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="pm-budget-remaining">
              {formatCurrency(budget.allocated - budget.spent)} remaining
            </span>
          </section>
        );
      })}
    </div>
  );

  const renderInvoices = () => (
    <section className="pm-panel">
      <div className="pm-panel-header">
        <div>
          <h3>Invoice Overview</h3>
          <p>Monitor invoice processing and matching progress.</p>
        </div>
      </div>
      <div className="pm-invoice-summary">
        <div>
          <span>Total invoices</span>
          <strong>84</strong>
        </div>
        <div>
          <span>Awaiting review</span>
          <strong>12</strong>
        </div>
        <div>
          <span>Matched</span>
          <strong>61</strong>
        </div>
        <div>
          <span>Exceptions</span>
          <strong>11</strong>
        </div>
      </div>
      <div className="pm-placeholder">
        <FileCheck size={32} />
        <h3>Invoice processing overview</h3>
        <p>
          Connect your invoice API to display invoice records, matching
          results and exception workflows here.
        </p>
      </div>
    </section>
  );

  const renderAnalytics = () => (
    <>
      <div className="pm-stats-grid">
        <div className="pm-stat-card">
          <div className="pm-stat-icon blue">
            <IndianRupee size={20} />
          </div>
          <h3>₹42.8L</h3>
          <p className="pm-stat-title">Total Spend</p>
          <span className="pm-stat-description">Current financial period</span>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-icon green">
            <TrendingDown size={20} />
          </div>
          <h3>8.6%</h3>
          <p className="pm-stat-title">Cost Savings</p>
          <span className="pm-stat-description">Against previous period</span>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-icon purple">
            <Truck size={20} />
          </div>
          <h3>92%</h3>
          <p className="pm-stat-title">Supplier Delivery Rate</p>
          <span className="pm-stat-description">On-time deliveries</span>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-icon orange">
            <Clock3 size={20} />
          </div>
          <h3>2.4 days</h3>
          <p className="pm-stat-title">Average Approval Time</p>
          <span className="pm-stat-description">Request processing time</span>
        </div>
      </div>

      <section className="pm-panel">
        <div className="pm-panel-header">
          <div>
            <h3>Procurement Performance</h3>
            <p>Key performance indicators for procurement operations.</p>
          </div>
        </div>
        <div className="pm-placeholder">
          <BarChart3 size={32} />
          <h3>Procurement analytics</h3>
          <p>
            Connect your analytics endpoints to show live spend trends,
            savings, department comparisons and supplier performance.
          </p>
        </div>
      </section>
    </>
  );

  const renderPageContent = () => {
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

  return (
    <div className="pm-layout">
      {sidebarOpen && (
        <button
          className="pm-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`pm-sidebar ${sidebarOpen ? "open" : ""}`}>
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
          <div className="pm-nav-group" key={group.label}>
            <p className="pm-nav-label">{group.label}</p>
            <nav className="pm-navigation">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.name}
                    className={`pm-nav-item ${
                      activePage === item.name ? "active" : ""
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
                      <span className="pm-nav-count">{item.count}</span>
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
            <p>Contact your platform administrator for support.</p>
            <button onClick={() => showToast("Support contact is not configured.")}>
              Get support <ArrowUpRight size={13} />
            </button>
          </div>

          <button
            className="pm-logout"
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("accessToken");
              localStorage.removeItem("authToken");
              localStorage.removeItem("user");
              window.location.href = "/login";
            }}
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search anything..."
              />
              <kbd>⌘ K</kbd>
            </div>

            <div className="pm-notification-wrapper">
              <button
                className="pm-top-icon"
                onClick={() => {
                  setNotificationOpen(!notificationOpen);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
              >
                <Bell size={19} />
                <span className="pm-notification-dot" />
              </button>

              {notificationOpen && (
                <div className="pm-dropdown pm-notification-dropdown">
                  <h4>Notifications</h4>
                  <div className="pm-notification-item">
                    <AlertCircle size={17} />
                    <div>
                      <strong>Approval required</strong>
                      <span>New purchase request needs review.</span>
                    </div>
                  </div>
                  <div className="pm-notification-item">
                    <Package size={17} />
                    <div>
                      <strong>Delivery update</strong>
                      <span>PO-2026-0871 is in transit.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                  <button onClick={() => showToast("Profile page is not connected.")}>
                    <Users size={15} /> My Profile
                  </button>
                  <button onClick={() => showToast("Settings are not connected.")}>
                    <Settings size={15} /> Settings
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem("token");
                      localStorage.removeItem("accessToken");
                      localStorage.removeItem("authToken");
                      localStorage.removeItem("user");
                      window.location.href = "/login";
                    }}
                  >
                    <LogOut size={15} /> Sign Out
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
            {activePage !== "Overview" && (
              <span className="pm-page-role">
                <ShieldCheck size={14} />
                Procurement Manager
              </span>
            )}
          </div>

          {renderPageContent()}

          <footer className="pm-footer">
            <span>© 2026 ETDOX Technologies. All rights reserved.</span>
            <span>Enterprise Procurement Platform · v1.0</span>
          </footer>
        </div>
      </main>

      {selectedItem && (
        <div className="pm-modal-overlay" onClick={closeModal}>
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
                <p>Review the procurement record details.</p>
              </div>
              <button
                className="pm-icon-button"
                onClick={closeModal}
                aria-label="Close dialog"
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
                  <strong>{selectedItem.requester}</strong>
                </div>
              )}
              <div>
                <span>Supplier</span>
                <strong>{selectedItem.supplier}</strong>
              </div>
              <div>
                <span>Department</span>
                <strong>{selectedItem.department}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{formatCurrency(selectedItem.amount)}</strong>
              </div>
              <div>
                <span>Status</span>
                {renderStatus(selectedItem.status)}
              </div>
              {selectedItem.priority && (
                <div>
                  <span>Priority</span>
                  <strong>{selectedItem.priority}</strong>
                </div>
              )}
              {selectedItem.delivery && (
                <div>
                  <span>Expected delivery</span>
                  <strong>{selectedItem.delivery}</strong>
                </div>
              )}
            </div>

            <div className="pm-modal-actions">
              {modalType === "approval" &&
                selectedItem.status === "Pending" && (
                  <>
                    <button
                      className="pm-danger-button"
                      onClick={() =>
                        updateApproval(selectedItem.id, "Rejected")
                      }
                    >
                      <XCircle size={15} /> Reject
                    </button>
                    <button
                      className="pm-primary-button"
                      onClick={() =>
                        updateApproval(selectedItem.id, "Approved")
                      }
                    >
                      <Check size={15} /> Approve Request
                    </button>
                  </>
                )}

              {modalType === "order" &&
                selectedItem.status !== "Delivered" && (
                  <button
                    className="pm-primary-button"
                    onClick={() =>
                      updateOrderStatus(
                        selectedItem.id,
                        selectedItem.status === "Pending"
                          ? "Approved"
                          : "Delivered"
                      )
                    }
                  >
                    <Check size={15} />
                    {selectedItem.status === "Pending"
                      ? "Mark Approved"
                      : "Mark Delivered"}
                  </button>
                )}

              <button className="pm-outline-button" onClick={closeModal}>
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
