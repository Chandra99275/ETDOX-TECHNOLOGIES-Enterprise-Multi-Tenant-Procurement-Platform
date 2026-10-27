
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Wallet, ReceiptText, ArrowLeftRight,
  ChartNoAxesCombined, Settings, LogOut, Bell, Search, Menu, X,
  TrendingUp, ArrowUpRight, ArrowDownRight, Download, Plus,
  CreditCard, CircleDollarSign, Clock3, CheckCircle2,
  MoreHorizontal, FileText, CalendarDays, RefreshCw,
  PiggyBank, AlertCircle, ClipboardList
} from "lucide-react";

import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid,
  XAxis, YAxis, Tooltip, BarChart, Bar
} from "recharts";

import "./FinancePage.css";

// --------------------------------------------------
// API configuration
// --------------------------------------------------

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

// The procurement routes in server.js are under /api/procurement,
// not /api/v1.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/i, "");
const PROCUREMENT_API_URL = `${API_ORIGIN}/api/procurement`;

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Invoices", icon: ReceiptText },
  { label: "Employee Requests", icon: ClipboardList },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Reports", icon: ChartNoAxesCombined },
  { label: "Budgets", icon: PiggyBank },
  { label: "Settings", icon: Settings },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCurrency = (value) =>
  currencyFormatter.format(Number(value) || 0);

const formatCompactCurrency = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return formatCurrency(amount);
};

const unwrap = (response, keys = []) => {
  // Accept common Express response shapes:
  // [ ... ], { requests: [...] }, { data: [...] },
  // { data: { requests: [...] } }, { success: true, data: { items: [...] } }.
  const queue = [response];
  const visited = new Set();
  const arrayKeys = [...keys, "data", "items", "results", "records", "rows"];

  while (queue.length) {
    const current = queue.shift();
    if (Array.isArray(current)) return current;
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    for (const key of arrayKeys) {
      if (Array.isArray(current[key])) return current[key];
    }

    // Search likely wrapper objects without traversing arbitrary object graphs.
    for (const key of [...keys, "data", "result", "payload", "requests", "purchaseRequests"]) {
      const child = current[key];
      if (child && typeof child === "object") queue.push(child);
    }
  }

  return [];
};

const getNumber = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return 0;
};

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// --------------------------------------------------
// Normalizers for the actual server.js response shapes
// --------------------------------------------------

const normalizeInvoice = (item, index) => {
  const amount = getNumber(item.amount, item.total, item.totalAmount);
  const paidAmount = getNumber(item.paidAmount, item.paid_amount);

  let status = String(
    item.paymentStatus ?? item.payment_status ?? item.status ?? "UNPAID"
  ).toUpperCase();

  if (status === "UNPAID" && paidAmount > 0) status = "PARTIALLY_PAID";

  let displayStatus = "Pending";
  if (status === "PAID" || status === "COMPLETED") displayStatus = "Paid";
  else if (status === "PARTIALLY_PAID") displayStatus = "Partially Paid";
  else if (status === "OVERDUE") displayStatus = "Overdue";
  else if (status === "CANCELLED" || status === "CANCELED") displayStatus = "Cancelled";

  return {
    id: String(item.id ?? item._id ?? item.invoiceNumber ?? `INV-${index + 1}`),
    invoiceNumber: String(item.invoiceNumber ?? item.invoice_number ?? item.id ?? ""),
    requestId: String(item.requestId ?? item.request_id ?? ""),
    client: String(
      item.requesterName ??
      item.clientName ??
      item.client_name ??
      item.customerName ??
      item.supplierName ??
      item.productName ??
      "Client not specified"
    ),
    productName: String(item.productName ?? ""),
    date: item.createdAt ?? item.issueDate ?? item.invoiceDate ?? item.date ?? "",
    dueDate: item.dueDate ?? item.due_date ?? "",
    amount,
    paidAmount,
    outstanding: Math.max(0, amount - paidAmount),
    status: displayStatus,
    raw: item,
  };
};

const normalizeTransaction = (item, index) => {
  const type = String(item.type ?? item.transactionType ?? "").toLowerCase();
  const isExpense =
    type.includes("expense") ||
    type.includes("debit") ||
    type.includes("withdrawal") ||
    type.includes("payment_out");

  return {
    id: String(item.id ?? item._id ?? item.transactionId ?? index),
    title: String(
      item.title ??
      item.description ??
      item.invoiceNumber ??
      item.reference ??
      item.type ??
      "Financial transaction"
    ),
    subtitle: String(
      item.recordedByName ??
      item.counterparty ??
      item.category ??
      item.invoiceId ??
      "Business transaction"
    ),
    date: item.paymentDate ?? item.date ?? item.createdAt ?? "",
    amount: Math.abs(getNumber(item.amount, item.total, item.value)),
    type: isExpense ? "expense" : "income",
  };
};

