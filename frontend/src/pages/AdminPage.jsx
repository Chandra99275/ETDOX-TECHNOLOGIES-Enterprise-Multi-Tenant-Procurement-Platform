
import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Wallet,
  Building2,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  Plus,
  Mail,
  Phone,
  MapPin,
  Truck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE_ENV = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const API_BASE = /\/api\/v1$/i.test(API_BASE_ENV)
  ? API_BASE_ENV
  : /\/api$/i.test(API_BASE_ENV)
    ? `${API_BASE_ENV}/v1`
    : `${API_BASE_ENV}/api/v1`;

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const getArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
    if (Array.isArray(response?.data?.data?.[key])) {
      return response.data.data[key];
    }
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.result)) return response.result;

  return [];
};

const normalizeRole = (role) => {
  if (typeof role === "string") {
    return role.toLowerCase().trim().replaceAll(" ", "_");
  }

  if (role && typeof role === "object") {
    return String(
      role.name ||
        role.role ||
        role.roleName ||
        role.role_name ||
        role.slug ||
        ""
    )
      .toLowerCase()
      .trim()
      .replaceAll(" ", "_");
  }

  return "";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
};

const getStatus = (request) =>
  String(request.status || request.requestStatus || "PENDING")
    .toUpperCase()
    .replaceAll(" ", "_");

const getEmployee = (request) =>
  request.employeeName ||
  request.employee?.name ||
  request.requester?.name ||
  request.user?.name ||
  request.createdByName ||
  "Employee";

const getProduct = (request) =>
  request.productName ||
  request.product_name ||
  request.title ||
  request.itemName ||
  "Product request";

const getAmount = (request) =>
  Number(
    request.totalAmount ??
      request.total_amount ??
      request.amount ??
      Number(request.quantity || 0) *
        Number(request.unitPrice || request.unit_price || 0)
  );

const getSupplierName = (supplier) =>
  supplier.legalName ||
  supplier.legal_name ||
  supplier.name ||
  supplier.tradingName ||
  supplier.trading_name ||
  "Unnamed supplier";

const getSupplierCode = (supplier) =>
  supplier.code ||
  supplier.supplierCode ||
  supplier.supplier_code ||
  "—";

const getSupplierStatus = (supplier) =>
  String(
    supplier.status ||
      supplier.onboardingStatus ||
      supplier.onboarding_status ||
      "PENDING"
  )
    .toUpperCase()
    .replaceAll(" ", "_");

const initialSupplierForm = {
  name: "",
  code: "",
  email: "",
  phone: "",
  contactPerson: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
  taxId: "",
  category: "",
  paymentTerms: "",
  notes: "",
  status: "pending",
};

