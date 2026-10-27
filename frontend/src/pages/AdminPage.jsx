
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  BriefcaseBusiness,
  ClipboardList,
  ReceiptText,
  MessageSquareWarning,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronDown,
  Plus,
  Download,
  Eye,
  Check,
  Clock3,
  CircleDollarSign,
  Wallet,
  Activity,
  CalendarDays,
  ShieldCheck,
  MoreHorizontal,
  Mail,
  UserRound,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import "./AdminPage.css";

/*
 * ETDOX ADMIN API CONFIGURATION
 *
 * Optional frontend .env:
 * VITE_API_URL=http://localhost:5000
 *
 * This component expects the backend routes listed below.
 * Change these paths if your Express router uses different URLs.
 */

const API_ROOT = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const API = {
  clients: `${API_ROOT}/api/v1/clients`,
  employees: `${API_ROOT}/api/v1/employees`,
  requests: `${API_ROOT}/api/procurement/requests`,
  issues: `${API_ROOT}/api/v1/issues`,
  invoices: `${API_ROOT}/api/v1/invoices`,
  transactions: `${API_ROOT}/api/v1/transactions`,
};

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "clients", label: "Client Management", icon: Building2 },
  { id: "employees", label: "Employees", icon: Users },
  { id: "engagements", label: "Engagements", icon: BriefcaseBusiness },
  { id: "issues", label: "Issues & Feedback", icon: MessageSquareWarning },
  { id: "invoices", label: "Invoices & Payments", icon: ReceiptText },
  { id: "reports", label: "Reports", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
];

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const statusClass = (status = "") =>
  String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const getId = (item) =>
  String(item?._id ?? item?.id ?? item?.requestId ?? item?.invoiceId ?? "");

const getToken = () =>
  sessionStorage.getItem("token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("authToken") ||
  localStorage.getItem("authToken") ||
  "";

function extractArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data) {
    if (Array.isArray(payload.data)) return payload.data;

    for (const key of keys) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }

  if (payload.result) {
    if (Array.isArray(payload.result)) return payload.result;

    for (const key of keys) {
      if (Array.isArray(payload.result[key])) return payload.result[key];
    }
  }

  return [];
}

async function apiRequest(url, options = {}) {
  const token = getToken();
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Cannot connect to the backend at ${API_ROOT}. Start your backend server and check the API URL.`
    );
  }

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed (${response.status}) for ${url.replace(API_ROOT, "")}`;

    throw new Error(message);
  }

  if (payload?.success === false) {
    throw new Error(payload.message || "The server rejected the request.");
  }

  return payload;
}

function normalizeClient(item, index) {
  const contact = item.contactPerson || item.contact || item.primaryContact || {};
  const plan = item.plan || item.subscriptionPlan || item.servicePlan || "Professional";

  return {
    ...item,
    id: getId(item) || `CL-${String(index + 1).padStart(3, "0")}`,
    name: item.name || item.companyName || item.organizationName || item.legalName || "Unnamed client",
    contact:
      typeof contact === "string"
        ? contact
        : contact.name || item.contactName || item.contactPersonName || "Not provided",
    email:
      item.email ||
      item.contactEmail ||
      (typeof contact === "object" ? contact.email : "") ||
      "",
    phone:
      item.phone ||
      item.contactPhone ||
      (typeof contact === "object" ? contact.phone : "") ||
      "",
    plan: typeof plan === "string" ? plan : plan.name || "Professional",
    projects: Number(item.projectsCount ?? item.projectCount ?? item.projects ?? 0),
    status: formatStatus(item.status || "Active"),
  };
}

function normalizeEmployee(item, index) {
  const user = item.user || item.employee || item;

  return {
    ...item,
    id: getId(item) || `EMP-${String(index + 1).padStart(3, "0")}`,
    name:
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.fullName ||
      user.email ||
      "Unnamed employee",
    role: user.role?.name || user.role || item.designation || item.jobTitle || "Employee",
    email: user.email || item.email || "",
    department: item.department?.name || item.department || "Unassigned",
    status: formatStatus(item.status || user.status || "Active"),
  };
}

function normalizeRequest(item, index) {
  const client = item.client || item.company || item.organization || {};
  const submittedBy = item.submittedBy || item.requestedBy || item.createdBy || item.user || {};
  const rawStatus = String(item.status || item.financeStatus || "Pending").toUpperCase();

  let status = "Pending";
  if (["APPROVED", "APPROVED_FINANCE", "ACCEPTED"].includes(rawStatus)) status = "Approved";
  if (["REJECTED", "REJECTED_FINANCE", "DENIED"].includes(rawStatus)) status = "Rejected";
  if (["PENDING_MANAGER", "WAITING_MANAGER"].includes(rawStatus)) status = "Pending Manager";
  if (["PENDING_FINANCE", "WAITING_FINANCE"].includes(rawStatus)) status = "Pending";

  return {
    ...item,
    id: getId(item) || `REQ-${String(index + 1).padStart(3, "0")}`,
    client:
      typeof client === "string"
        ? client
        : client.name || client.companyName || item.clientName || item.companyName || "Unknown client",
    title:
      item.title ||
      item.engagementTitle ||
      item.projectName ||
      item.subject ||
      item.name ||
      item.requestType ||
      "Engagement request",
    type: item.type || item.requestType || item.engagementType || "New engagement",
    date: formatDate(item.createdAt || item.submittedAt || item.date || item.updatedAt),
    status,
    description: item.description || item.requirements || item.justification || item.details || "",
    submittedBy:
      typeof submittedBy === "string"
        ? submittedBy
        : submittedBy.name || submittedBy.email || item.requesterName || "",
    amount: Number(item.amount || item.estimatedCost || item.budget || 0),
  };
}

