
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Wallet, Receipt,
  UserRound, LogOut, Menu, X, RefreshCw, Send, Clock3,
  CheckCircle2, AlertCircle, Search, Download, Package,
  TrendingUp, CalendarDays, Building2, ChevronRight, CircleDollarSign,
} from "lucide-react";
import "./EmployeePage.css";

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
)
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "")
  .replace(/\/api$/, "");

const API_ROOT = `${API_ORIGIN}/api/v1`;

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Order Products", icon: ShoppingCart },
  { label: "My Requests", icon: ClipboardList },
  { label: "Budgets", icon: Wallet },
  { label: "Invoices", icon: Receipt },
  { label: "My Profile", icon: UserRound },
];

const STATUS_LABELS = {
  PENDING_MANAGER: "Waiting for manager",
  PENDING_FINANCE: "Waiting for Finance",
  APPROVED: "Approved",
  REJECTED_MANAGER: "Rejected by manager",
  REJECTED_FINANCE: "Rejected by Finance",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
};

const money = (amount, currency = "INR") => {
  const numericAmount = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
  } catch {
    return `₹${Number(numericAmount || 0).toLocaleString("en-IN")}`;
  }
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const unwrapArray = (response, keys) => {
  if (Array.isArray(response)) return response;
  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const getUser = (response) =>
  response?.user ||
  response?.data?.user ||
  response?.data?.data?.user ||
  response?.data ||
  null;

const getStatusClass = (status) =>
  String(status || "unknown").toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");

function StatusBadge({ status }) {
  const normalized = String(status || "Unknown").toUpperCase();
  return (
    <span className={`proc-status proc-status-${getStatusClass(normalized)}`}>
      {STATUS_LABELS[normalized] || String(status || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ icon: Icon = ClipboardList, title, description }) {
  return (
    <div className="employee-empty-state">
      <span className="employee-empty-icon"><Icon size={24} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

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

  const [form, setForm] = useState({
    productName: "",
    description: "",
    supplier: "",
    quantity: "1",
    unitPrice: "",
    department: "",
    budgetId: "",
    justification: "",
    currency: "INR",
  });

  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token");

  const logout = useCallback(() => {
    ["token", "accessToken", "authToken", "user"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    window.location.assign("/login");
  }, []);

  const apiRequest = useCallback(async (path, options = {}) => {
    if (!token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const requestPath = path.startsWith("/") ? path : `/${path}`;
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${token}`);

    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    let response;
    try {
      response = await fetch(`${API_ROOT}${requestPath}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error(
        `Cannot connect to ETDOX API at ${API_ROOT}. Check that Docker and the backend are running.`
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { message: await response.text().catch(() => "") };

    if (import.meta.env.DEV) {
      console.info(
        `[ETDOX API] ${options.method || "GET"} ${requestPath} -> ${response.status}`
      );
    }

    if (response.status === 401) {
      logout();
      throw new Error("Your session is invalid or expired. Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error(
        result.message || "You do not have permission to access this information."
      );
    }

    if (!response.ok) {
      const apiError = new Error(
        result.message ||
        result.error ||
        `API request failed with status ${response.status}.`
      );
      apiError.status = response.status;
      throw apiError;
    }

    return result;
  }, [token, logout]);

  // Use the versioned API as the primary route. A legacy route is tried only
  // when the versioned route does not exist (404/405), never on auth failures.
  const apiRequestFirstAvailable = useCallback(async (paths, options = {}) => {
    let lastError;
    for (const path of paths) {
      try {
        return await apiRequest(path, options);
      } catch (err) {
        lastError = err;
        if (![404, 405].includes(err.status)) throw err;
      }
    }
    throw lastError || new Error("No supported API endpoint was found.");
  }, [apiRequest]);

  const loadDashboard = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequestFirstAvailable([
          "/procurement/requests",
        ]),
        apiRequestFirstAvailable([
          "/budgets",
          "/procurement/budgets",
        ]),
        apiRequestFirstAvailable([
          "/invoices",
          "/procurement/invoices",
        ]),
        apiRequestFirstAvailable([
          "/auth/me",
        ]),
      ]);

      const [requestResult, budgetResult, invoiceResult, userResult] = results;
      const failures = [];

      if (requestResult.status === "fulfilled") {
        setRequests(unwrapArray(requestResult.value, ["requests", "items"]));
      } else {
        setRequests([]);
        failures.push(`Requests: ${getErrorMessage(requestResult.reason)}`);
      }

      if (budgetResult.status === "fulfilled") {
        const loadedBudgets = unwrapArray(budgetResult.value, ["budgets", "items"]);
        setBudgets(loadedBudgets);

        setForm((previous) => {
          const departmentExists = loadedBudgets.some(
            (budget) => budget.department === previous.department
          );
          const department = departmentExists
            ? previous.department
            : loadedBudgets[0]?.department || "";

          const matchingBudget = loadedBudgets.find(
            (budget) =>
              budget.department === department &&
              (!previous.budgetId || budget.id === previous.budgetId)
          ) || loadedBudgets.find((budget) => budget.department === department);

          return {
            ...previous,
            department,
            budgetId: matchingBudget?.id || "",
            currency: matchingBudget?.currency || previous.currency || "INR",
          };
        });
      } else {
        setBudgets([]);
        failures.push(`Budgets: ${getErrorMessage(budgetResult.reason)}`);
      }

      if (invoiceResult.status === "fulfilled") {
        setInvoices(unwrapArray(invoiceResult.value, ["invoices", "items"]));
      } else {
        setInvoices([]);
        failures.push(`Invoices: ${getErrorMessage(invoiceResult.reason)}`);
      }

      if (userResult.status === "fulfilled") {
        setEmployee(getUser(userResult.value));
      } else {
        setEmployee(null);
        failures.push(`Profile: ${getErrorMessage(userResult.reason)}`);
      }

      if (failures.length) {
        setError(failures.join(" "));
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [apiRequestFirstAvailable]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const updateField = (event) => {
    const { name, value } = event.target;

    if (name === "department") {
      const matchingBudget = budgets.find((budget) => budget.department === value);
      setForm((previous) => ({
        ...previous,
        department: value,
        budgetId: matchingBudget?.id || "",
        currency: matchingBudget?.currency || "INR",
      }));
      return;
    }

    if (name === "budgetId") {
      const matchingBudget = budgets.find((budget) => budget.id === value);
      setForm((previous) => ({
        ...previous,
        budgetId: value,
        currency: matchingBudget?.currency || previous.currency || "INR",
      }));
      return;
    }

    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);
    const total = quantity * unitPrice;

    if (!form.productName.trim() || !form.justification.trim()) {
      setError("Enter a product name and business justification.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError("Unit price must be greater than zero.");
      return;
    }
    if (!form.budgetId) {
      setError("Select a budget allocation before submitting.");
      return;
    }

    const selectedBudget = budgets.find((budget) => budget.id === form.budgetId);
    if (selectedBudget && total > Number(selectedBudget.available ?? Infinity)) {
      setError("The request total exceeds the available budget. Adjust the quantity or price.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productName: form.productName.trim(),
        description: form.description.trim(),
        supplier: form.supplier.trim(),
        quantity,
        unitPrice,
        total,
        department: form.department,
        budgetId: form.budgetId,
        justification: form.justification.trim(),
        currency: form.currency || "INR",
      };

      const result = await apiRequest("/procurement/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(result.message || "Purchase request submitted successfully.");
      setForm((previous) => ({
        ...previous,
        productName: "",
        description: "",
        supplier: "",
        quantity: "1",
        unitPrice: "",
        justification: "",
      }));

      await loadDashboard({ quiet: true });
      setActivePage("My Requests");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch = [
        request.id,
        request.requestNumber,
        request.productName,
        request.department,
        request.status,
        request.supplier,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "ALL" ||
        String(request.status || "").toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const pendingCount = requests.filter((request) =>
    ["PENDING_MANAGER", "PENDING_FINANCE"].includes(
      String(request.status || "").toUpperCase()
    )
  ).length;

  const approvedCount = requests.filter(
    (request) => String(request.status || "").toUpperCase() === "APPROVED"
  ).length;

  const totalRequested = requests.reduce(
    (sum, request) => sum + Number(request.total ?? request.totalAmount ?? 0),
    0
  );

  const totalInvoiced = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? invoice.totalAmount ?? 0),
    0
  );

  const pageHeading = {
    Overview: "Employee Overview",
    "Order Products": "Request a Product",
    "My Requests": "My Purchase Requests",
    Budgets: "Department Budgets",
    Invoices: "My Invoices",
    "My Profile": "My Profile",
  }[activePage] || activePage;

  const exportRequests = () => {
    const rows = [
      ["Request ID", "Product", "Quantity", "Total", "Currency", "Department", "Status", "Created"],
      ...filteredRequests.map((request) => [
        request.id || request.requestNumber || "",
        request.productName || "",
        request.quantity ?? "",
        request.total ?? request.totalAmount ?? "",
        request.currency || "INR",
        request.department || "",
        request.status || "",
        request.createdAt || request.created_at || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "etdox-my-purchase-requests.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {items.map((request, index) => (
            <tr key={request.id || request.requestNumber || `${request.productName}-${index}`}>
              <td>
                <strong>{request.productName || "Untitled request"}</strong>
                <small>{request.requestNumber || request.id || "—"}</small>
              </td>
              <td>{request.quantity ?? "—"}</td>
              <td>{money(request.total ?? request.totalAmount, request.currency)}</td>
              <td>{request.department || "—"}</td>
              <td><StatusBadge status={request.status} /></td>
              <td>
                {(request.createdAt || request.created_at)
                  ? new Date(request.createdAt || request.created_at).toLocaleDateString("en-IN")
                  : "—"}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="proc-empty">No purchase requests match your filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderOverview = () => (
    <>
      <section className="employee-welcome-banner">
        <div className="employee-welcome-copy">
          <span className="employee-eyebrow">ETDOX PROCUREMENT WORKSPACE</span>
          <h2>Welcome, {employee?.name || employee?.firstName || "Employee"}!</h2>
          <p>
            Create purchase requests, check department budgets, and follow approval progress
            from one workspace.
          </p>
          <button className="employee-primary-button" onClick={() => setActivePage("Order Products")}>
            <ShoppingCart size={17} /> Create purchase request <ChevronRight size={17} />
          </button>
        </div>
        <div className="employee-welcome-graphic"><Package size={64} strokeWidth={1.25} /></div>
      </section>

      <section className="employee-stats-grid">
        <article className="employee-stat-card">
          <div className="employee-stat-top"><span>My requests</span><ClipboardList size={20} /></div>
          <div className="employee-stat-number">{requests.length}</div>
          <div className="employee-stat-bottom">All submitted requests</div>
        </article>
        <article className="employee-stat-card">
          <div className="employee-stat-top"><span>Awaiting approval</span><Clock3 size={20} /></div>
          <div className="employee-stat-number">{pendingCount}</div>
          <div className="employee-stat-bottom">Manager or Finance review</div>
        </article>
        <article className="employee-stat-card">
          <div className="employee-stat-top"><span>Approved</span><CheckCircle2 size={20} /></div>
          <div className="employee-stat-number">{approvedCount}</div>
          <div className="employee-stat-bottom">Requests approved</div>
        </article>
        <article className="employee-stat-card">
          <div className="employee-stat-top"><span>Total requested</span><CircleDollarSign size={20} /></div>
          <div className="employee-stat-number proc-total-number">{money(totalRequested)}</div>
          <div className="employee-stat-bottom">Value of your requests</div>
        </article>
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div><h2>Recent purchase requests</h2><p>Latest submissions and their current status.</p></div>
          <button className="proc-refresh" onClick={() => loadDashboard()} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {requests.length ? renderRequestTable(requests.slice(0, 5)) : (
          <EmptyState icon={ShoppingCart} title="No requests yet" description="Create your first purchase request to see it here." />
        )}
        <button className="employee-secondary-button" onClick={() => setActivePage("My Requests")}>
          View all requests <ChevronRight size={16} />
        </button>
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div><h2>Budget snapshot</h2><p>Current allocation and remaining funds.</p></div>
          <button className="employee-text-button" onClick={() => setActivePage("Budgets")}>View budgets <ChevronRight size={15} /></button>
        </div>
        {budgets.length ? (
          <div className="proc-budget-grid">
            {budgets.slice(0, 3).map((budget, index) => {
              const allocated = Number(budget.allocated ?? budget.totalAmount ?? 0);
              const spent = Number(budget.spent ?? 0);
              const committed = Number(budget.committed ?? 0);
              const available = Number(budget.available ?? allocated - spent - committed);
              const percent = allocated > 0 ? Math.min(100, ((spent + committed) / allocated) * 100) : 0;
              return (
                <article className="proc-budget-card" key={budget.id || `${budget.department}-${index}`}>
                  <span>{budget.department || "Department budget"}</span>
                  <h3>{money(allocated, budget.currency)}</h3>
                  <p>Allocated funds</p>
                  <div className="proc-budget-bar"><span style={{ width: `${percent}%` }} /></div>
                  <div className="proc-budget-row"><span>Used / committed</span><strong>{percent.toFixed(1)}%</strong></div>
                  <div className="proc-budget-row"><span>Available</span><strong>{money(available, budget.currency)}</strong></div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState icon={Wallet} title="No budget data" description="Budget allocations will appear when the backend provides them." />}
      </section>

      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div><h2>Latest invoices</h2><p>Invoices recorded for your purchase requests.</p></div>
          <Receipt size={22} />
        </div>
        {invoices.length ? (
          <div className="proc-table-wrap">
            <table className="proc-table">
              <thead><tr><th>Invoice</th><th>Product / Request</th><th>Amount</th><th>Payment status</th></tr></thead>
              <tbody>
                {invoices.slice(0, 5).map((invoice, index) => (
                  <tr key={invoice.id || invoice.invoiceNumber || index}>
                    <td><strong>{invoice.invoiceNumber || invoice.number || "—"}</strong><small>{invoice.id || ""}</small></td>
                    <td>{invoice.productName || invoice.requestId || "—"}</td>
                    <td>{money(invoice.amount ?? invoice.totalAmount, invoice.currency)}</td>
                    <td><StatusBadge status={invoice.paymentStatus || invoice.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Receipt} title="No invoices yet" description="Finance invoices will appear here when they are available to your account." />}
      </section>
    </>
  );

  const renderOrderForm = () => {
    const selectedBudget = budgets.find((budget) => budget.id === form.budgetId);
    const quantity = Number(form.quantity || 0);
    const unitPrice = Number(form.unitPrice || 0);
    const estimatedTotal = quantity * unitPrice;
    const available = Number(selectedBudget?.available ?? 0);
    const exceedsBudget = Boolean(selectedBudget) && estimatedTotal > available;

    return (
      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div><h2>New purchase request</h2><p>Provide product details and a business reason for approval.</p></div>
          <ShoppingCart size={22} />
        </div>

        {budgets.length === 0 && (
          <div className="proc-alert proc-alert-warning">
            <AlertCircle size={18} /> No budgets were returned by the API. You may need Finance to create an allocation first.
          </div>
        )}

        <form className="proc-form" onSubmit={submitRequest}>
          <div className="proc-form-grid">
            <label>Product name *
              <input name="productName" value={form.productName} onChange={updateField} maxLength={160} placeholder="e.g. Office laptop" required />
            </label>
            <label>Supplier / vendor
              <input name="supplier" value={form.supplier} onChange={updateField} maxLength={160} placeholder="Vendor name" />
            </label>
            <label>Quantity *
              <input type="number" name="quantity" value={form.quantity} onChange={updateField} min="1" step="1" required />
            </label>
            <label>Unit price ({form.currency}) *
              <input type="number" name="unitPrice" value={form.unitPrice} onChange={updateField} min="0.01" step="0.01" placeholder="0.00" required />
            </label>
            <label>Department *
              <select name="department" value={form.department} onChange={updateField} required>
                <option value="">Select department</option>
                {budgets.map((budget, index) => (
                  <option key={budget.id || `${budget.department}-${index}`} value={budget.department}>
                    {budget.department || "Unnamed department"}
                  </option>
                ))}
              </select>
            </label>
            <label>Budget allocation *
              <select name="budgetId" value={form.budgetId} onChange={updateField} required>
                <option value="">Select budget</option>
                {budgets.filter((budget) => budget.department === form.department).map((budget, index) => (
                  <option key={budget.id || index} value={budget.id}>
                    {budget.name || budget.id} — Available {money(budget.available, budget.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="proc-full-field">Product description
              <textarea name="description" value={form.description} onChange={updateField} rows={3} maxLength={2000} placeholder="Specifications, model, features, or requirements." />
            </label>
            <label className="proc-full-field">Business justification *
              <textarea name="justification" value={form.justification} onChange={updateField} rows={3} maxLength={2000} placeholder="Explain why this product is needed for your work." required />
            </label>
          </div>

          <div className="proc-estimate">
            <div><span>Estimated request total</span><strong>{money(estimatedTotal, form.currency)}</strong></div>
            <div><span>Available department budget</span><strong>{money(available, form.currency)}</strong></div>
          </div>

          {exceedsBudget && (
            <p className="proc-inline-warning"><AlertCircle size={17} /> This request exceeds the currently available budget.</p>
          )}

          <button className="employee-primary-button" type="submit" disabled={submitting || !budgets.length || exceedsBudget}>
            <Send size={17} /> {submitting ? "Submitting request..." : "Submit for approval"}
          </button>
        </form>
      </section>
    );
  };

  const renderRequests = () => (
    <section className="employee-content-card proc-card">
      <div className="employee-section-heading">
        <div><h2>Purchase request tracking</h2><p>Search your submissions and monitor approval status.</p></div>
        <div className="proc-action-group">
          <button className="proc-refresh" onClick={exportRequests} disabled={!filteredRequests.length}><Download size={16} /> Export CSV</button>
          <button className="proc-refresh" onClick={() => loadDashboard()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>
      <div className="proc-filter-row">
        <label className="proc-search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request, product, department..." /></label>
        <select className="proc-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="PENDING_MANAGER">Waiting for manager</option>
          <option value="PENDING_FINANCE">Waiting for Finance</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED_MANAGER">Rejected by manager</option>
          <option value="REJECTED_FINANCE">Rejected by Finance</option>
        </select>
      </div>
      {renderRequestTable(filteredRequests)}
      <div className="proc-approval-explainer">
        <h3>Approval workflow</h3>
        <ol>
          <li>Submit your request with a valid budget allocation.</li>
          <li>Your manager reviews and approves or rejects it.</li>
          <li>Approved requests move to Finance for review.</li>
          <li>Finance handles downstream invoice and payment records.</li>
        </ol>
      </div>
    </section>
  );

  const renderBudgets = () => (
    <section className="employee-content-card proc-card">
      <div className="employee-section-heading">
        <div><h2>Department budgets</h2><p>Review allocated, committed, spent, and available funds.</p></div>
        <Wallet size={22} />
      </div>
      <div className="proc-budget-grid">
        {budgets.map((budget, index) => {
          const allocated = Number(budget.allocated ?? budget.totalAmount ?? 0);
          const spent = Number(budget.spent ?? 0);
          const committed = Number(budget.committed ?? 0);
          const available = Number(budget.available ?? allocated - spent - committed);
          const percent = allocated > 0 ? Math.min(100, ((spent + committed) / allocated) * 100) : 0;

          return (
            <article className="proc-budget-card" key={budget.id || `${budget.department}-${index}`}>
              <div className="proc-budget-card-top"><span className="proc-budget-icon"><Building2 size={18} /></span><StatusBadge status={budget.status || "ACTIVE"} /></div>
              <span>{budget.department || budget.name || "Department budget"}</span>
              <h3>{money(allocated, budget.currency)}</h3>
              <p>Allocated budget {budget.id ? `· ${budget.id}` : ""}</p>
              <div className="proc-budget-bar"><span style={{ width: `${percent}%` }} /></div>
              <div className="proc-budget-row"><span>Utilization</span><strong>{percent.toFixed(1)}%</strong></div>
              <div className="proc-budget-row"><span>Committed</span><strong>{money(committed, budget.currency)}</strong></div>
              <div className="proc-budget-row"><span>Spent</span><strong>{money(spent, budget.currency)}</strong></div>
              <div className="proc-budget-row"><span>Available</span><strong>{money(available, budget.currency)}</strong></div>
            </article>
          );
        })}
      </div>
      {!budgets.length && <EmptyState icon={Wallet} title="No budgets available" description="The backend did not return any budget allocations for this account." />}
      <p className="proc-note">Budget values are read from the backend. Allocation changes should be performed only by authorized Finance users.</p>
    </section>
  );

  const renderInvoices = () => (
    <section className="employee-content-card proc-card">
      <div className="employee-section-heading">
        <div><h2>My invoices</h2><p>Invoices made available for your purchase requests.</p></div>
        <Receipt size={22} />
      </div>
      <div className="proc-invoice-summary">
        <div><span>Total invoices</span><strong>{invoices.length}</strong></div>
        <div><span>Total invoiced</span><strong>{money(totalInvoiced)}</strong></div>
      </div>
      <div className="proc-table-wrap">
        <table className="proc-table">
          <thead><tr><th>Invoice</th><th>Product / Request</th><th>Invoice amount</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((invoice, index) => {
              const amount = Number(invoice.amount ?? invoice.totalAmount ?? 0);
              const paid = Number(invoice.paidAmount ?? invoice.paid_amount ?? 0);
              return (
                <tr key={invoice.id || invoice.invoiceNumber || index}>
                  <td><strong>{invoice.invoiceNumber || invoice.number || "—"}</strong><small>{invoice.id || "—"}</small></td>
                  <td>{invoice.productName || invoice.requestId || invoice.request_id || "—"}<small>{invoice.requestId || invoice.request_id || ""}</small></td>
                  <td>{money(amount, invoice.currency)}</td>
                  <td>{money(paid, invoice.currency)}</td>
                  <td>{money(Math.max(0, amount - paid), invoice.currency)}</td>
                  <td><StatusBadge status={invoice.paymentStatus || invoice.payment_status || invoice.status} /></td>
                </tr>
              );
            })}
            {!invoices.length && <tr><td colSpan={6} className="proc-empty">No invoices are available for your account.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderProfile = () => {
    const displayName =
      employee?.name ||
      [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
      "Employee";

    return (
      <section className="employee-content-card proc-card">
        <div className="employee-section-heading">
          <div><h2>Employee information</h2><p>Your currently authenticated account details.</p></div>
          <UserRound size={22} />
        </div>
        <div className="proc-profile-hero">
          <div className="employee-avatar employee-avatar-large">
            {displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div><h3>{displayName}</h3><p>{employee?.role || employee?.roles?.[0]?.name || "employee"}</p></div>
        </div>
        <div className="proc-profile-grid">
          <div><span>Full name</span><strong>{displayName}</strong></div>
          <div><span>Email address</span><strong>{employee?.email || "—"}</strong></div>
          <div><span>Account ID</span><strong>{employee?.id || employee?.userId || "—"}</strong></div>
          <div><span>Role</span><strong>{employee?.role || employee?.roles?.[0]?.name || "employee"}</strong></div>
          <div><span>Department</span><strong>{employee?.department || employee?.departmentName || "—"}</strong></div>
          <div><span>Account status</span><strong>{employee?.status || "Active session"}</strong></div>
        </div>
        <p className="proc-note">Profile details are read-only here. Account changes should be managed through the authorized account administration workflow.</p>
      </section>
    );
  };

  const renderContent = () => {
    switch (activePage) {
      case "Order Products": return renderOrderForm();
      case "My Requests": return renderRequests();
      case "Budgets": return renderBudgets();
      case "Invoices": return renderInvoices();
      case "My Profile": return renderProfile();
      default: return renderOverview();
    }
  };

  return (
    <div className="employee-dashboard">
      {mobileMenuOpen && (
        <button className="employee-mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
      )}

      <aside className={`employee-sidebar ${mobileMenuOpen ? "employee-sidebar-open" : ""}`}>
        <div className="employee-brand">
          <div className="employee-brand-mark">E</div>
          <div className="employee-brand-copy"><strong>ETDOX</strong><span>PROCUREMENT</span></div>
          <button className="employee-close-menu" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <div className="employee-sidebar-label">EMPLOYEE WORKSPACE</div>
        <nav className="employee-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`employee-nav-item ${activePage === item.label ? "active" : ""}`}
                onClick={() => {
                  setActivePage(item.label);
                  setMobileMenuOpen(false);
                  setError("");
                  setSuccess("");
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.label === "My Requests" && pendingCount > 0 && <span className="employee-nav-count">{pendingCount}</span>}
              </button>
            );
          })}
        </nav>

        <div className="employee-sidebar-bottom">
          <div className="employee-help-card">
            <strong>Need approval support?</strong>
            <p>Contact your manager or Finance team if a request is delayed.</p>
          </div>
          <button className="employee-logout-button" onClick={logout}><LogOut size={18} /> Log out</button>
        </div>
      </aside>

      <main className="employee-main">
        <header className="employee-topbar">
          <div className="employee-topbar-left">
            <button className="employee-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
            <div>
              <div className="employee-breadcrumb">ETDOX <span>/</span> {activePage}</div>
              <h1>{pageHeading}</h1>
            </div>
          </div>
          <div className="employee-topbar-actions">
            <div className="employee-last-updated">
              <CalendarDays size={14} />
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Not synced"}
            </div>
            <button className="proc-refresh" onClick={() => loadDashboard()} disabled={loading}>
              <RefreshCw size={16} className={loading ? "proc-spin" : ""} /> Refresh
            </button>
            <div className="employee-header-profile">
              <div className="employee-avatar">
                {(employee?.name || employee?.firstName || "E").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="employee-header-profile-text">
                <strong>{employee?.name || employee?.firstName || "Employee"}</strong>
                <span>{employee?.role || employee?.roles?.[0]?.name || "employee"}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="employee-page-content">
          {error && <div className="proc-alert proc-alert-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {success && <div className="proc-alert proc-alert-success" role="status"><CheckCircle2 size={18} /><span>{success}</span><button onClick={() => setSuccess("")} aria-label="Dismiss success"><X size={16} /></button></div>}

          {loading ? (
            <section className="employee-content-card proc-card employee-loading"><span className="employee-loader" /><strong>Loading your ETDOX workspace...</strong><p>Connecting to the procurement API.</p></section>
          ) : renderContent()}
        </div>

        <footer className="employee-footer">
          <span>© {new Date().getFullYear()} ETDOX Technologies</span>
          <span>Employee Procurement Workspace</span>
        </footer>
      </main>
    </div>
  );
}