export default function AdminPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Overview");
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [adminName, setAdminName] = useState("Administrator");
  const [currentRole, setCurrentRole] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ============================================================
  // API REQUEST HELPER
  // ============================================================

  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();

    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;

    const response = await fetch(`${API_BASE}${normalizedEndpoint}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const validationErrors = Array.isArray(data.errors)
        ? data.errors
            .map((item) => item.message)
            .filter(Boolean)
            .join(", ")
        : "";

      throw new Error(
        data.message ||
          data.error ||
          validationErrors ||
          data.details ||
          `API request failed (${response.status})`
      );
    }

    return data;
  };

  // ============================================================
  // SUPPLIER API
  // ============================================================

  const loadSuppliers = async (showLoader = false) => {
    if (showLoader) setSupplierLoading(true);

    try {
      const result = await apiRequest(
        "/suppliers?page=1&limit=100"
      );

      const supplierList = getArray(result, [
        "suppliers",
        "items",
        "results",
      ]);

      setSuppliers(supplierList);

      return supplierList;
    } catch (err) {
      setSuppliers([]);
      throw err;
    } finally {
      if (showLoader) setSupplierLoading(false);
    }
  };

  // ============================================================
  // DASHBOARD DATA
  // ============================================================

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      apiRequest("/procurement/requests"),
      apiRequest("/budgets"),
      apiRequest("/users"),
      apiRequest("/auth/me"),
      apiRequest("/suppliers?page=1&limit=100"),
    ]);

    // Procurement requests
    if (results[0].status === "fulfilled") {
      setRequests(
        getArray(results[0].value, [
          "requests",
          "items",
          "results",
        ])
      );
    } else {
      setRequests([]);
    }

    // Budgets
    if (results[1].status === "fulfilled") {
      setBudgets(
        getArray(results[1].value, [
          "budgets",
          "items",
          "results",
        ])
      );
    } else {
      setBudgets([]);
    }

    // Employees / users
    if (results[2].status === "fulfilled") {
      setUsers(
        getArray(results[2].value, [
          "users",
          "employees",
          "items",
          "results",
        ])
      );
    } else {
      setUsers([]);
    }

    // Authenticated user
    if (results[3].status === "fulfilled") {
      const result = results[3].value;

      const user =
        result?.user ||
        result?.data?.user ||
        result?.data ||
        result;

      const fullName =
        user?.name ||
        user?.fullName ||
        user?.full_name ||
        [
          user?.first_name,
          user?.last_name,
        ]
          .filter(Boolean)
          .join(" ");

      if (fullName) {
        setAdminName(fullName);
      }

      const roles = Array.isArray(user?.roles)
        ? user.roles.map(normalizeRole)
        : [];

      const role = normalizeRole(
        user?.role ||
          user?.roleName ||
          user?.role_name ||
          user?.primaryRole ||
          user?.primary_role ||
          roles[0] ||
          ""
      );

      setCurrentRole(role);
    } else {
      setCurrentRole("");
    }

    // Suppliers
    if (results[4].status === "fulfilled") {
      setSuppliers(
        getArray(results[4].value, [
          "suppliers",
          "items",
          "results",
        ])
      );
    } else {
      setSuppliers([]);
    }

    const coreFailures = results
      .slice(0, 4)
      .filter((result) => result.status === "rejected");

    if (coreFailures.length === 4) {
      setError(
        "Unable to connect to the admin APIs. Check your backend."
      );
    } else if (coreFailures.length > 0) {
      setError(
        "Some dashboard information could not be loaded. Check your API routes and permissions."
      );
    } else if (results[4].status === "rejected") {
      setError(
        "Dashboard loaded, but suppliers could not be fetched. Check the supplier API."
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    loadDashboard();
  }, []);

  // ============================================================
  // PERMISSIONS
  // ============================================================

  const canManageSuppliers = [
    "admin",
    "finance",
    "organization_admin",
    "finance_manager",
  ].includes(currentRole);

  // ============================================================
  // DASHBOARD CALCULATIONS
  // ============================================================

  const pendingRequests = useMemo(
    () =>
      requests.filter((r) =>
        [
          "PENDING",
          "SUBMITTED",
          "PENDING_MANAGER",
          "MANAGER_PENDING",
          "PENDING_FINANCE",
          "MANAGER_APPROVED",
        ].includes(getStatus(r))
      ),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter((r) =>
        [
          "APPROVED",
          "FINANCE_APPROVED",
          "COMPLETED",
        ].includes(getStatus(r))
      ),
    [requests]
  );

  const rejectedRequests = useMemo(
    () =>
      requests.filter((r) =>
        [
          "REJECTED",
          "MANAGER_REJECTED",
          "FINANCE_REJECTED",
        ].includes(getStatus(r))
      ),
    [requests]
  );

  const totalBudget = useMemo(
    () =>
      budgets.reduce(
        (sum, b) =>
          sum +
          Number(
            b.allocated ??
              b.totalBudget ??
              b.total_budget ??
              b.amount ??
              0
          ),
        0
      ),
    [budgets]
  );

  const totalSpent = useMemo(
    () =>
      budgets.reduce(
        (sum, b) =>
          sum +
          Number(
            b.spent ??
              b.used ??
              b.committed ??
              0
          ),
        0
      ),
    [budgets]
  );

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredRequests = useMemo(() => {
    let list = [...requests];

    if (statusFilter !== "ALL") {
      list = list.filter(
        (r) => getStatus(r) === statusFilter
      );
    }

    const query = search.toLowerCase().trim();

    if (query) {
      list = list.filter((r) =>
        [
          getEmployee(r),
          getProduct(r),
          r.supplier || r.supplierName || "",
          r.department || r.departmentName || "",
          r.id || r.requestId || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    return list;
  }, [requests, statusFilter, search]);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return users;

    return users.filter((user) =>
      [
        user.name,
        user.fullName,
        user.full_name,
        user.email,
        user.role,
        user.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  const filteredSuppliers = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return suppliers;

    return suppliers.filter((supplier) =>
      [
        getSupplierName(supplier),
        getSupplierCode(supplier),
        supplier.email,
        supplier.phone,
        supplier.contactPerson,
        supplier.contact_person,
        supplier.category,
        supplier.city,
        supplier.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [suppliers, search]);

  // ============================================================
  // STATUS STYLING
  // ============================================================

  const statusStyle = (status) => {
    if (
      [
        "APPROVED",
        "FINANCE_APPROVED",
        "COMPLETED",
        "ACTIVE",
      ].includes(status)
    ) {
      return "approved";
    }

    if (
      [
        "REJECTED",
        "MANAGER_REJECTED",
        "FINANCE_REJECTED",
        "INACTIVE",
        "SUSPENDED",
        "ARCHIVED",
      ].includes(status)
    ) {
      return "rejected";
    }

    return "pending";
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // ============================================================
  // SUPPLIER FORM
  // ============================================================

  const updateSupplierField = (event) => {
    const { name, value } = event.target;

    setSupplierForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const submitSupplier = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!canManageSuppliers) {
      setError(
        "Only Admin and Finance users can register suppliers."
      );
      return;
    }

    if (
      !supplierForm.name.trim() ||
      supplierForm.name.trim().length < 2
    ) {
      setError("Supplier name must contain at least 2 characters.");
      return;
    }

    const payload = {
      name: supplierForm.name.trim(),
      status: supplierForm.status,
    };

    // Supplier code is optional in the backend route.
    if (supplierForm.code.trim()) {
      payload.code = supplierForm.code.trim();
    }

    const optionalFields = [
      "email",
      "phone",
      "contactPerson",
      "address",
      "city",
      "state",
      "country",
      "postalCode",
      "taxId",
      "category",
      "paymentTerms",
      "notes",
    ];

    optionalFields.forEach((field) => {
      const value = supplierForm[field]?.trim();

      if (value) {
        payload[field] = value;
      }
    });

    setSupplierSaving(true);

    try {
      await apiRequest("/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSupplierForm(initialSupplierForm);
      setShowSupplierModal(false);

      setSuccess("Supplier registered successfully.");

      try {
        await loadSuppliers(true);
      } catch (refreshError) {
        setError(
          "Supplier was created, but the supplier list could not be refreshed. Please refresh the page."
        );
      }
    } catch (err) {
      setError(
        err.message || "Unable to register supplier."
      );
    } finally {
      setSupplierSaving(false);
    }
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "All Requests", icon: ClipboardList },
    { name: "Employees", icon: Users },
    { name: "Budgets", icon: Wallet },
    { name: "Suppliers", icon: Truck },
  ];

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="admin-app">
      <style>{`
        * { box-sizing: border-box; }
        .admin-app {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }
        .admin-sidebar {
          width: 250px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #111c35;
          color: white;
          padding: 25px 16px;
        }
        .admin-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px 30px;
          font-size: 21px;
          font-weight: 800;
        }
        .admin-brand-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #3675f5;
        }
        .admin-nav-label {
          padding: 10px 12px;
          color: #8492ae;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .admin-nav {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 12px;
          margin: 3px 0;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #aebbd2;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }
        .admin-nav.active, .admin-nav:hover {
          background: #263b65;
          color: white;
        }
        .admin-sidebar-bottom {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #2b3955;
        }
        .admin-main {
          flex: 1;
          min-width: 0;
          padding: 28px 34px;
        }
        .admin-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 28px;
        }
        .admin-heading h1 {
          margin: 0 0 7px;
          font-size: 25px;
          color: #172033;
        }
        .admin-heading p {
          margin: 0;
          color: #8490a4;
          font-size: 13px;
        }
        .admin-top-actions {
          display: flex;
          align-items: center;
          gap: 13px;
        }
        .admin-icon-btn {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 1px solid #e5e9f1;
          border-radius: 10px;
          background: white;
          color: #59677e;
          cursor: pointer;
        }
        .admin-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 12px;
          border: 1px solid #e7ebf2;
          border-radius: 11px;
          background: white;
        }
        .admin-avatar {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #3675f5;
          color: white;
          font-weight: 700;
        }
        .admin-profile strong { display: block; font-size: 12px; }
        .admin-profile small { color: #8a96a8; font-size: 10px; }
        .admin-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 22px;
        }
        .admin-stat {
          padding: 19px;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          background: white;
        }
        .admin-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #7d899c;
          font-size: 12px;
          font-weight: 600;
        }
        .admin-stat-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #edf3ff;
          color: #3675f5;
        }
        .admin-stat h2 {
          margin: 13px 0 5px;
          font-size: 25px;
        }
        .admin-stat small { color: #929daf; font-size: 11px; }
        .admin-secondary-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 22px;
        }
        .admin-secondary-card {
          padding: 18px 20px;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          background: white;
        }
        .admin-secondary-card h3 {
          margin: 0 0 8px;
          font-size: 13px;
          color: #64728a;
        }
        .admin-secondary-card strong {
          display: block;
          font-size: 22px;
          margin-bottom: 6px;
        }
        .admin-progress {
          height: 7px;
          overflow: hidden;
          border-radius: 20px;
          background: #edf0f5;
        }
        .admin-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #3675f5;
        }
        .admin-panel {
          overflow: hidden;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          background: white;
        }
        .admin-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 21px;
          border-bottom: 1px solid #edf0f5;
        }
        .admin-panel-head h2 { margin: 0 0 5px; font-size: 16px; }
        .admin-panel-head p { margin: 0; color: #929daf; font-size: 11px; }
        .admin-controls { display: flex; flex-wrap: wrap; gap: 10px; }
        .admin-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          background: white;
        }
        .admin-search input {
          width: 180px;
          padding: 10px 0;
          border: 0;
          outline: 0;
          font-size: 12px;
        }
        .admin-select {
          padding: 9px 11px;
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          background: white;
          color: #526078;
          font-size: 12px;
          outline: 0;
        }
        .admin-table-wrap { overflow-x: auto; }
        .admin-table {
          width: 100%;
          min-width: 750px;
          border-collapse: collapse;
        }
        .admin-table th {
          padding: 13px 16px;
          background: #fafbfd;
          border-bottom: 1px solid #edf0f5;
          color: #8b96a8;
          font-size: 10px;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: .6px;
        }
        .admin-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #f0f2f6;
          color: #536078;
          font-size: 12px;
        }
        .admin-table tr:last-child td { border-bottom: 0; }
        .admin-person { display: flex; align-items: center; gap: 9px; }
        .admin-person-avatar {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #edf3ff;
          color: #3675f5;
          font-weight: 700;
        }
        .admin-person strong {
          display: block;
          color: #27344a;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .admin-person small {
          display: block;
          color: #9aa4b4;
          font-size: 10px;
        }
        .admin-status {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }
        .admin-status.pending { background: #fff5df; color: #b77a13; }
        .admin-status.approved { background: #e6f8ef; color: #16844e; }
        .admin-status.rejected { background: #ffe9e9; color: #cf4444; }
        .admin-action {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 1px solid #e5e9f1;
          border-radius: 7px;
          background: white;
          color: #64728a;
          cursor: pointer;
        }
        .admin-empty, .admin-loading {
          padding: 55px 20px;
          text-align: center;
          color: #8995a8;
          font-size: 13px;
        }
        .admin-empty svg { margin-bottom: 10px; }
        .admin-alert {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 17px;
          padding: 12px 15px;
          border-radius: 9px;
          font-size: 12px;
        }
        .admin-alert.error { color: #b52c35; background: #fff0f0; }
        .admin-alert.success { color: #13764a; background: #e9f8f0; }
        .admin-budget-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          padding: 20px;
        }
        .admin-budget-card {
          padding: 17px;
          border: 1px solid #edf0f5;
          border-radius: 11px;
        }
        .admin-budget-card h3 { margin: 0 0 8px; font-size: 13px; }
        .admin-budget-card p { margin: 0 0 13px; color: #8d98aa; font-size: 11px; }
        .admin-budget-card strong { display: block; margin-bottom: 10px; font-size: 19px; }
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(13, 24, 44, .55);
        }
        .admin-modal {
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          border-radius: 15px;
          background: white;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
        }
        .admin-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .admin-modal-head h2 { margin: 0; font-size: 18px; }
        .admin-close {
          width: 31px;
          height: 31px;
          border: 0;
          border-radius: 8px;
          background: #f1f3f7;
          cursor: pointer;
        }
        .admin-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .admin-detail {
          min-width: 0;
          padding: 12px;
          border: 1px solid #edf0f5;
          border-radius: 9px;
        }
        .admin-detail small {
          display: block;
          margin-bottom: 6px;
          color: #929daf;
          font-size: 10px;
        }
        .admin-detail strong {
          color: #27344a;
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .admin-mobile-menu { display: none; }
        .supplier-primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 15px;
          border: 0;
          border-radius: 8px;
          background: #3675f5;
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .supplier-primary-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .supplier-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .supplier-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .supplier-form-field.full { grid-column: 1 / -1; }
        .supplier-form-field label {
          color: #58657b;
          font-size: 11px;
          font-weight: 700;
        }
        .supplier-form-field input,
        .supplier-form-field select,
        .supplier-form-field textarea {
          width: 100%;
          padding: 11px 12px;
          border: 1px solid #e2e7ef;
          border-radius: 8px;
          outline: none;
          background: white;
          color: #26344b;
          font-family: inherit;
          font-size: 12px;
        }
        .supplier-form-field input:focus,
        .supplier-form-field select:focus,
        .supplier-form-field textarea:focus {
          border-color: #3675f5;
          box-shadow: 0 0 0 3px rgba(54,117,245,.1);
        }
        .supplier-form-field textarea {
          min-height: 75px;
          resize: vertical;
        }
        .supplier-form-field input::placeholder,
        .supplier-form-field textarea::placeholder {
          color: #a4adbb;
        }
        .supplier-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }
        .supplier-secondary-btn {
          padding: 10px 15px;
          border: 1px solid #e2e7ef;
          border-radius: 8px;
          background: white;
          color: #58657b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .supplier-section-title {
          grid-column: 1 / -1;
          margin: 5px 0 -3px;
          padding-bottom: 8px;
          border-bottom: 1px solid #edf0f5;
          color: #3675f5;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .6px;
          text-transform: uppercase;
        }
        .supplier-contact {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .supplier-contact span {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #718097;
          font-size: 11px;
        }
        .supplier-code {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 6px;
          background: #edf3ff;
          color: #3675f5;
          font-size: 10px;
          font-weight: 800;
        }
        @media(max-width: 1050px) {
          .admin-stats { grid-template-columns: repeat(2, 1fr); }
          .admin-budget-grid { grid-template-columns: repeat(2, 1fr); }
          .admin-main { padding: 22px; }
        }
        @media(max-width: 700px) {
          .admin-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 80;
            transform: translateX(-100%);
            transition: transform .2s ease;
          }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { padding: 18px 13px; }
          .admin-mobile-menu { display: grid; }
          .admin-heading h1 { font-size: 20px; }
          .admin-profile { display: none; }
          .admin-stats { gap: 9px; }
          .admin-stat { padding: 13px; }
          .admin-stat h2 { font-size: 21px; }
          .admin-secondary-stats { grid-template-columns: 1fr; }
          .admin-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .admin-search input { width: 130px; }
          .admin-budget-grid { grid-template-columns: 1fr; }
          .admin-details { grid-template-columns: 1fr; }
          .supplier-form-grid { grid-template-columns: 1fr; }
          .supplier-form-field.full,
          .supplier-section-title { grid-column: auto; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <Building2 size={21} />
          </div>
          ETDOX
        </div>

        <div className="admin-nav-label">ADMINISTRATION</div>

        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={`admin-nav ${
                activeTab === item.name ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(item.name);
                setSearch("");
                setStatusFilter("ALL");
                setSidebarOpen(false);
              }}
            >
              <Icon size={17} />
              {item.name}
            </button>
          );
        })}

        <div className="admin-sidebar-bottom">
          <button className="admin-nav" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="admin-icon-btn admin-mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="admin-heading">
              <h1>
                {activeTab === "Overview"
                  ? "Admin Dashboard"
                  : activeTab}
              </h1>
              <p>
                Manage organization procurement and monitor operations.
              </p>
            </div>
          </div>

          <div className="admin-top-actions">
            <button
              className="admin-icon-btn"
              title="Refresh dashboard"
              onClick={loadDashboard}
            >
              <RefreshCw size={16} />
            </button>

            <button className="admin-icon-btn" title="Notifications">
              <Bell size={17} />
            </button>

            <div className="admin-profile">
              <div className="admin-avatar">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{adminName}</strong>
                <small>{currentRole || "Administrator"}</small>
              </div>
              <ChevronDown size={14} color="#8490a4" />
            </div>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div className="admin-alert error">
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError("")}
              style={{
                marginLeft: "auto",
                border: 0,
                background: "none",
                cursor: "pointer",
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="admin-alert success">
            <CheckCircle2 size={16} />
            {success}
            <button
              onClick={() => setSuccess("")}
              style={{
                marginLeft: "auto",
                border: 0,
                background: "none",
                cursor: "pointer",
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* OVERVIEW STATS */}
        {activeTab === "Overview" && (
          <>
            <section className="admin-stats">
              <div className="admin-stat">
                <div className="admin-stat-top">
                  Total Employees
                  <span className="admin-stat-icon">
                    <Users size={18} />
                  </span>
                </div>
                <h2>{users.length}</h2>
                <small>Users returned by the users API</small>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-top">
                  Total Requests
                  <span className="admin-stat-icon">
                    <ClipboardList size={18} />
                  </span>
                </div>
                <h2>{requests.length}</h2>
                <small>Organization procurement requests</small>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-top">
                  Pending Requests
                  <span className="admin-stat-icon">
                    <Clock size={18} />
                  </span>
                </div>
                <h2>{pendingRequests.length}</h2>
                <small>Requests awaiting a decision</small>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-top">
                  Approved Requests
                  <span className="admin-stat-icon">
                    <CheckCircle2 size={18} />
                  </span>
                </div>
                <h2>{approvedRequests.length}</h2>
                <small>Approved or completed requests</small>
              </div>
            </section>

            <section className="admin-secondary-stats">
              <div className="admin-secondary-card">
                <h3>Total Allocated Budget</h3>
                <strong>{formatCurrency(totalBudget)}</strong>
                <div className="admin-progress">
                  <span
                    style={{
                      width: `${
                        totalBudget > 0
                          ? Math.min(
                              (totalSpent / totalBudget) * 100,
                              100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <small style={{ color: "#929daf", fontSize: 10 }}>
                  {formatCurrency(totalSpent)} used / committed
                </small>
              </div>

              <div className="admin-secondary-card">
                <h3>Rejected Requests</h3>
                <strong>{rejectedRequests.length}</strong>
                <small style={{ color: "#929daf", fontSize: 10 }}>
                  Rejected across manager and finance stages
                </small>
              </div>
            </section>
          </>
        )}

        {/* RECENT REQUESTS */}
        {activeTab === "Overview" && (
          <section
            className="admin-panel"
            style={{ marginBottom: 22 }}
          >
            <div className="admin-panel-head">
              <div>
                <h2>Recent Procurement Requests</h2>
                <p>Latest requests across the organization.</p>
              </div>

              <button
                className="admin-icon-btn"
                title="View all requests"
                onClick={() => setActiveTab("All Requests")}
              >
                <Eye size={16} />
              </button>
            </div>

            {loading ? (
              <div className="admin-loading">
                Loading requests...
              </div>
            ) : requests.length === 0 ? (
              <div className="admin-empty">
                <ClipboardList size={32} />
                <p>No procurement requests found.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Product</th>
                      <th>Department</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requests.slice(0, 6).map((request, index) => {
                      const status = getStatus(request);

                      return (
                        <tr
                          key={
                            request.id ||
                            request.requestId ||
                            index
                          }
                        >
                          <td>
                            <div className="admin-person">
                              <div className="admin-person-avatar">
                                {getEmployee(request)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <strong>
                                  {getEmployee(request)}
                                </strong>
                                <small>
                                  {request.employeeEmail || "Employee"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>{getProduct(request)}</td>

                          <td>
                            {request.department ||
                              request.departmentName ||
                              "—"}
                          </td>

                          <td>
                            {formatCurrency(getAmount(request))}
                          </td>

                          <td>
                            {formatDate(
                              request.createdAt ||
                                request.created_at
                            )}
                          </td>

                          <td>
                            <span
                              className={`admin-status ${statusStyle(status)}`}
                            >
                              {status.replaceAll("_", " ")}
                            </span>
                          </td>

                          <td>
                            <button
                              className="admin-action"
                              onClick={() =>
                                setSelectedRequest(request)
                              }
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ALL REQUESTS */}
        {activeTab === "All Requests" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>All Procurement Requests</h2>
                <p>
                  Monitor requests submitted by employees.
                </p>
              </div>

              <div className="admin-controls">
                <div className="admin-search">
                  <Search size={15} color="#8d98aa" />
                  <input
                    placeholder="Search requests..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="admin-select"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING_MANAGER">
                    Pending Manager
                  </option>
                  <option value="MANAGER_APPROVED">
                    Manager Approved
                  </option>
                  <option value="MANAGER_REJECTED">
                    Manager Rejected
                  </option>
                  <option value="PENDING_FINANCE">
                    Pending Finance
                  </option>
                  <option value="FINANCE_APPROVED">
                    Finance Approved
                  </option>
                  <option value="FINANCE_REJECTED">
                    Finance Rejected
                  </option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">
                Loading requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="admin-empty">
                <ClipboardList size={32} />
                <p>No matching requests found.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Product</th>
                      <th>Supplier</th>
                      <th>Department</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRequests.map((request, index) => {
                      const status = getStatus(request);

                      return (
                        <tr
                          key={
                            request.id ||
                            request.requestId ||
                            index
                          }
                        >
                          <td>
                            <div className="admin-person">
                              <div className="admin-person-avatar">
                                {getEmployee(request)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <strong>
                                  {getEmployee(request)}
                                </strong>
                                <small>
                                  {request.employeeEmail || "Employee"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>{getProduct(request)}</td>

                          <td>
                            {request.supplier ||
                              request.supplierName ||
                              "—"}
                          </td>

                          <td>
                            {request.department ||
                              request.departmentName ||
                              "—"}
                          </td>

                          <td>
                            {formatCurrency(getAmount(request))}
                          </td>

                          <td>
                            <span
                              className={`admin-status ${statusStyle(status)}`}
                            >
                              {status.replaceAll("_", " ")}
                            </span>
                          </td>

                          <td>
                            <button
                              className="admin-action"
                              onClick={() =>
                                setSelectedRequest(request)
                              }
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* EMPLOYEES */}
        {activeTab === "Employees" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>Organization Users</h2>
                <p>View users and their assigned roles.</p>
              </div>

              <div className="admin-search">
                <Search size={15} color="#8d98aa" />
                <input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">
                <Users size={32} />
                <p>No users found.</p>
                <small>
                  Verify that your backend exposes the users endpoint.
                </small>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((user, index) => {
                      const userName =
                        user.name ||
                        user.fullName ||
                        user.full_name ||
                        "Unnamed user";

                      const userRole =
                        normalizeRole(
                          user.role ||
                            user.roleName ||
                            user.role_name ||
                            user.roles?.[0]
                        ) || "—";

                      const isInactive =
                        user.isActive === false ||
                        user.is_active === false ||
                        user.active === false;

                      return (
                        <tr
                          key={user.id || user.userId || index}
                        >
                          <td>
                            <div className="admin-person">
                              <div className="admin-person-avatar">
                                {userName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong>{userName}</strong>
                                <small>
                                  {user.employeeId ||
                                    user.employee_id ||
                                    user.id ||
                                    "—"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>{user.email || "—"}</td>

                          <td>
                            {user.department ||
                              user.departmentName ||
                              "—"}
                          </td>

                          <td>{userRole}</td>

                          <td>
                            <span
                              className={`admin-status ${
                                isInactive
                                  ? "rejected"
                                  : "approved"
                              }`}
                            >
                              {isInactive ? "INACTIVE" : "ACTIVE"}
                            </span>
                          </td>

                          <td>
                            <button
                              className="admin-action"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* BUDGETS */}
        {activeTab === "Budgets" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>Organization Budgets</h2>
                <p>
                  View allocated and used budget information.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">
                Loading budgets...
              </div>
            ) : budgets.length === 0 ? (
              <div className="admin-empty">
                <Wallet size={32} />
                <p>No budgets found.</p>
              </div>
            ) : (
              <div className="admin-budget-grid">
                {budgets.map((budget, index) => {
                  const allocated = Number(
                    budget.allocated ??
                      budget.totalBudget ??
                      budget.total_budget ??
                      budget.amount ??
                      0
                  );

                  const spent = Number(
                    budget.spent ??
                      budget.used ??
                      budget.committed ??
                      0
                  );

                  const percentage =
                    allocated > 0
                      ? Math.min(
                          (spent / allocated) * 100,
                          100
                        )
                      : 0;

                  return (
                    <div
                      className="admin-budget-card"
                      key={budget.id || index}
                    >
                      <h3>
                        {budget.department ||
                          budget.departmentName ||
                          budget.name ||
                          `Budget ${index + 1}`}
                      </h3>

                      <p>
                        {budget.fiscalYear ||
                          budget.fiscal_year ||
                          "Current fiscal year"}
                      </p>

                      <strong>
                        {formatCurrency(allocated)}
                      </strong>

                      <div className="admin-progress">
                        <span
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <p style={{ marginTop: 10, marginBottom: 0 }}>
                        Used: {formatCurrency(spent)} (
                        {percentage.toFixed(0)}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SUPPLIERS */}
        {activeTab === "Suppliers" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>Supplier Management</h2>
                <p>
                  View and manage suppliers registered in your organization.
                </p>
              </div>

              <div className="admin-controls">
                <div className="admin-search">
                  <Search size={15} color="#8d98aa" />
                  <input
                    placeholder="Search suppliers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <button
                  className="supplier-primary-btn"
                  onClick={() => {
                    setError("");
                    setSupplierForm(initialSupplierForm);
                    setShowSupplierModal(true);
                  }}
                  disabled={!canManageSuppliers}
                  title={
                    canManageSuppliers
                      ? "Register a supplier"
                      : "Only Admin and Finance users can register suppliers"
                  }
                >
                  <Plus size={16} />
                  Add Supplier
                </button>
              </div>
            </div>

            {!canManageSuppliers && currentRole && (
              <div
                style={{
                  padding: "12px 20px",
                  color: "#9a6a16",
                  fontSize: 11,
                }}
              >
                You can view suppliers, but only Admin and Finance users
                can register or update them.
              </div>
            )}

            {loading || supplierLoading ? (
              <div className="admin-loading">
                Loading suppliers...
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="admin-empty">
                <Truck size={32} />

                <p>
                  {search
                    ? "No suppliers match your search."
                    : "No suppliers registered yet."}
                </p>

                {canManageSuppliers && !search && (
                  <button
                    className="supplier-primary-btn"
                    onClick={() => {
                      setSupplierForm(initialSupplierForm);
                      setShowSupplierModal(true);
                    }}
                  >
                    <Plus size={15} />
                    Register First Supplier
                  </button>
                )}
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Supplier Code</th>
                      <th>Contact</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSuppliers.map((supplier, index) => {
                      const status = getSupplierStatus(supplier);

                      const contactPerson =
                        supplier.contactPerson ||
                        supplier.contact_person;

                      const taxId =
                        supplier.taxId ||
                        supplier.tax_id ||
                        supplier.tax_identifier;

                      return (
                        <tr
                          key={
                            supplier.id ||
                            supplier.supplierId ||
                            index
                          }
                        >
                          <td>
                            <div className="admin-person">
                              <div className="admin-person-avatar">
                                <Building2 size={15} />
                              </div>

                              <div>
                                <strong>
                                  {getSupplierName(supplier)}
                                </strong>
                                <small>{taxId || "Supplier"}</small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="supplier-code">
                              {getSupplierCode(supplier)}
                            </span>
                          </td>

                          <td>
                            <div className="supplier-contact">
                              {supplier.email && (
                                <span>
                                  <Mail size={12} />
                                  {supplier.email}
                                </span>
                              )}

                              {(supplier.phone || contactPerson) && (
                                <span>
                                  <Phone size={12} />
                                  {supplier.phone || contactPerson}
                                </span>
                              )}

                              {!supplier.email &&
                                !supplier.phone &&
                                !contactPerson &&
                                "—"}
                            </div>
                          </td>

                          <td>{supplier.category || "—"}</td>

                          <td>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <MapPin size={12} />
                              {[
                                supplier.city,
                                supplier.state,
                                supplier.country,
                              ]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`admin-status ${statusStyle(status)}`}
                            >
                              {status.replaceAll("_", " ")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ADD SUPPLIER MODAL */}
      {showSupplierModal && (
        <div
          className="admin-modal-backdrop"
          onClick={() => {
            if (!supplierSaving) {
              setShowSupplierModal(false);
            }
          }}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h2>Register New Supplier</h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#929daf",
                    fontSize: 11,
                  }}
                >
                  Enter the supplier's business and contact information.
                </p>
              </div>

              <button
                className="admin-close"
                onClick={() => setShowSupplierModal(false)}
                disabled={supplierSaving}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={submitSupplier}>
              <div className="supplier-form-grid">
                <div className="supplier-section-title">
                  Basic Information
                </div>

                <div className="supplier-form-field">
                  <label>Supplier Name *</label>
                  <input
                    name="name"
                    value={supplierForm.name}
                    onChange={updateSupplierField}
                    placeholder="Enter legal supplier name"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Supplier Code</label>
                  <input
                    name="code"
                    value={supplierForm.code}
                    onChange={updateSupplierField}
                    placeholder="e.g. SUP-001 (optional)"
                    maxLength={100}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Category</label>
                  <input
                    name="category"
                    value={supplierForm.category}
                    onChange={updateSupplierField}
                    placeholder="e.g. IT Equipment"
                    maxLength={100}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Tax ID / GSTIN</label>
                  <input
                    name="taxId"
                    value={supplierForm.taxId}
                    onChange={updateSupplierField}
                    placeholder="Enter GSTIN or tax ID"
                    maxLength={50}
                  />
                </div>

                <div className="supplier-section-title">
                  Contact Information
                </div>

                <div className="supplier-form-field">
                  <label>Contact Person</label>
                  <input
                    name="contactPerson"
                    value={supplierForm.contactPerson}
                    onChange={updateSupplierField}
                    placeholder="Contact person's name"
                    maxLength={150}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={supplierForm.email}
                    onChange={updateSupplierField}
                    placeholder="supplier@example.com"
                    maxLength={254}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Phone Number</label>
                  <input
                    name="phone"
                    value={supplierForm.phone}
                    onChange={updateSupplierField}
                    placeholder="Enter phone number"
                    maxLength={30}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Payment Terms</label>
                  <input
                    name="paymentTerms"
                    value={supplierForm.paymentTerms}
                    onChange={updateSupplierField}
                    placeholder="e.g. Net 30"
                    maxLength={200}
                  />
                </div>

                <div className="supplier-section-title">
                  Business Address
                </div>

                <div className="supplier-form-field full">
                  <label>Address</label>
                  <input
                    name="address"
                    value={supplierForm.address}
                    onChange={updateSupplierField}
                    placeholder="Street address"
                    maxLength={500}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>City</label>
                  <input
                    name="city"
                    value={supplierForm.city}
                    onChange={updateSupplierField}
                    placeholder="City"
                    maxLength={100}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>State</label>
                  <input
                    name="state"
                    value={supplierForm.state}
                    onChange={updateSupplierField}
                    placeholder="State"
                    maxLength={100}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Country</label>
                  <input
                    name="country"
                    value={supplierForm.country}
                    onChange={updateSupplierField}
                    placeholder="Country"
                    maxLength={100}
                  />
                </div>

                <div className="supplier-form-field">
                  <label>Postal Code</label>
                  <input
                    name="postalCode"
                    value={supplierForm.postalCode}
                    onChange={updateSupplierField}
                    placeholder="Postal code"
                    maxLength={20}
                  />
                </div>

                <div className="supplier-section-title">
                  Registration Settings
                </div>

                <div className="supplier-form-field">
                  <label>Supplier Status</label>
                  <select
                    name="status"
                    value={supplierForm.status}
                    onChange={updateSupplierField}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="supplier-form-field full">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={supplierForm.notes}
                    onChange={updateSupplierField}
                    placeholder="Additional supplier information..."
                    maxLength={2000}
                  />
                </div>
              </div>

              <div className="supplier-modal-actions">
                <button
                  type="button"
                  className="supplier-secondary-btn"
                  onClick={() => setShowSupplierModal(false)}
                  disabled={supplierSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="supplier-primary-btn"
                  disabled={supplierSaving}
                >
                  {supplierSaving ? (
                    <>
                      <RefreshCw size={14} />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Register Supplier
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST DETAILS MODAL */}
      {selectedRequest && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Procurement Request Details</h2>
              <button
                className="admin-close"
                onClick={() => setSelectedRequest(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="admin-details">
              <div className="admin-detail">
                <small>Employee</small>
                <strong>{getEmployee(selectedRequest)}</strong>
              </div>

              <div className="admin-detail">
                <small>Product</small>
                <strong>{getProduct(selectedRequest)}</strong>
              </div>

              <div className="admin-detail">
                <small>Supplier</small>
                <strong>
                  {selectedRequest.supplier ||
                    selectedRequest.supplierName ||
                    "—"}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Department</small>
                <strong>
                  {selectedRequest.department ||
                    selectedRequest.departmentName ||
                    "—"}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Quantity</small>
                <strong>
                  {selectedRequest.quantity ?? "—"}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Total Amount</small>
                <strong>
                  {formatCurrency(getAmount(selectedRequest))}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Status</small>
                <strong>
                  {getStatus(selectedRequest).replaceAll("_", " ")}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Submitted Date</small>
                <strong>
                  {formatDate(
                    selectedRequest.createdAt ||
                      selectedRequest.created_at
                  )}
                </strong>
              </div>
            </div>

            <div
              className="admin-detail"
              style={{ marginTop: 12 }}
            >
              <small>Justification</small>
              <strong>
                {selectedRequest.justification ||
                  selectedRequest.description ||
                  selectedRequest.reason ||
                  "No description provided."}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* USER DETAILS MODAL */}
      {selectedUser && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>User Details</h2>
              <button
                className="admin-close"
                onClick={() => setSelectedUser(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="admin-details">
              <div className="admin-detail">
                <small>Name</small>
                <strong>
                  {selectedUser.name ||
                    selectedUser.fullName ||
                    selectedUser.full_name ||
                    "—"}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Email</small>
                <strong>{selectedUser.email || "—"}</strong>
              </div>

              <div className="admin-detail">
                <small>Role</small>
                <strong>
                  {normalizeRole(
                    selectedUser.role ||
                      selectedUser.roleName ||
                      selectedUser.role_name ||
                      selectedUser.roles?.[0]
                  ) || "—"}
                </strong>
              </div>

              <div className="admin-detail">
                <small>Department</small>
                <strong>
                  {selectedUser.department || "—"}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