function normalizeIssue(item, index) {
  const client = item.client || item.company || {};

  return {
    ...item,
    id: getId(item) || `ISS-${String(index + 1).padStart(3, "0")}`,
    title: item.title || item.subject || item.description || "Issue",
    client:
      typeof client === "string"
        ? client
        : client.name || item.clientName || "Unknown client",
    priority: formatStatus(item.priority || "Medium"),
    status: formatStatus(item.status || "Open"),
    date: formatDate(item.createdAt || item.reportedAt || item.date),
    description: item.description || item.message || item.details || "",
  };
}

function normalizeInvoice(item, index) {
  const client = item.client || item.company || {};
  const amount = Number(item.amount ?? item.totalAmount ?? item.total ?? 0);
  const paid = Number(item.paidAmount ?? item.amountPaid ?? item.paid ?? 0);

  let status = item.status || "";
  if (!status) {
    status = paid <= 0 ? "Unpaid" : paid >= amount ? "Paid" : "Partially Paid";
  }

  return {
    ...item,
    id: getId(item) || item.invoiceNumber || `INV-${String(index + 1).padStart(3, "0")}`,
    client:
      typeof client === "string"
        ? client
        : client.name || item.clientName || item.companyName || "Unknown client",
    amount,
    paid,
    due: formatDate(item.dueDate || item.due || item.paymentDueDate),
    status: formatStatus(status),
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value) {
  if (!value) return "Pending";

  return String(value)
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function AdminPage() {
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [issues, setIssues] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [clientFilter, setClientFilter] = useState("All");
  const [invoiceFilter, setInvoiceFilter] = useState("All");
  const [issueFilter, setIssueFilter] = useState("All");

  const [showClientForm, setShowClientForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [saving, setSaving] = useState(false);

  const [newClient, setNewClient] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    plan: "Professional",
  });

  const [newInvoice, setNewInvoice] = useState({
    client: "",
    amount: "",
    due: "",
  });

  const [newIssue, setNewIssue] = useState({
    title: "",
    client: "",
    priority: "Medium",
    description: "",
  });

  const [newRequest, setNewRequest] = useState({
    client: "",
    title: "",
    type: "New engagement",
    description: "",
  });

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setErrors([]);

    const jobs = [
      {
        label: "Clients",
        url: API.clients,
        keys: ["clients", "items", "results"],
        setter: setClients,
        normalize: normalizeClient,
      },
      {
        label: "Employees",
        url: API.employees,
        keys: ["employees", "users", "items", "results"],
        setter: setEmployees,
        normalize: normalizeEmployee,
      },
      {
        label: "Engagement requests",
        url: API.requests,
        keys: ["requests", "engagements", "items", "results"],
        setter: setRequests,
        normalize: normalizeRequest,
      },
      {
        label: "Issues",
        url: API.issues,
        keys: ["issues", "feedback", "items", "results"],
        setter: setIssues,
        normalize: normalizeIssue,
      },
      {
        label: "Invoices",
        url: API.invoices,
        keys: ["invoices", "items", "results"],
        setter: setInvoices,
        normalize: normalizeInvoice,
      },
      {
        label: "Transactions",
        url: API.transactions,
        keys: ["transactions", "payments", "items", "results"],
        setter: setTransactions,
        normalize: (item) => item,
      },
    ];

    const failures = [];

    await Promise.all(
      jobs.map(async (job) => {
        try {
          const payload = await apiRequest(job.url);
          const list = extractArray(payload, job.keys);
          job.setter(list.map(job.normalize));
        } catch (error) {
          failures.push(`${job.label}: ${error.message}`);
        }
      })
    );

    setErrors(failures);
    setLastUpdated(new Date());
    setLoading(false);

    if (failures.length === 0) {
      notify("Company data refreshed successfully.");
    }
  }, [notify]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const goTo = (page) => {
    setActivePage(page);
    setSearch("");
    setSidebarOpen(false);
  };

  const filteredClients = useMemo(
    () =>
      clients.filter((item) => {
        const matches = `${item.name} ${item.contact} ${item.email} ${item.id}`
          .toLowerCase()
          .includes(search.toLowerCase());

        return matches && (clientFilter === "All" || item.status === clientFilter);
      }),
    [clients, search, clientFilter]
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((item) =>
        `${item.name} ${item.role} ${item.department} ${item.email}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [employees, search]
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((item) =>
        `${item.client} ${item.title} ${item.id} ${item.type} ${item.status}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [requests, search]
  );

  const filteredIssues = useMemo(
    () =>
      issues.filter((item) => {
        const matches = `${item.title} ${item.client} ${item.id} ${item.description}`
          .toLowerCase()
          .includes(search.toLowerCase());

        return matches && (issueFilter === "All" || item.status === issueFilter);
      }),
    [issues, search, issueFilter]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((item) => {
        const matches = `${item.id} ${item.client}`
          .toLowerCase()
          .includes(search.toLowerCase());

        return matches && (invoiceFilter === "All" || item.status === invoiceFilter);
      }),
    [invoices, search, invoiceFilter]
  );

  const totalBilled = invoices.reduce((sum, item) => sum + item.amount, 0);
  const totalRevenue = invoices.reduce((sum, item) => sum + item.paid, 0);
  const outstanding = invoices.reduce((sum, item) => sum + Math.max(0, item.amount - item.paid), 0);
  const pendingRequests = requests.filter((item) => item.status === "Pending").length;
  const openIssues = issues.filter((item) => item.status !== "Resolved" && item.status !== "Closed").length;
  const activeEmployees = employees.filter((item) => item.status === "Active").length;

  const mutate = async (url, method, body, successMessage) => {
    setSaving(true);

    try {
      await apiRequest(url, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      notify(successMessage);
      await loadFinanceData();
      return true;
    } catch (error) {
      notify(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const decideRequest = async (request, decision) => {
    const id = getId(request);

    if (!id) {
      notify("This request has no database ID. Check the backend response.");
      return;
    }

    const ok = window.confirm(
      `${decision === "APPROVE" ? "Approve" : "Reject"} "${request.title}" for ${request.client}?`
    );

    if (!ok) return;

    /*
     * Expected backend route:
     * PATCH /api/procurement/requests/:id/finance-decision
     * Body: { decision: "APPROVE" } or { decision: "REJECT" }
     */
    await mutate(
      `${API.requests}/${encodeURIComponent(id)}/finance-decision`,
      "PATCH",
      { decision },
      `Request ${decision === "APPROVE" ? "approved" : "rejected"}.`
    );
  };

  const updateIssueStatus = async (issue, status) => {
    const id = getId(issue);

    if (!id) {
      notify("This issue has no database ID.");
      return;
    }

    await mutate(
      `${API.issues}/${encodeURIComponent(id)}/status`,
      "PATCH",
      { status },
      `Issue status updated to ${status}.`
    );
  };

  const addClient = async (event) => {
    event.preventDefault();

    if (!newClient.name.trim() || !newClient.email.trim()) {
      notify("Company name and email are required.");
      return;
    }

    const payload = {
      name: newClient.name.trim(),
      companyName: newClient.name.trim(),
      contactName: newClient.contact.trim(),
      contactPerson: newClient.contact.trim(),
      email: newClient.email.trim(),
      contactEmail: newClient.email.trim(),
      phone: newClient.phone.trim(),
      contactPhone: newClient.phone.trim(),
      plan: newClient.plan,
    };

    const ok = await mutate(API.clients, "POST", payload, "Client created successfully.");

    if (ok) {
      setNewClient({ name: "", contact: "", email: "", phone: "", plan: "Professional" });
      setShowClientForm(false);
    }
  };

  const addInvoice = async (event) => {
    event.preventDefault();

    const amount = Number(newInvoice.amount);

    if (!newInvoice.client || !Number.isFinite(amount) || amount <= 0 || !newInvoice.due) {
      notify("Enter a client, a valid invoice amount, and a due date.");
      return;
    }

    /*
     * Expected endpoint:
     * POST /api/v1/invoices
     * Your backend may require clientId rather than clientName.
     */
    const client = clients.find(
      (item) => item.id === newInvoice.client || item.name === newInvoice.client
    );

    const ok = await mutate(
      API.invoices,
      "POST",
      {
        clientId: client?._id || client?.id || newInvoice.client,
        clientName: client?.name || newInvoice.client,
        amount,
        totalAmount: amount,
        dueDate: newInvoice.due,
        status: "UNPAID",
      },
      "Invoice created successfully."
    );

    if (ok) {
      setNewInvoice({ client: "", amount: "", due: "" });
      setShowInvoiceForm(false);
    }
  };

  const recordPayment = async (invoice) => {
    const remaining = Math.max(0, invoice.amount - invoice.paid);

    if (remaining <= 0) {
      notify("This invoice is already fully paid.");
      return;
    }

    const raw = window.prompt(`Outstanding balance: ${money(remaining)}\nEnter payment received (₹):`);
    if (raw === null) return;

    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid payment amount.");
      return;
    }

    if (amount > remaining) {
      notify("Payment cannot exceed the outstanding balance.");
      return;
    }

    const id = getId(invoice);

    if (!id) {
      notify("This invoice has no database ID.");
      return;
    }

    /*
     * Expected backend route:
     * PATCH /api/procurement/invoices/:id/payment
     * Body: { amount }
     *
     * Change this URL if your backend uses another payment route.
     */
    await mutate(
      `${API_ROOT}/api/procurement/invoices/${encodeURIComponent(id)}/payment`,
      "PATCH",
      { amount },
      "Payment recorded successfully."
    );
  };

  const addIssue = async (event) => {
    event.preventDefault();

    if (!newIssue.title.trim() || !newIssue.client) {
      notify("Enter an issue title and select a client.");
      return;
    }

    const client = clients.find(
      (item) => item.id === newIssue.client || item.name === newIssue.client
    );

    const ok = await mutate(
      API.issues,
      "POST",
      {
        title: newIssue.title.trim(),
        clientId: client?._id || client?.id || newIssue.client,
        clientName: client?.name || newIssue.client,
        priority: newIssue.priority,
        description: newIssue.description.trim(),
        status: "OPEN",
      },
      "Issue submitted successfully."
    );

    if (ok) {
      setNewIssue({ title: "", client: "", priority: "Medium", description: "" });
      setShowIssueForm(false);
    }
  };

  const addRequest = async (event) => {
    event.preventDefault();

    if (!newRequest.client || !newRequest.title.trim()) {
      notify("Select a client and enter an engagement title.");
      return;
    }

    const client = clients.find(
      (item) => item.id === newRequest.client || item.name === newRequest.client
    );

    const ok = await mutate(
      API.requests,
      "POST",
      {
        clientId: client?._id || client?.id || newRequest.client,
        clientName: client?.name || newRequest.client,
        title: newRequest.title.trim(),
        type: newRequest.type,
        description: newRequest.description.trim(),
        status: "PENDING_FINANCE",
      },
      "Engagement request submitted successfully."
    );

    if (ok) {
      setNewRequest({ client: "", title: "", type: "New engagement", description: "" });
      setShowRequestForm(false);
    }
  };

  const exportCsv = (filename, rows) => {
    if (!rows.length) {
      notify("There is no data to export.");
      return;
    }

    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
    notify("CSV report exported.");
  };

  const logout = () => {
    sessionStorage.removeItem("adminLoggedIn");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    navigate("/admin/login");
  };

  const pageTitle = navItems.find((item) => item.id === activePage)?.label || "Overview";

  const renderToolbar = (placeholder, filter = null) => (
    <div className="admin-table-toolbar">
      <Search size={16} className="admin-toolbar-search-icon" />
      <input
        className="admin-table-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
      />
      {filter}
    </div>
  );

  const renderOverview = () => (
    <>
      <section className="admin-welcome">
        <div className="admin-welcome-copy">
          <span className="admin-eyebrow">ADMINISTRATOR WORKSPACE</span>
          <h2>Company overview <span>✦</span></h2>
          <p>Monitor your clients, workforce, engagement approvals, issues, invoices, and company payments from one place.</p>
          <div className="admin-welcome-actions">
            <button className="admin-btn admin-btn-primary" onClick={() => goTo("engagements")}>
              Review requests <ArrowUpRight size={15} />
            </button>
            <button className="admin-btn admin-btn-outline" onClick={loadFinanceData}>
              <RefreshCw size={15} /> Refresh data
            </button>
          </div>
        </div>
        <div className="admin-welcome-art" aria-hidden="true">
          <div className="admin-orbit admin-orbit-one" />
          <div className="admin-orbit admin-orbit-two" />
          <div className="admin-art-center"><ShieldCheck size={47} strokeWidth={1.5} /></div>
          <div className="admin-art-chip"><Activity size={15} /> Company workspace</div>
        </div>
      </section>

      <section className="admin-stats-grid">
        <StatCard title="Total Clients" value={clients.length} note="From backend" icon={Building2} tone="purple" onClick={() => goTo("clients")} />
        <StatCard title="Active Employees" value={activeEmployees} note={`${employees.length} total employees`} icon={Users} tone="blue" onClick={() => goTo("employees")} />
        <StatCard title="Payments Received" value={money(totalRevenue)} note="From invoice records" icon={Wallet} tone="green" onClick={() => goTo("invoices")} />
        <StatCard title="Outstanding" value={money(outstanding)} note="Unpaid invoice balance" icon={Clock3} tone="orange" onClick={() => goTo("invoices")} />
      </section>

      <section className="admin-overview-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div><h3>Financial summary</h3><p>Calculated from loaded invoice records</p></div>
            <button className="admin-icon-button" onClick={() => goTo("invoices")} aria-label="View invoices"><ArrowUpRight size={17} /></button>
          </div>
          <div className="admin-invoice-summary">
            <div><span>Total invoiced</span><strong>{money(totalBilled)}</strong></div>
            <div><span>Payments received</span><strong className="summary-green">{money(totalRevenue)}</strong></div>
            <div><span>Outstanding</span><strong className="summary-orange">{money(outstanding)}</strong></div>
          </div>
          <div className="admin-collection-bar">
            <span
              className="collection-paid"
              style={{ width: `${totalBilled ? Math.min(100, (totalRevenue / totalBilled) * 100) : 0}%` }}
            />
          </div>
          <p className="admin-footnote">
            {totalBilled ? `${((totalRevenue / totalBilled) * 100).toFixed(1)}% of invoiced value collected.` : "No invoice data is available yet."}
          </p>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div><h3>Work needing attention</h3><p>Live counts from loaded company data</p></div>
            <Activity size={19} />
          </div>
          <div className="admin-setting-row"><div><strong>Pending engagements</strong><p>Awaiting review</p></div><span>{pendingRequests}</span></div>
          <div className="admin-setting-row"><div><strong>Open issues</strong><p>Not yet resolved</p></div><span>{openIssues}</span></div>
          <div className="admin-setting-row"><div><strong>Outstanding invoices</strong><p>Require payment</p></div><span>{invoices.filter((item) => item.amount > item.paid).length}</span></div>
          <button className="admin-link-button" onClick={() => goTo("engagements")}>Review engagements <ChevronRight size={15} /></button>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h3>Recent engagement requests</h3><p>Requests submitted to the company</p></div>
          <button className="admin-link-button" onClick={() => goTo("engagements")}>View all <ChevronRight size={14} /></button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Request</th><th>Client</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {requests.slice(0, 5).map((request) => (
                <tr key={request.id}>
                  <td><div className="admin-table-primary">{request.title}</div><div className="admin-table-secondary">{request.id}</div></td>
                  <td>{request.client}</td>
                  <td>{request.date}</td>
                  <td><StatusBadge status={request.status} /></td>
                  <td><button className="admin-row-action" onClick={() => goTo("engagements")} aria-label="Review request"><Eye size={15} /></button></td>
                </tr>
              ))}
              {!requests.length && <EmptyRow columns={5} />}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h3>Latest transactions</h3><p>Transaction records returned by the backend</p></div>
          <button className="admin-icon-button" onClick={() => goTo("invoices")} aria-label="View payments"><ArrowUpRight size={17} /></button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Transaction</th><th>Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {transactions.slice(0, 5).map((item, index) => (
                <tr key={getId(item) || index}>
                  <td>{item.description || item.type || item.transactionType || "Payment"}</td>
                  <td>{item.reference || item.referenceNumber || item.invoiceNumber || getId(item) || "—"}</td>
                  <td>{money(item.amount || item.totalAmount || 0)}</td>
                  <td><StatusBadge status={formatStatus(item.status || "Recorded")} /></td>
                  <td>{formatDate(item.createdAt || item.date || item.transactionDate)}</td>
                </tr>
              ))}
              {!transactions.length && <EmptyRow columns={5} />}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const renderClients = () => (
    <section className="admin-panel admin-data-panel">
      <div className="admin-panel-heading">
        <div><h3>Client directory</h3><p>Company profiles and contact information from the backend</p></div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowClientForm(true)}><Plus size={16} /> Add Client</button>
      </div>
      {renderToolbar("Search clients, contacts, email...", (
        <select className="admin-filter-select" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
          <option>All</option><option>Active</option><option>Pending</option><option>Inactive</option>
        </select>
      ))}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Client</th><th>Contact person</th><th>Plan</th><th>Projects</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id}>
                <td><div className="admin-table-primary">{client.name}</div><div className="admin-table-secondary">{client.id}</div></td>
                <td><div className="admin-contact-cell"><strong>{client.contact}</strong><span>{client.email}</span>{client.phone && <span>{client.phone}</span>}</div></td>
                <td><span className="admin-plan-tag">{client.plan}</span></td>
                <td>{client.projects}</td>
                <td><StatusBadge status={client.status} /></td>
                <td><button className="admin-row-action" onClick={() => setSelectedClient(client)} aria-label={`View ${client.name}`}><Eye size={16} /></button></td>
              </tr>
            ))}
            {!filteredClients.length && <EmptyRow columns={6} />}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderEmployees = () => (
    <section className="admin-panel admin-data-panel">
      <div className="admin-panel-heading"><div><h3>Employee directory</h3><p>Workforce records loaded from the employee API</p></div><span className="admin-count-label">{employees.length} employees</span></div>
      {renderToolbar("Search name, role, department, or email...")}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {filteredEmployees.map((employee) => (
              <tr key={employee.id}>
                <td><div className="admin-employee-cell"><div className="admin-avatar">{employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><div className="admin-table-primary">{employee.name}</div><div className="admin-table-secondary">{employee.id}</div></div></div></td>
                <td>{employee.role}</td><td>{employee.department}</td><td>{employee.email}</td><td><StatusBadge status={employee.status} /></td>
              </tr>
            ))}
            {!filteredEmployees.length && <EmptyRow columns={5} />}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderEngagements = () => (
    <section className="admin-panel admin-data-panel">
      <div className="admin-panel-heading">
        <div><h3>Engagement requests</h3><p>Review client requirements and persist approval decisions</p></div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowRequestForm(true)}><Plus size={15} /> New Request</button>
      </div>
      {renderToolbar("Search requests, clients, type, or status...", <span className="admin-count-label">{pendingRequests} pending</span>)}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Request</th><th>Client / requester</th><th>Type</th><th>Submitted</th><th>Estimated amount</th><th>Status</th><th>Decision</th></tr></thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id}>
                <td><div className="admin-table-primary">{request.title}</div><div className="admin-table-secondary">{request.id}</div>{request.description && <div className="admin-table-secondary">{request.description}</div>}</td>
                <td>{request.client}<div className="admin-table-secondary">{request.submittedBy}</div></td>
                <td>{request.type}</td><td>{request.date}</td>
                <td>{request.amount ? money(request.amount) : "—"}</td>
                <td><StatusBadge status={request.status} /></td>
                <td>
                  {request.status === "Pending" ? (
                    <div className="admin-decision-actions">
                      <button disabled={saving} className="admin-approve-button" onClick={() => decideRequest(request, "APPROVE")}><Check size={14} /> Approve</button>
                      <button disabled={saving} className="admin-reject-button" onClick={() => decideRequest(request, "REJECT")}><X size={14} /> Deny</button>
                    </div>
                  ) : <span className="admin-table-secondary">Decision recorded</span>}
                </td>
              </tr>
            ))}
            {!filteredRequests.length && <EmptyRow columns={7} />}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderIssues = () => (
    <section className="admin-panel admin-data-panel">
      <div className="admin-panel-heading">
        <div><h3>Issues & feedback</h3><p>Client issues, feedback, and work in progress</p></div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowIssueForm(true)}><Plus size={15} /> Report Issue</button>
      </div>
      {renderToolbar("Search issues or clients...", (
        <select className="admin-filter-select" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)}>
          <option>All</option><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option>
        </select>
      ))}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Issue</th><th>Client</th><th>Priority</th><th>Reported</th><th>Status</th><th>Update status</th></tr></thead>
          <tbody>
            {filteredIssues.map((issue) => (
              <tr key={issue.id}>
                <td><div className="admin-table-primary">{issue.title}</div><div className="admin-table-secondary">{issue.id}</div>{issue.description && <div className="admin-table-secondary">{issue.description}</div>}</td>
                <td>{issue.client}</td><td><StatusBadge status={issue.priority} /></td><td>{issue.date}</td><td><StatusBadge status={issue.status} /></td>
                <td>
                  <select disabled={saving} className="admin-status-select" value={issue.status} onChange={(event) => updateIssueStatus(issue, event.target.value)}>
                    <option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option>
                  </select>
                </td>
              </tr>
            ))}
            {!filteredIssues.length && <EmptyRow columns={6} />}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderInvoices = () => (
    <section className="admin-panel admin-data-panel">
      <div className="admin-panel-heading">
        <div><h3>Invoices & payments</h3><p>Invoice balances and payment records from the backend</p></div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowInvoiceForm(true)}><Plus size={15} /> Create Invoice</button>
      </div>
      <div className="admin-invoice-summary">
        <div><span>Total invoiced</span><strong>{money(totalBilled)}</strong></div>
        <div><span>Payments received</span><strong className="summary-green">{money(totalRevenue)}</strong></div>
        <div><span>Outstanding balance</span><strong className="summary-orange">{money(outstanding)}</strong></div>
      </div>
      {renderToolbar("Search invoice or client...", (
        <select className="admin-filter-select" value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value)}>
          <option>All</option><option>Paid</option><option>Partially Paid</option><option>Unpaid</option><option>Overdue</option>
        </select>
      ))}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td><div className="admin-table-primary">{invoice.id}</div></td>
                <td>{invoice.client}</td><td>{money(invoice.amount)}</td>
                <td className="admin-money-green">{money(invoice.paid)}</td>
                <td className="admin-money-orange">{money(Math.max(0, invoice.amount - invoice.paid))}</td>
                <td>{invoice.due}</td><td><StatusBadge status={invoice.status} /></td>
                <td>
                  <div className="admin-inline-actions">
                    <button className="admin-row-action" onClick={() => setSelectedInvoice(invoice)} title="View invoice"><Eye size={15} /></button>
                    {invoice.paid < invoice.amount && <button disabled={saving} className="admin-row-action admin-payment-action" onClick={() => recordPayment(invoice)} title="Record partial payment"><CircleDollarSign size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {!filteredInvoices.length && <EmptyRow columns={8} />}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderReports = () => (
    <div className="admin-report-grid">
      <ReportCard icon={Building2} title="Client directory" description="Export client profiles and contact information." count={`${clients.length} records`} onClick={() => exportCsv("etdox-clients.csv", clients)} />
      <ReportCard icon={Users} title="Employee directory" description="Export employee roles and departments." count={`${employees.length} records`} onClick={() => exportCsv("etdox-employees.csv", employees)} />
      <ReportCard icon={ReceiptText} title="Invoice report" description="Export invoice amounts, payments, and balances." count={`${invoices.length} invoices`} onClick={() => exportCsv("etdox-invoices.csv", invoices)} />
      <ReportCard icon={BriefcaseBusiness} title="Engagement report" description="Export client requirements and approval status." count={`${requests.length} requests`} onClick={() => exportCsv("etdox-engagements.csv", requests)} />
      <ReportCard icon={MessageSquareWarning} title="Issues report" description="Export issues, priorities, and statuses." count={`${issues.length} issues`} onClick={() => exportCsv("etdox-issues.csv", issues)} />
      <ReportCard icon={Activity} title="Transactions report" description="Export recorded transaction data." count={`${transactions.length} transactions`} onClick={() => exportCsv("etdox-transactions.csv", transactions)} />
    </div>
  );

  const renderSettings = () => (
    <div className="admin-settings-grid">
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h3>Workspace settings</h3><p>ETDOX organization information</p></div><Settings size={19} /></div>
        <div className="admin-setting-row"><div><strong>Organization name</strong><p>ETDOX Business Platform</p></div><span>Configured</span></div>
        <div className="admin-setting-row"><div><strong>API server</strong><p>{API_ROOT}</p></div><span>Local API</span></div>
        <div className="admin-setting-row"><div><strong>Authentication</strong><p>Bearer token from login</p></div><span>{getToken() ? "Token found" : "No token found"}</span></div>
        <div className="admin-setting-row"><div><strong>Last refreshed</strong><p>{lastUpdated ? lastUpdated.toLocaleTimeString() : "Not refreshed"}</p></div><button className="admin-btn admin-btn-outline" onClick={loadFinanceData}><RefreshCw size={14} /> Refresh</button></div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h3>API health</h3><p>Data sources and any errors returned</p></div><Activity size={19} /></div>
        {errors.length === 0 ? (
          <div className="admin-setting-row"><div><strong>Data loading</strong><p>No API errors from the most recent refresh</p></div><span>OK</span></div>
        ) : errors.map((error) => (
          <div className="admin-setting-row" key={error}><div><strong>{error.split(":")[0]}</strong><p>{error.substring(error.indexOf(":") + 1)}</p></div><AlertCircle size={18} /></div>
        ))}
      </section>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "clients": return renderClients();
      case "employees": return renderEmployees();
      case "engagements": return renderEngagements();
      case "issues": return renderIssues();
      case "invoices": return renderInvoices();
      case "reports": return renderReports();
      case "settings": return renderSettings();
      default: return renderOverview();
    }
  };

  return (
    <div className="admin-dashboard">
      {sidebarOpen && <button className="admin-sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${sidebarOpen ? "admin-sidebar-open" : ""}`}>
        <div className="admin-brand">
          <div className="admin-brand-mark">e</div>
          <div className="admin-brand-copy"><strong>ETDOX</strong><span>BUSINESS PLATFORM</span></div>
          <button className="admin-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>

        <div className="admin-sidebar-label">WORKSPACE</div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const count = item.id === "engagements" ? pendingRequests : item.id === "issues" ? openIssues : 0;

            return (
              <button key={item.id} className={`admin-nav-item ${activePage === item.id ? "active" : ""}`} onClick={() => goTo(item.id)}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {count > 0 && <span className="admin-nav-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-spacer" />
        <div className="admin-security-card">
          <div className="admin-security-icon"><ShieldCheck size={20} /></div>
          <strong>Company workspace</strong>
          <p>Review company data and keep business records up to date.</p>
          <button onClick={() => goTo("settings")}>API settings <ArrowUpRight size={14} /></button>
        </div>
        <button className="admin-logout" onClick={logout}><LogOut size={17} /><span>Sign out</span></button>
        <div className="admin-sidebar-version">ETDOX Admin · Connected workspace</div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div><div className="admin-breadcrumb">Workspace <ChevronRight size={12} /> <span>{pageTitle}</span></div><h1>{pageTitle}</h1></div>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-date-display"><CalendarDays size={15} /><span>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
            <button className="admin-notification-button" aria-label="Notifications" onClick={() => notify(`${pendingRequests} pending requests and ${openIssues} open issues need attention.`)}><Bell size={18} /><span /></button>
            <button className="admin-icon-button" onClick={loadFinanceData} title="Refresh data" aria-label="Refresh data"><RefreshCw size={17} /></button>
            <div className="admin-profile"><div className="admin-profile-avatar">AD</div><div><strong>Administrator</strong><span>Super Admin</span></div><ChevronDown size={15} /></div>
          </div>
        </header>

        <div className="admin-page-content">
          {loading && <div className="admin-footnote"><RefreshCw size={14} /> Loading company data from the backend…</div>}

          {errors.length > 0 && (
            <section className="admin-api-error" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>Some company data could not be loaded.</strong>
                {errors.map((error) => <p key={error}>{error}</p>)}
                <p>Check the API routes, backend logs, authentication token, and CORS configuration.</p>
                <button className="admin-btn admin-btn-outline" onClick={loadFinanceData}><RefreshCw size={14} /> Retry</button>
              </div>
            </section>
          )}

          {renderPage()}

          {activePage !== "overview" && <div className="admin-page-bottom-note"><ShieldCheck size={15} /> ETDOX Admin Workspace <span>•</span> Company data dashboard</div>}
        </div>
      </main>

      {toast && <div className="admin-toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast("")} aria-label="Dismiss notification"><X size={15} /></button></div>}

      {showClientForm && (
        <Modal title="Add new client" subtitle="Create a company client profile" onClose={() => setShowClientForm(false)}>
          <form className="admin-form" onSubmit={addClient}>
            <FormField label="Company name"><input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Company name" required /></FormField>
            <FormField label="Contact person"><input value={newClient.contact} onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })} placeholder="Contact person's full name" /></FormField>
            <FormField label="Contact email"><input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="contact@company.com" required /></FormField>
            <FormField label="Contact phone"><input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="Phone number" /></FormField>
            <FormField label="Service plan"><select value={newClient.plan} onChange={(e) => setNewClient({ ...newClient, plan: e.target.value })}><option>Starter</option><option>Professional</option><option>Enterprise</option></select></FormField>
            <ModalActions onCancel={() => setShowClientForm(false)} submitLabel={saving ? "Saving…" : "Create client"} disabled={saving} />
          </form>
        </Modal>
      )}

      {showInvoiceForm && (
        <Modal title="Create invoice" subtitle="Create an invoice in the connected backend" onClose={() => setShowInvoiceForm(false)}>
          <form className="admin-form" onSubmit={addInvoice}>
            <FormField label="Client"><select value={newInvoice.client} onChange={(e) => setNewInvoice({ ...newInvoice, client: e.target.value })} required><option value="">Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></FormField>
            <FormField label="Invoice amount (₹)"><input type="number" min="1" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} placeholder="50000" required /></FormField>
            <FormField label="Due date"><input type="date" value={newInvoice.due} onChange={(e) => setNewInvoice({ ...newInvoice, due: e.target.value })} required /></FormField>
            <ModalActions onCancel={() => setShowInvoiceForm(false)} submitLabel={saving ? "Saving…" : "Create invoice"} disabled={saving} />
          </form>
        </Modal>
      )}

      {showIssueForm && (
        <Modal title="Report an issue" subtitle="Record a client issue or feedback item" onClose={() => setShowIssueForm(false)}>
          <form className="admin-form" onSubmit={addIssue}>
            <FormField label="Issue title"><input value={newIssue.title} onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })} placeholder="Describe the issue briefly" required /></FormField>
            <FormField label="Client"><select value={newIssue.client} onChange={(e) => setNewIssue({ ...newIssue, client: e.target.value })} required><option value="">Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></FormField>
            <FormField label="Priority"><select value={newIssue.priority} onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></FormField>
            <FormField label="Description"><textarea rows="3" value={newIssue.description} onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })} placeholder="Explain the issue or feedback" /></FormField>
            <ModalActions onCancel={() => setShowIssueForm(false)} submitLabel={saving ? "Saving…" : "Submit issue"} disabled={saving} />
          </form>
        </Modal>
      )}

      {showRequestForm && (
        <Modal title="New engagement request" subtitle="Submit a requirement to the backend for review" onClose={() => setShowRequestForm(false)}>
          <form className="admin-form" onSubmit={addRequest}>
            <FormField label="Client"><select value={newRequest.client} onChange={(e) => setNewRequest({ ...newRequest, client: e.target.value })} required><option value="">Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></FormField>
            <FormField label="Engagement title"><input value={newRequest.title} onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })} placeholder="e.g. Website development" required /></FormField>
            <FormField label="Request type"><select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}><option>New engagement</option><option>Additional scope</option><option>Change request</option><option>Support request</option></select></FormField>
            <FormField label="Requirements"><textarea rows="4" value={newRequest.description} onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })} placeholder="Describe the client's requirements" /></FormField>
            <ModalActions onCancel={() => setShowRequestForm(false)} submitLabel={saving ? "Submitting…" : "Submit request"} disabled={saving} />
          </form>
        </Modal>
      )}

      {selectedClient && (
        <Modal title={selectedClient.name} subtitle="Client profile details" onClose={() => setSelectedClient(null)}>
          <div className="admin-detail-list">
            <DetailRow icon={Building2} label="Client ID" value={selectedClient.id} />
            <DetailRow icon={UserRound} label="Contact person" value={selectedClient.contact} />
            <DetailRow icon={Mail} label="Email address" value={selectedClient.email} />
            <DetailRow icon={UserRound} label="Phone" value={selectedClient.phone || "Not provided"} />
            <DetailRow icon={BriefcaseBusiness} label="Service plan" value={selectedClient.plan} />
            <DetailRow icon={ClipboardList} label="Projects" value={String(selectedClient.projects)} />
            <DetailRow icon={CheckCircle2} label="Status" value={selectedClient.status} />
          </div>
          <ModalActions onCancel={() => setSelectedClient(null)} submitLabel="Close" />
        </Modal>
      )}

      {selectedInvoice && (
        <Modal title={selectedInvoice.id} subtitle="Invoice and payment details" onClose={() => setSelectedInvoice(null)}>
          <div className="admin-detail-list">
            <DetailRow icon={Building2} label="Client" value={selectedInvoice.client} />
            <DetailRow icon={CircleDollarSign} label="Invoice amount" value={money(selectedInvoice.amount)} />
            <DetailRow icon={CheckCircle2} label="Amount paid" value={money(selectedInvoice.paid)} />
            <DetailRow icon={Wallet} label="Balance due" value={money(Math.max(0, selectedInvoice.amount - selectedInvoice.paid))} />
            <DetailRow icon={CalendarDays} label="Due date" value={selectedInvoice.due} />
            <DetailRow icon={FileText} label="Status" value={selectedInvoice.status} />
          </div>
          <ModalActions onCancel={() => setSelectedInvoice(null)} submitLabel="Close" />
        </Modal>
      )}
    </div>
  );
}