const normalizeBudget = (item, index) => {
  const allocated = getNumber(
    item.allocated,
    item.limit,
    item.budgetLimit,
    item.allocatedAmount,
    item.amount
  );
  const committed = getNumber(item.committed);
  const spent = getNumber(item.spent);

  return {
    id: String(item.id ?? item._id ?? item.budgetId ?? index),
    name: String(item.name ?? item.department ?? item.category ?? "Budget"),
    department: String(item.department ?? item.departmentName ?? "General"),
    limit: allocated,
    committed,
    spent,
    remaining: getNumber(
      item.available,
      item.remaining,
      allocated - committed - spent
    ),
  };
};

const normalizeRequestStatus = (status) => {
  // Normalize values from different backend naming conventions.
  const value = String(status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  // A manager-approved request is waiting for Finance to make its decision.
  if ([
    "PENDING_MANAGER", "AWAITING_MANAGER", "WAITING_FOR_MANAGER",
    "PENDING_MANAGER_APPROVAL", "WAITING_FOR_MANAGER_APPROVAL"
  ].includes(value)) return "Pending Manager";

  if ([
    "PENDING_FINANCE", "AWAITING_FINANCE", "WAITING_FOR_FINANCE",
    "MANAGER_APPROVED", "APPROVED_BY_MANAGER", "PENDING", "SUBMITTED",
    "REQUESTED", "PENDING_APPROVAL", "AWAITING_APPROVAL", "UNDER_REVIEW"
  ].includes(value)) return "Pending Finance";

  if (["APPROVED", "ACCEPTED", "FINANCE_APPROVED", "APPROVED_BY_FINANCE"].includes(value)) return "Approved";
  if (value.startsWith("REJECTED") || ["DECLINED", "DENIED", "FINANCE_REJECTED"].includes(value)) return "Rejected";
  if (["COMPLETED", "FULFILLED", "CLOSED"].includes(value)) return "Completed";

  return value ? value.replace(/_/g, " ") : "Unknown";
};

const canFinanceDecide = (request) => {
  // Keep Accept/Decline visible for any unresolved request status.
  // Final decisions should not be actionable again.
  return !["Approved", "Rejected", "Completed"].includes(request.status);
};

const normalizeEmployeeRequest = (item, index) => ({
  id: String(
    item.id ??
    item._id ??
    item.requestId ??
    item.request_id ??
    item.purchaseRequestId ??
    item.purchase_request_id ??
    `REQ-${index + 1}`
  ),
  employeeName: String(
    item.requesterName ??
    item.requester_name ??
    item.employeeName ??
    item.employee_name ??
    item.user?.name ??
    item.requester?.name ??
    "Employee"
  ),
  employeeEmail: String(
    item.requesterEmail ??
    item.requester_email ??
    item.employeeEmail ??
    item.employee_email ??
    item.user?.email ??
    item.requester?.email ??
    "Not provided"
  ),
  title: String(
    item.productName ??
    item.product_name ??
    item.title ??
    item.subject ??
    item.requestTitle ??
    item.request_title ??
    "Purchase request"
  ),
  type: String(item.type ?? item.category ?? "Purchase request"),
  description: String(
    item.justification ??
    item.justificationText ??
    item.justification_text ??
    item.description ??
    item.details ??
    "No description provided"
  ),
  department: String(item.department ?? "Not specified"),
  amount: getNumber(
    item.total,
    item.totalAmount,
    item.total_amount,
    item.amount,
    item.requestedAmount,
    item.requested_amount
  ),
  currency: String(item.currency ?? "INR"),
  date: item.createdAt ?? item.created_at ?? item.submittedAt ?? item.submitted_at ?? "",
  status: normalizeRequestStatus(item.status),
  raw: item,
});

// --------------------------------------------------
// Authentication helpers
// --------------------------------------------------

const getStoredAuthToken = () => {
  const keys = [
    "accessToken", "access_token", "token", "authToken", "auth_token",
    "jwt", "jwtToken", "etdoxToken", "etdox_token", "user", "auth", "session"
  ];

  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of keys) {
        const value = store.getItem(key);
        if (!value) continue;

        if (value.split(".").length === 3) return value;

        try {
          const parsed = JSON.parse(value);
          const token =
            parsed?.token ??
            parsed?.accessToken ??
            parsed?.access_token ??
            parsed?.jwt ??
            parsed?.authToken ??
            parsed?.data?.token ??
            parsed?.data?.accessToken;

          if (typeof token === "string" && token.split(".").length === 3) {
            return token;
          }
        } catch {
          // Continue checking other storage keys.
        }
      }

      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        const value = key ? store.getItem(key) : null;
        if (value && value.split(".").length === 3) return value;
      }
    } catch {
      // Browser storage may be unavailable.
    }
  }

  return "";
};

async function apiRequest(url, options = {}) {
  const token = getStoredAuthToken();

  if (!token) {
    throw new Error("No login token found. Sign in through the ETDOX login page.");
  }

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      credentials: "include",
    });
  } catch {
    throw new Error("Cannot connect to the backend. Check that it is running on port 5000.");
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof result === "object" && result
        ? result.message || result.error || result.detail
        : result;

    if (response.status === 401) {
      throw new Error("Your session is invalid or expired. Please sign in again.");
    }
    if (response.status === 403) {
      throw new Error(message || "Your account does not have permission for this action.");
    }
    if (response.status === 404) {
      throw new Error(`Backend route not found: ${url}`);
    }
    throw new Error(message || `Request failed with HTTP ${response.status}.`);
  }

  return result;
}