function StatCard({ title, value, note, icon: Icon, tone, onClick }) {
  return (
    <button className="admin-stat-card" onClick={onClick}>
      <div className="admin-stat-top"><span>{title}</span><div className={`admin-stat-icon ${tone}`}><Icon size={19} /></div></div>
      <strong className="admin-stat-value">{value}</strong>
      <div className="admin-stat-bottom"><span>{note}</span></div>
    </button>
  );
}

function StatusBadge({ status }) {
  return <span className={`admin-status-badge ${statusClass(status)}`}>{status}</span>;
}

function EmptyRow({ columns }) {
  return <tr><td colSpan={columns} className="admin-empty-row"><Search size={18} /><span>No matching records found.</span></td></tr>;
}

function ReportCard({ icon: Icon, title, description, count, onClick }) {
  return (
    <button className="admin-report-card" onClick={onClick}>
      <div className="admin-report-icon"><Icon size={21} /></div>
      <div className="admin-report-card-copy"><h3>{title}</h3><p>{description}</p><span>{count}</span></div>
      <div className="admin-report-download"><Download size={17} /></div>
    </button>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="admin-modal-header">
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button onClick={onClose} className="admin-modal-close" aria-label="Close dialog"><X size={19} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FormField({ label, children }) {
  return <label className="admin-form-field"><span>{label}</span>{children}</label>;
}

function ModalActions({ onCancel, submitLabel, disabled = false }) {
  return (
    <div className="admin-modal-actions">
      <button type="button" className="admin-btn admin-btn-outline" onClick={onCancel}>Cancel</button>
      <button disabled={disabled} type="submit" className="admin-btn admin-btn-primary">{submitLabel} <ChevronRight size={15} /></button>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="admin-detail-row">
      <div className="admin-detail-icon"><Icon size={17} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

export default AdminPage;