const financeApi = (path, options) =>
  apiRequest(`${API_BASE_URL}${path}`, options);

const procurementApi = (path, options) =>
  apiRequest(`${PROCUREMENT_API_URL}${path}`, options);

// --------------------------------------------------
// Finance page
// --------------------------------------------------

export default function FinancePage() {
  const [activePage, setActivePage] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("All");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestFilter, setRequestFilter] = useState("All");

  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [employeeRequests, setEmployeeRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [requestActionLoading, setRequestActionLoading] = useState("");
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState(null);

  // All endpoints below exist in the supplied server.js.
  const loadFinanceData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    const tasks = [
      {
        key: "invoices",
        run: () => financeApi("/invoices"),
      },
      {
        key: "transactions",
        run: () => financeApi("/transactions"),
      },
      {
        key: "budgets",
        run: () => financeApi("/budgets"),
      },
      {
        key: "analytics",
        run: () => financeApi("/analytics"),
      },
      {
        // FIX: this is the real route in server.js.
        key: "employeeRequests",
        run: () => procurementApi("/requests"),
      },
    ];

    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    const failures = [];

    results.forEach((result, index) => {
      const key = tasks[index].key;

      if (result.status === "rejected") {
        failures.push(`${key}: ${result.reason?.message || "Failed to load"}`);
        return;
      }

      const data = result.value;

      if (key === "invoices") {
        setInvoices(unwrap(data, ["invoices"]).map(normalizeInvoice));
      } else if (key === "transactions") {
        setTransactions(unwrap(data, ["transactions"]).map(normalizeTransaction));
      } else if (key === "budgets") {
        setBudgets(unwrap(data, ["budgets"]).map(normalizeBudget));
      } else if (key === "analytics") {
        setAnalytics(data?.analytics ?? data?.data ?? data ?? {});
      } else if (key === "employeeRequests") {
        setEmployeeRequests(
          unwrap(data, ["requests", "purchaseRequests"]).map(normalizeEmployeeRequest)
        );
      }
    });

    if (failures.length) {
      setError(`Some data could not be loaded. ${failures.join(" | ")}`);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // --------------------------------------------------
  // Calculated values
  // --------------------------------------------------

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const text = `${invoice.id} ${invoice.client} ${invoice.status}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase()) &&
      (invoiceFilter === "All" || invoice.status === invoiceFilter);
  }), [invoices, searchTerm, invoiceFilter]);

  const filteredRequests = useMemo(() => employeeRequests.filter((request) => {
    const text = [
      request.id, request.employeeName, request.employeeEmail,
      request.title, request.type, request.description,
      request.department, request.status
    ].join(" ").toLowerCase();

    return text.includes(requestSearch.trim().toLowerCase()) &&
      (requestFilter === "All" || request.status === requestFilter);
  }), [employeeRequests, requestSearch, requestFilter]);

  // Finance may act only on requests approved by a manager.
  const pendingFinanceRequests = employeeRequests.filter(
    (request) => request.status === "Pending Finance"
  );

  const pendingManagerRequests = employeeRequests.filter(
    (request) => request.status === "Pending Manager"
  );

  const totalInvoiceValue = invoices.reduce((sum, item) => sum + item.amount, 0);
  const paidValue = invoices.reduce((sum, item) => sum + item.paidAmount, 0);
  const pendingValue = invoices.reduce((sum, item) => sum + item.outstanding, 0);
  const overdueValue = invoices
    .filter((item) => item.status === "Overdue")
    .reduce((sum, item) => sum + item.outstanding, 0);

  const transactionIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const transactionExpenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalRevenue = getNumber(
    analytics.totalRevenue, analytics.total_revenue, analytics.revenue, analytics.income
  ) || transactionIncome;

  const totalExpenses = getNumber(
    analytics.totalExpenses, analytics.total_expenses, analytics.expenses, analytics.expense
  ) || transactionExpenses;

  const netProfit = getNumber(
    analytics.netProfit, analytics.net_profit, analytics.profit
  ) || totalRevenue - totalExpenses;

  const expenseData = useMemo(() => {
    const source =
      analytics.expenseBreakdown ??
      analytics.expense_breakdown ??
      analytics.expensesByCategory ??
      analytics.expenses_by_category;

    if (Array.isArray(source)) {
      return source.map((item) => ({
        category: item.category ?? item.name ?? "Other",
        amount: getNumber(item.amount, item.total, item.value),
      }));
    }

    const grouped = {};
    transactions.filter((item) => item.type === "expense").forEach((item) => {
      grouped[item.subtitle] = (grouped[item.subtitle] || 0) + item.amount;
    });

    return Object.entries(grouped).map(([category, amount]) => ({ category, amount }));
  }, [analytics, transactions]);

  const revenueData = useMemo(() => {
    const source =
      analytics.monthlyRevenue ??
      analytics.monthly_revenue ??
      analytics.monthly ??
      analytics.revenueTrend ??
      analytics.revenue_trend;

    if (Array.isArray(source)) {
      return source.map((item) => ({
        month: item.month ?? item.label ?? item.period ?? "Period",
        revenue: getNumber(item.revenue, item.income, item.totalRevenue),
        expenses: getNumber(item.expenses, item.expense, item.totalExpenses),
      }));
    }

    const grouped = {};
    transactions.forEach((item) => {
      const date = new Date(item.date);
      if (Number.isNaN(date.getTime())) return;

      const month = date.toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      });

      if (!grouped[month]) {
        grouped[month] = { month, revenue: 0, expenses: 0, timestamp: date.getTime() };
      }

      grouped[month][item.type === "expense" ? "expenses" : "revenue"] += item.amount;
    });

    return Object.values(grouped)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ month, revenue, expenses }) => ({ month, revenue, expenses }));
  }, [analytics, transactions]);

  // --------------------------------------------------
  // Finance actions
  // --------------------------------------------------

  const reviewEmployeeRequest = async (request, decision) => {
    setActionError("");
    setActionMessage("");

    const isAccept = decision === "APPROVE";
    const actionLabel = isAccept ? "accept" : "decline";
    const confirmed = window.confirm(
      `${isAccept ? "Accept" : "Decline"} purchase request ${request.id} for ${request.title}?`
    );
    if (!confirmed) return;

    // Ask for an optional explanation on decline so the decision is auditable.
    let comment = "";
    if (!isAccept) {
      const reason = window.prompt("Reason for declining this request (optional):", "");
      if (reason === null) return; // User cancelled the decision.
      comment = reason.trim();
    }

    const actionKey = `${request.id}-${decision}`;
    setRequestActionLoading(actionKey);

    try {
      await procurementApi(
        `/requests/${encodeURIComponent(request.id)}/finance-decision`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision, comment }),
        }
      );

      // Update the UI immediately after the backend confirms the decision.
      // The subsequent refresh then reconciles the row with the database.
      const nextStatus = isAccept ? "Approved" : "Rejected";
      setEmployeeRequests((current) => current.map((item) =>
        item.id === request.id
          ? { ...item, status: nextStatus, decisionComment: comment }
          : item
      ));
      setActionMessage(
        `Request ${request.id} ${isAccept ? "accepted" : "declined"} successfully. Status updated to ${nextStatus}.`
      );

      await loadFinanceData(true);
    } catch (err) {
      setActionError(err.message || `Could not ${actionLabel} this request.`);
    } finally {
      setRequestActionLoading("");
    }
  };

  const markInvoicePaid = async (invoice) => {
    setActionError("");
    setActionMessage("");

    if (!invoice.id || invoice.id.startsWith("INV-") && !invoice.raw?.id) {
      setActionError("This invoice does not have a valid backend ID.");
      return;
    }

    if (invoice.outstanding <= 0) {
      setActionError("This invoice has no outstanding balance.");
      return;
    }

    try {
      // FIX: server.js records payments through this endpoint.
      await procurementApi(
        `/invoices/${encodeURIComponent(invoice.id)}/payment`,
        {
          method: "PATCH",
          body: JSON.stringify({ amount: invoice.outstanding }),
        }
      );

      setActionMessage(`Payment recorded for invoice ${invoice.id}.`);
      await loadFinanceData(true);
    } catch (err) {
      setActionError(err.message || "Could not record invoice payment.");
    }
  };

  const createInvoiceForRequest = async (request) => {
    const invoiceNumber = window.prompt(
      `Enter an invoice number for ${request.title}:`,
      `INV-${Date.now().toString().slice(-8)}`
    );

    if (!invoiceNumber?.trim()) return;

    setActionError("");
    setActionMessage("");
    setCreatingInvoiceFor(request.id);

    try {
      // Backend permits invoice creation only for fully approved requests.
      await procurementApi(
        `/requests/${encodeURIComponent(request.id)}/invoice`,
        {
          method: "POST",
          body: JSON.stringify({
            invoiceNumber: invoiceNumber.trim(),
            amount: request.amount,
          }),
        }
      );

      setActionMessage(`Invoice created for request ${request.id}.`);
      setActivePage("Invoices");
      await loadFinanceData(true);
    } catch (err) {
      setActionError(err.message || "Could not create invoice.");
    } finally {
      setCreatingInvoiceFor(null);
    }
  };

  const exportInvoices = () => {
    const rows = [
      ["Invoice ID", "Client", "Issue Date", "Due Date", "Amount INR", "Paid INR", "Outstanding INR", "Status"],
      ...filteredInvoices.map((item) => [
        item.id, item.client, item.date, item.dueDate,
        item.amount, item.paidAmount, item.outstanding, item.status,
      ]),
    ];

    const csv = rows.map((row) =>
      row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "etdox-finance-invoices.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------
  // Shared UI renderers
  // --------------------------------------------------

  const renderInvoices = (compact = false) => (
    <div className="finance-table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            <th>Invoice</th><th>Client / Employee</th><th>Issue date</th>
            <th>Amount</th><th>Paid</th><th>Status</th>
            {!compact && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {filteredInvoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <div className="finance-invoice-id">
                  <span className="finance-file-icon"><FileText size={17} /></span>
                  <strong>{invoice.invoiceNumber || invoice.id}</strong>
                </div>
              </td>
              <td>{invoice.client}</td>
              <td>{formatDate(invoice.date)}</td>
              <td className="finance-amount-cell">{formatCurrency(invoice.amount)}</td>
              <td>{formatCurrency(invoice.paidAmount)}</td>
              <td>
                <span className={`finance-status finance-status-${invoice.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  <span />{invoice.status}
                </span>
              </td>
              {!compact && (
                <td>
                  {invoice.outstanding > 0 ? (
                    <button className="finance-table-action" onClick={() => markInvoicePaid(invoice)}>
                      Record payment
                    </button>
                  ) : (
                    <span className="finance-paid-label"><CheckCircle2 size={14} /> Paid</span>
                  )}
                </td>
              )}
            </tr>
          ))}
          {!loading && filteredInvoices.length === 0 && (
            <tr><td colSpan={compact ? 6 : 7} className="finance-empty">No invoices found.</td></tr>
          )}
          {loading && (
            <tr><td colSpan={compact ? 6 : 7} className="finance-empty">Loading invoices…</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderTransactions = (limit) => {
    const visible = limit ? transactions.slice(0, limit) : transactions;

    if (!visible.length) {
      return <p className="finance-empty">{loading ? "Loading transactions…" : "No transaction records found."}</p>;
    }

    return (
      <div className="finance-transaction-list">
        {visible.map((item) => (
          <div className="finance-transaction-row" key={item.id}>
            <div className={`finance-transaction-icon ${item.type}`}>
              {item.type === "income" ? <ArrowDownRight size={19} /> : <ArrowUpRight size={19} />}
            </div>
            <div className="finance-transaction-info">
              <strong>{item.title}</strong><span>{item.subtitle}</span>
            </div>
            <span className="finance-transaction-date">{formatDate(item.date)}</span>
            <strong className={`finance-transaction-amount ${item.type}`}>
              {item.type === "income" ? "+" : "-"}{formatCurrency(item.amount)}
            </strong>
          </div>
        ))}
      </div>
    );
  };

  const renderEmployeeRequests = () => (
    <section className="finance-panel">
      <div className="finance-section-heading">
        <div>
          <h2>Employee Purchase Requests</h2>
          <p>Review employee purchase requests. Accept or decline an unresolved request; final decisions are shown in the status column.</p>
        </div>
        <button className="finance-secondary-button" onClick={() => loadFinanceData(true)} disabled={refreshing}>
          <RefreshCw size={16} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="finance-api-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>Backend data warning</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="finance-invoice-summary">
        <div><span>Total requests</span><strong>{employeeRequests.length}</strong></div>
        <div><span>Awaiting manager</span><strong>{pendingManagerRequests.length}</strong></div>
        <div><span>Awaiting Finance</span><strong>{pendingFinanceRequests.length}</strong></div>
      </div>

      <div className="finance-table-toolbar">
        <label className="finance-search">
          <Search size={17} />
          <input value={requestSearch} onChange={(e) => setRequestSearch(e.target.value)} placeholder="Search employee, request, or department…" />
        </label>
        <select value={requestFilter} onChange={(e) => setRequestFilter(e.target.value)} aria-label="Filter requests">
          <option value="All">All statuses</option>
          <option value="Pending Manager">Awaiting manager</option>
          <option value="Pending Finance">Awaiting Finance</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {loading && employeeRequests.length === 0 ? (
        <p className="finance-empty">Loading employee requests…</p>
      ) : filteredRequests.length === 0 ? (
        <div className="finance-empty">
          <ClipboardList size={28} />
          <p>No employee requests match this filter.</p>
          <p>Check the API connection and confirm that employee requests have been saved in the database. Use Refresh to load the latest backend records.</p>
        </div>
      ) : (
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Employee</th><th>Request</th><th>Department</th>
                <th>Justification</th><th>Amount</th><th>Submitted</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.employeeName}</strong><br />
                    <span>{request.employeeEmail}</span>
                  </td>
                  <td>
                    <strong>{request.title}</strong><br />
                    <span>{request.id}</span>
                  </td>
                  <td>{request.department}</td>
                  <td>
                    {request.description.length > 120
                      ? `${request.description.slice(0, 120)}…`
                      : request.description}
                    {request.decisionComment && (
                      <div className="finance-request-decision-note">
                        <strong>Finance note:</strong> {request.decisionComment}
                      </div>
                    )}
                  </td>
                  <td className="finance-amount-cell">{formatCurrency(request.amount)}</td>
                  <td>{formatDate(request.date)}</td>
                  <td>
                    <span className={`finance-status finance-status-${request.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      <span />{request.status}
                    </span>
                  </td>
                  <td>
                    {canFinanceDecide(request) ? (
                      <div className="finance-request-actions">
                        <button
                          className="finance-request-approve"
                          disabled={Boolean(requestActionLoading)}
                          onClick={() => reviewEmployeeRequest(request, "APPROVE")}
                        >
                          {requestActionLoading === `${request.id}-APPROVE` ? "Accepting…" : "Accept request"}
                        </button>
                        <button
                          className="finance-request-reject"
                          disabled={Boolean(requestActionLoading)}
                          onClick={() => reviewEmployeeRequest(request, "REJECT")}
                        >
                          {requestActionLoading === `${request.id}-REJECT` ? "Declining…" : "Decline"}
                        </button>
                      </div>
                    ) : request.status === "Approved" ? (
                      <button
                        className="finance-table-action"
                        disabled={creatingInvoiceFor === request.id}
                        onClick={() => createInvoiceForRequest(request)}
                      >
                        {creatingInvoiceFor === request.id ? "Creating…" : "Create invoice"}
                      </button>
                    ) : (
                      <span className="finance-request-closed-label">Decision recorded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const renderBudgets = () => (
    <section className="finance-panel">
      <div className="finance-section-heading">
        <div><h2>Department Budgets</h2><p>Allocated, committed, spent, and available funds.</p></div>
        <button className="finance-secondary-button" onClick={() => loadFinanceData(true)} disabled={refreshing}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {budgets.length === 0 ? (
        <p className="finance-empty">No budget records returned by the backend.</p>
      ) : (
        <div className="finance-budget-list">
          {budgets.map((budget) => {
            const used = budget.limit > 0 ? Math.min(100, ((budget.spent + budget.committed) / budget.limit) * 100) : 0;
            return (
              <div className="finance-budget-row" key={budget.id}>
                <div className="finance-budget-heading">
                  <div><strong>{budget.name}</strong><span>{budget.department}</span></div>
                  <span>{Math.round(used)}% allocated</span>
                </div>
                <div className="finance-budget-track">
                  <span style={{ width: `${used}%` }} className={used >= 90 ? "budget-warning" : ""} />
                </div>
                <div className="finance-budget-footer">
                  <span>Spent: {formatCurrency(budget.spent)}</span>
                  <span>Committed: {formatCurrency(budget.committed)}</span>
                  <span>Available: {formatCurrency(budget.remaining)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderReports = () => (
    <>
      <section className="finance-panel">
        <div className="finance-section-heading">
          <div><h2>Expense Breakdown</h2><p>Spending categories from available transaction records.</p></div>
          <button className="finance-secondary-button" onClick={exportInvoices}><Download size={16} /> Export invoices</button>
        </div>
        {expenseData.length === 0 ? <p className="finance-empty">No expense breakdown available.</p> : (
          <div className="finance-report-chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="amount" name="Expenses" fill="#6860e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <section className="finance-panel">
        <div className="finance-section-heading">
          <div><h2>Monthly Revenue and Expenses</h2><p>Monthly totals from analytics or transactions.</p></div>
        </div>
        {revenueData.length === 0 ? <p className="finance-empty">No monthly records available.</p> : (
          <div className="finance-report-chart">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6258e8" fill="#e8e6ff" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f0a04a" fill="#fff0dc" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </>
  );

  const renderSettings = () => (
    <section className="finance-panel">
      <div className="finance-section-heading">
        <div><h2>Finance Settings</h2><p>Finance workspace configuration.</p></div>
        <Settings size={22} />
      </div>
      <div className="finance-setting-row">
        <div><strong>Reporting currency</strong><p>Indian Rupee (INR · ₹)</p></div>
        <span className="finance-setting-tag">INR</span>
      </div>
      <div className="finance-setting-row">
        <div><strong>Finance API</strong><p>{API_BASE_URL}</p></div>
        <span className="finance-setting-tag">{error ? "Check connection" : "Configured"}</span>
      </div>
      <div className="finance-setting-row">
        <div><strong>Procurement API</strong><p>{PROCUREMENT_API_URL}</p></div>
        <span className="finance-setting-tag">{employeeRequests.length} requests</span>
      </div>
      <button className="finance-primary-button finance-settings-refresh" onClick={() => loadFinanceData(true)} disabled={refreshing}>
        <RefreshCw size={16} /> Refresh finance data
      </button>
    </section>
  );

  const renderContent = () => {
    if (activePage === "Employee Requests") return renderEmployeeRequests();
    if (activePage === "Budgets") return renderBudgets();
    if (activePage === "Reports") return renderReports();
    if (activePage === "Settings") return renderSettings();

    if (activePage === "Transactions") {
      return (
        <section className="finance-panel">
          <div className="finance-section-heading">
            <div><h2>Transactions</h2><p>Payment and transaction records from your backend.</p></div>
            <button className="finance-secondary-button" onClick={() => loadFinanceData(true)} disabled={refreshing}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
          {renderTransactions()}
        </section>
      );
    }

    if (activePage === "Invoices") {
      return (
        <section className="finance-panel">
          <div className="finance-section-heading">
            <div><h2>Invoices</h2><p>Invoices created for approved purchase requests.</p></div>
            <button className="finance-secondary-button" onClick={() => setActivePage("Employee Requests")}>
              <ClipboardList size={16} /> Approved requests
            </button>
          </div>
          <div className="finance-invoice-summary">
            <div><span>Total invoice value</span><strong>{formatCurrency(totalInvoiceValue)}</strong></div>
            <div><span>Payments received</span><strong>{formatCurrency(paidValue)}</strong></div>
            <div><span>Outstanding balance</span><strong>{formatCurrency(pendingValue)}</strong></div>
          </div>
          <div className="finance-table-toolbar">
            <label className="finance-search">
              <Search size={17} />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search invoices or clients…" />
            </label>
            <select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)} aria-label="Filter invoices">
              <option value="All">All statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially paid</option>
              <option value="Pending">Unpaid</option>
              <option value="Overdue">Overdue</option>
            </select>
            <button className="finance-secondary-button" onClick={exportInvoices}><Download size={16} /> Export CSV</button>
          </div>
          {renderInvoices()}
        </section>
      );
    }

    return (
      <>
        <section className="finance-welcome">
          <div className="finance-welcome-content">
            <span className="finance-eyebrow">FINANCE WORKSPACE</span>
            <h2>Financial clarity starts here.</h2>
            <p>Monitor cash flow, track invoices, and review employee purchase requests.</p>
            <button className="finance-primary-button" onClick={() => setActivePage("Employee Requests")}>
              Review requests <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="finance-welcome-art">
            <div className="finance-welcome-art-circle"><CircleDollarSign size={53} /></div>
            <div className="finance-welcome-floating"><TrendingUp size={16} /> Finance overview</div>
          </div>
        </section>

        <section className="finance-stats-grid">
          {[
            { label: "Total revenue", value: totalRevenue, icon: Wallet, color: "purple" },
            { label: "Total expenses", value: totalExpenses, icon: CreditCard, color: "orange" },
            { label: "Net profit", value: netProfit, icon: ChartNoAxesCombined, color: "green" },
            { label: "Outstanding invoices", value: pendingValue, icon: Clock3, color: "blue" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div className="finance-stat-card" key={stat.label}>
                <div className="finance-stat-top">
                  <span>{stat.label}</span>
                  <div className={`finance-stat-icon ${stat.color}`}><Icon size={20} /></div>
                </div>
                <strong className="finance-stat-value">{loading ? "Loading…" : formatCurrency(stat.value)}</strong>
                <div className="finance-stat-foot">
                  <span>From backend records</span>
                  {stat.label === "Outstanding invoices" && (
                    <button className="finance-inline-link" onClick={() => setActivePage("Invoices")}>View <ArrowUpRight size={13} /></button>
                  )}
                </div>
                <div className={`finance-progress ${stat.color === "orange" ? "orange-progress" : stat.color === "green" ? "green-progress" : stat.color === "blue" ? "blue-progress" : ""}`}>
                  <span style={{ width: stat.value > 0 ? "65%" : "0%" }} />
                </div>
              </div>
            );
          })}
        </section>

        {pendingFinanceRequests.length > 0 && (
          <div className="finance-overdue-notice">
            <ClipboardList size={18} />
            <span>{pendingFinanceRequests.length} request(s) are waiting for Finance approval.</span>
            <button onClick={() => setActivePage("Employee Requests")}>Review requests</button>
          </div>
        )}

        {pendingManagerRequests.length > 0 && (
          <div className="finance-overdue-notice">
            <Clock3 size={18} />
            <span>{pendingManagerRequests.length} request(s) are still waiting for manager approval.</span>
            <button onClick={() => setActivePage("Employee Requests")}>View requests</button>
          </div>
        )}

        {overdueValue > 0 && (
          <div className="finance-overdue-notice">
            <AlertCircle size={18} />
            <span>{formatCurrency(overdueValue)} in overdue invoices.</span>
            <button onClick={() => { setInvoiceFilter("Overdue"); setActivePage("Invoices"); }}>Review invoices</button>
          </div>
        )}

        <section className="finance-chart-grid">
          <div className="finance-panel finance-revenue-panel">
            <div className="finance-section-heading">
              <div><h2>Revenue Overview</h2><p>Revenue versus expenses from backend records.</p></div>
              <button className="finance-more-button" onClick={() => loadFinanceData(true)} disabled={refreshing} aria-label="Refresh revenue data">
                <RefreshCw size={18} />
              </button>
            </div>
            {revenueData.length === 0 ? <p className="finance-empty">No monthly revenue data available yet.</p> : (
              <div className="finance-chart">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6258e8" fill="#e8e6ff" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f0a04a" fill="#fff0dc" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="finance-panel finance-expense-panel">
            <div className="finance-section-heading">
              <div><h2>Expense Breakdown</h2><p>Spending categories from financial records.</p></div>
              <button className="finance-more-button" onClick={() => setActivePage("Reports")} aria-label="Open reports"><MoreHorizontal size={20} /></button>
            </div>
            {expenseData.length === 0 ? <p className="finance-empty">No expense breakdown available.</p> : (
              <div className="finance-expense-chart">
                <ResponsiveContainer width="100%" height={245}>
                  <BarChart data={expenseData} barSize={26}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="amount" name="Expenses" fill="#7770ec" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="finance-expense-total"><span>Total tracked expenses</span><strong>{formatCurrency(totalExpenses)}</strong></div>
          </div>
        </section>

        <section className="finance-panel finance-recent-panel">
          <div className="finance-section-heading">
            <div><h2>Recent Invoices</h2><p>Latest invoice activity from the backend.</p></div>
            <button className="finance-text-button" onClick={() => setActivePage("Invoices")}>View all invoices <ArrowUpRight size={15} /></button>
          </div>
          <div className="finance-table-toolbar finance-home-toolbar">
            <label className="finance-search"><Search size={16} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search invoices…" /></label>
            <button className="finance-secondary-button" onClick={exportInvoices}><Download size={15} /> Export</button>
          </div>
          {renderInvoices(true)}
        </section>

        <section className="finance-panel finance-transactions-panel">
          <div className="finance-section-heading">
            <div><h2>Recent Transactions</h2><p>Latest payment records.</p></div>
            <button className="finance-text-button" onClick={() => setActivePage("Transactions")}>View transactions <ArrowUpRight size={15} /></button>
          </div>
          {renderTransactions(5)}
        </section>
      </>
    );
  };

  // --------------------------------------------------
  // Main layout
  // --------------------------------------------------

  const logout = () => {
    const keys = [
      "accessToken", "access_token", "token", "authToken", "auth_token",
      "jwt", "jwtToken", "etdoxToken", "etdox_token", "user", "auth", "session"
    ];

    [window.localStorage, window.sessionStorage].forEach((store) => {
      keys.forEach((key) => store.removeItem(key));
    });

    window.location.href = "/login";
  };

  return (
    <div className="finance-dashboard">
      {mobileMenuOpen && (
        <button className="finance-mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" />
      )}

      <aside className={`finance-sidebar ${mobileMenuOpen ? "finance-sidebar-open" : ""}`}>
        <div className="finance-brand">
          <div className="finance-brand-mark">E</div>
          <div className="finance-brand-copy"><strong>ETDOX</strong><span>FINANCE WORKSPACE</span></div>
          <button className="finance-close-menu" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <div className="finance-sidebar-label">FINANCE MANAGEMENT</div>

        <nav className="finance-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className={`finance-nav-item ${activePage === item.label ? "active" : ""}`} onClick={() => { setActivePage(item.label); setMobileMenuOpen(false); }}>
                <Icon size={19} /><span>{item.label}</span>
                {item.label === "Invoices" && <span className="finance-nav-count">{invoices.length}</span>}
                {item.label === "Employee Requests" && pendingFinanceRequests.length > 0 && <span className="finance-nav-count">{pendingFinanceRequests.length}</span>}
              </button>
            );
          })}
        </nav>

        <div className="finance-sidebar-bottom">
          <div className="finance-help-card">
            <div className="finance-help-icon"><CircleDollarSign size={20} /></div>
            <strong>Need financial help?</strong>
            <p>Contact your finance administrator for assistance.</p>
            <a href="mailto:finance@example.com">Contact finance <ArrowUpRight size={14} /></a>
          </div>
          <button className="finance-logout" onClick={logout}><LogOut size={18} /> Log out</button>
        </div>
      </aside>

      <main className="finance-main">
        <header className="finance-topbar">
          <div className="finance-topbar-left">
            <button className="finance-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
            <div>
              <div className="finance-breadcrumb">Workspace <span>/</span> Finance <span>/</span> {activePage}</div>
              <h1>{activePage}</h1>
            </div>
          </div>

          <div className="finance-topbar-right">
            <div className="finance-topbar-date"><CalendarDays size={16} /><span>{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span></div>
            <button className="finance-notification" aria-label="Finance notifications" onClick={() => setActivePage(pendingFinanceRequests.length ? "Employee Requests" : "Invoices")}>
              <Bell size={20} />
              {(pendingFinanceRequests.length > 0 || overdueValue > 0) && <span />}
            </button>
            <div className="finance-user-profile">
              <div className="finance-user-avatar">FM</div>
              <div><strong>Finance Manager</strong><span>Finance Department</span></div>
            </div>
          </div>
        </header>

        <div className="finance-page-content">
          {error && (
            <div className="finance-api-error" role="alert">
              <AlertCircle size={18} />
              <div><strong>Some finance data could not be loaded</strong><p>{error}</p></div>
              <button className="finance-error-retry" onClick={() => loadFinanceData(true)} disabled={refreshing}><RefreshCw size={15} /> Retry</button>
            </div>
          )}

          {actionError && (
            <div className="finance-api-error" role="alert">
              <AlertCircle size={18} /><p>{actionError}</p>
              <button onClick={() => setActionError("")} aria-label="Dismiss error"><X size={16} /></button>
            </div>
          )}

          {actionMessage && (
            <div className="finance-success-message" role="status">
              <CheckCircle2 size={17} /><span>{actionMessage}</span>
              <button onClick={() => setActionMessage("")} aria-label="Dismiss message"><X size={16} /></button>
            </div>
          )}

          {refreshing && <div className="finance-refresh-indicator"><RefreshCw size={14} /> Refreshing finance data…</div>}
          {renderContent()}
        </div>

        <footer className="finance-footer">
          <span>© {new Date().getFullYear()} ETDOX. All rights reserved.</span>
          <span>Finance Workspace · Backend-connected</span>
        </footer>
      </main>
    </div>
  );
}
