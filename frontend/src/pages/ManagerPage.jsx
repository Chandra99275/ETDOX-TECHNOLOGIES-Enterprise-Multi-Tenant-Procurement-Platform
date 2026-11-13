import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  Eye,
  Check,
  Ban,
  RefreshCw,
  Building2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

const getToken = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("accessToken") ||
  sessionStorage.getItem("authToken") ||
  sessionStorage.getItem("token") ||
  "";

const createRequestId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `manager-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
};

const getArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) {
      return response.data[key];
    }
  }

  if (Array.isArray(response?.data)) return response.data;

  if (Array.isArray(response?.data?.requests)) {
    return response.data.requests;
  }

  return [];
};

// ============================================================
// FORMATTERS
// ============================================================

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
};

// ============================================================
// REQUEST HELPERS
// ============================================================

const getStatus = (request) =>
  String(
    request.status ||
      request.requestStatus ||
      request.request_status ||
      "PENDING_MANAGER"
  )
    .toUpperCase()
    .replaceAll(" ", "_");

const getEmployee = (request) => {
  const employee =
    request.employee ||
    request.requester ||
    request.user ||
    {};

  const nestedName = [
    employee.firstName || employee.first_name,
    employee.lastName || employee.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    request.employeeName ||
    request.employee_name ||
    employee.name ||
    employee.fullName ||
    employee.full_name ||
    nestedName ||
    request.createdByName ||
    request.created_by_name ||
    "Employee"
  );
};

const getProduct = (request) =>
  request.productName ||
  request.product_name ||
  request.title ||
  request.itemName ||
  request.item_name ||
  "Product request";

const getAmount = (request) => {
  const amount =
    request.totalAmount ??
    request.total_amount ??
    request.amount ??
    Number(request.quantity || 0) *
      Number(request.unitPrice || request.unit_price || 0);

  return Number(amount || 0);
};

const getRequestId = (request) =>
  request.id ||
  request.requestId ||
  request.request_id;

const getSupplier = (request) =>
  request.supplierName ||
  request.supplier_name ||
  request.supplier ||
  "—";

const getDepartment = (request) => {
  const department = request.department;

  if (department && typeof department === "object") {
    return department.name || "—";
  }

  return (
    department ||
    request.departmentName ||
    request.department_name ||
    "—"
  );
};

const getRequestDate = (request) =>
  request.createdAt ||
  request.created_at ||
  request.submittedAt ||
  request.submitted_at;

// ============================================================
// STATUS CONSTANTS
// ============================================================

const FINANCE_PENDING_STATUSES = [
  "MANAGER_APPROVED",
  "PENDING_FINANCE",
];

const APPROVED_STATUSES = [
  "MANAGER_APPROVED",
  "FINANCE_APPROVED",
  "APPROVED",
  "COMPLETED",
];

const REJECTED_STATUSES = [
  "MANAGER_REJECTED",
  "FINANCE_REJECTED",
  "REJECTED",
];

// ============================================================
// MANAGER PAGE
// ============================================================

export default function ManagerPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);

  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [managerName, setManagerName] = useState("Manager");

  // ==========================================================
  // API REQUEST HELPER WITH DIAGNOSTICS
  // ==========================================================

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const token = getToken();
    const method = (options.method || "GET").toUpperCase();
    const requestId = createRequestId();
    const url = `${API_BASE}${endpoint}`;

    if (!token) {
      const authError = new Error(
        "Your session has expired. Please log in again."
      );

      authError.status = 401;
      authError.endpoint = endpoint;
      authError.requestId = requestId;

      throw authError;
    }

    const requestBody = options.body || null;

    console.groupCollapsed(
      `[ETDOX MANAGER API] ${method} ${endpoint}`
    );

    console.log("Request ID:", requestId);
    console.log("URL:", url);
    console.log("Method:", method);

    if (requestBody) {
      try {
        console.log("Request body:", JSON.parse(requestBody));
      } catch {
        console.log("Request body:", requestBody);
      }
    }

    let response;

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Request-ID": requestId,
          ...options.headers,
        },
      });
    } catch (networkError) {
      console.error("Network error:", networkError);
      console.groupEnd();

      const error = new Error(
        `Cannot connect to ETDOX backend. Check whether the backend is running. ${networkError.message}`
      );

      error.endpoint = endpoint;
      error.method = method;
      error.requestId = requestId;
      error.cause = networkError;

      throw error;
    }

    const responseText = await response.text();

    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {
        rawResponse: responseText,
      };
    }

    const serverRequestId =
      response.headers.get("x-request-id") ||
      data.requestId ||
      data.request_id ||
      null;

    console.log("HTTP status:", response.status);
    console.log("Response OK:", response.ok);
    console.log("Client request ID:", requestId);
    console.log("Server request ID:", serverRequestId);
    console.log("Response body:", data);

    if (!response.ok) {
      console.error("API REQUEST FAILED", {
        method,
        endpoint,
        status: response.status,
        requestId,
        serverRequestId,
        response: data,
      });

      console.groupEnd();

      const error = new Error(
        data.message ||
          data.error ||
          data.details ||
          data.rawResponse ||
          `Request failed with status ${response.status}`
      );

      error.status = response.status;
      error.method = method;
      error.endpoint = endpoint;
      error.requestId = requestId;
      error.serverRequestId = serverRequestId;
      error.response = data;

      if (response.status === 401) {
        error.message = "Session expired. Please log in again.";
      }

      throw error;
    }

    console.log("API REQUEST SUCCESS");
    console.groupEnd();

    return data;
  }, []);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");

    navigate("/login");
  }, [navigate]);

  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    console.groupCollapsed("[ETDOX MANAGER] Dashboard loading");

    try {
      // Execute independently so one failed endpoint
      // does not prevent the other endpoints from loading.
      const results = await Promise.allSettled([
        apiRequest("/procurement/requests"),

        apiRequest(
          "/workflows/tasks/pending?limit=100&offset=0"
        ),

        apiRequest("/auth/me"),
      ]);

      const [requestResult, taskResult, userResult] = results;

      // ------------------------------------------------------
      // PROCUREMENT REQUESTS
      // ------------------------------------------------------

      if (requestResult.status === "fulfilled") {
        const requestList = getArray(
          requestResult.value,
          ["requests", "items", "results"]
        );

        console.log(
          "Procurement requests loaded:",
          requestList.length
        );

        console.table(
          requestList.map((request) => ({
            id: getRequestId(request),
            requestNumber: request.request_number,
            status: getStatus(request),
          }))
        );

        setRequests(requestList);
      } else {
        console.error(
          "Procurement endpoint failed:",
          requestResult.reason
        );

        setRequests([]);

        setError(
          `Unable to load procurement requests: ${requestResult.reason?.message || "Unknown error"}`
        );
      }

      // ------------------------------------------------------
      // PENDING WORKFLOW TASKS
      // ------------------------------------------------------

      if (taskResult.status === "fulfilled") {
        const taskResponse = taskResult.value;

        const taskList = getArray(taskResponse, [
          "tasks",
          "items",
          "results",
        ]);

        console.log(
          "Raw workflow task response:",
          taskResponse
        );

        console.log(
          "Workflow tasks received:",
          taskList.length
        );

        console.table(
          taskList.map((task) => ({
            taskId: task.id,
            assigneeId: task.assignee_id,
            resourceType:
              task.resource_type || task.resourceType,
            resourceId:
              task.resource_id || task.resourceId,
            status: task.status,
            nodeId: task.node_id,
          }))
        );

        const validTasks = taskList.filter((task) => {
          const status = String(
            task.status || ""
          ).toUpperCase();

          const resourceType = String(
            task.resource_type ||
              task.resourceType ||
              ""
          ).toLowerCase();

          const resourceId =
            task.resource_id || task.resourceId;

          return (
            status === "PENDING" &&
            resourceType === "purchase_request" &&
            Boolean(task.id) &&
            Boolean(resourceId)
          );
        });

        console.log(
          "Valid manager approval tasks:",
          validTasks.length
        );

        setPendingTasks(validTasks);

        if (validTasks.length === 0 && taskList.length > 0) {
          console.warn(
            "Tasks were returned, but none matched the manager's pending purchase-request filters."
          );
        }
      } else {
        console.error(
          "Workflow pending-task endpoint failed:",
          taskResult.reason
        );

        setPendingTasks([]);

        setError((previous) => {
          const taskMessage =
            `Unable to load approval tasks: ${taskResult.reason?.message || "Unknown error"}`;

          return previous
            ? `${previous} | ${taskMessage}`
            : taskMessage;
        });
      }

      // ------------------------------------------------------
      // MANAGER PROFILE
      // ------------------------------------------------------

      if (userResult.status === "fulfilled") {
        const userResponse = userResult.value;

        const user =
          userResponse?.user ||
          userResponse?.data?.user ||
          userResponse?.data ||
          userResponse;

        console.log("Manager profile:", user);

        if (user && typeof user === "object") {
          const fullName =
            user.name ||
            user.fullName ||
            user.full_name ||
            [
              user.firstName || user.first_name,
              user.lastName || user.last_name,
            ]
              .filter(Boolean)
              .join(" ");

          if (fullName) {
            setManagerName(fullName);
          }
        }
      } else {
        console.warn(
          "Unable to load manager profile:",
          userResult.reason
        );
      }
    } catch (err) {
      console.error(
        "[ETDOX MANAGER] Dashboard loading error:",
        err
      );

      setError(
        err.message || "Unable to load manager dashboard."
      );

      if (
        err.status === 401 ||
        err.message.toLowerCase().includes("session expired") ||
        err.message.toLowerCase().includes("log in again")
      ) {
        logout();
      }
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }, [apiRequest, logout]);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }

    loadDashboard();
  }, [loadDashboard, navigate]);

  // ==========================================================
  // MATCH WORKFLOW TASKS WITH PROCUREMENT REQUESTS
  // ==========================================================

  const managerPending = useMemo(() => {
    const requestMap = new Map(
      requests
        .filter((request) => getRequestId(request))
        .map((request) => [
          String(getRequestId(request)),
          request,
        ])
    );

    return pendingTasks.map((task) => {
      const requestId = String(
        task.resource_id || task.resourceId
      );

      const existingRequest = requestMap.get(requestId);

      if (existingRequest) {
        return {
          ...existingRequest,
          workflowTaskId: task.id,
          workflowTask: task,
        };
      }

      return {
        id: requestId,
        request_number: task.request_number,
        total_amount: task.total_amount,
        currency: task.currency,
        requester_id: task.requester_id,
        status: "IN_APPROVAL",
        workflowTaskId: task.id,
        workflowTask: task,
      };
    });
  }, [requests, pendingTasks]);

  // ==========================================================
  // ATTACH TASK INFORMATION TO REQUEST LIST
  // ==========================================================

  const requestsWithTasks = useMemo(() => {
    const taskByRequestId = new Map();

    for (const task of pendingTasks) {
      const resourceId =
        task.resource_id || task.resourceId;

      const key = String(resourceId);

      if (!taskByRequestId.has(key)) {
        taskByRequestId.set(key, task);
      }
    }

    const enrichedRequests = requests.map((request) => {
      const requestId = getRequestId(request);

      const task = taskByRequestId.get(
        String(requestId)
      );

      if (!task) return request;

      return {
        ...request,
        workflowTaskId: task.id,
        workflowTask: task,
      };
    });

    const existingIds = new Set(
      enrichedRequests.map((request) =>
        String(getRequestId(request))
      )
    );

    const missingRequests = managerPending.filter(
      (request) =>
        !existingIds.has(
          String(getRequestId(request))
        )
    );

    return [
      ...enrichedRequests,
      ...missingRequests,
    ];
  }, [requests, pendingTasks, managerPending]);

  // ==========================================================
  // DASHBOARD STATISTICS
  // ==========================================================

  const financePending = useMemo(
    () =>
      requests.filter((request) =>
        FINANCE_PENDING_STATUSES.includes(
          getStatus(request)
        )
      ),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter((request) =>
        APPROVED_STATUSES.includes(
          getStatus(request)
        )
      ),
    [requests]
  );

  const rejectedRequests = useMemo(
    () =>
      requests.filter((request) =>
        REJECTED_STATUSES.includes(
          getStatus(request)
        )
      ),
    [requests]
  );

  // ==========================================================
  // SEARCH AND FILTERS
  // ==========================================================

  const filteredRequests = useMemo(() => {
    let list = requestsWithTasks;

    if (activeTab === "Pending Requests") {
      list = managerPending;
    } else if (activeTab === "Approval History") {
      list = requestsWithTasks.filter((request) =>
        [
          ...APPROVED_STATUSES,
          ...REJECTED_STATUSES,
        ].includes(getStatus(request))
      );
    }

    if (statusFilter !== "ALL") {
      list = list.filter(
        (request) =>
          getStatus(request) === statusFilter
      );
    }

    const query = search.toLowerCase().trim();

    if (query) {
      list = list.filter((request) => {
        const searchableText = [
          getEmployee(request),
          getProduct(request),
          getSupplier(request),
          getDepartment(request),
          getRequestId(request),
          request.request_number,
          request.employeeEmail,
          request.employee_email,
          request.requester?.email,
          request.description,
          request.justification,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    return list;
  }, [
    requestsWithTasks,
    activeTab,
    statusFilter,
    search,
    managerPending,
  ]);

  // ==========================================================
  // OPEN DECISION MODAL
  // ==========================================================

  const openDecision = (request, action) => {
    if (!request.workflowTaskId) {
      setError(
        "No pending workflow task is assigned to this request."
      );
      return;
    }

    setSelectedRequest(request);
    setDecision(action);
    setReason("");
    setError("");
    setSuccess("");
  };

  // ==========================================================
  // SUBMIT WORKFLOW DECISION WITH ERROR TRACKING
  // ==========================================================

  const submitDecision = async () => {
    if (!selectedRequest || !decision || submitting) {
      return;
    }

    if (
      decision === "reject" &&
      !reason.trim()
    ) {
      setError("Please enter a rejection reason.");
      return;
    }

    const taskId = selectedRequest.workflowTaskId;
    const resourceId = getRequestId(selectedRequest);

    if (!taskId) {
      setError(
        "Workflow task ID is missing. Refresh the dashboard and try again."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const action =
      decision === "approve" ? "approve" : "reject";

    const endpoint =
      `/workflows/tasks/${encodeURIComponent(taskId)}/actions`;

    console.group("[ETDOX MANAGER APPROVAL ACTION]");

    console.log("Workflow task ID:", taskId);
    console.log("Purchase request ID:", resourceId);
    console.log("Action:", action);
    console.log("Endpoint:", endpoint);
    console.log("Comment:", reason.trim());

    try {
      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action,
          comment: reason.trim(),
        }),
      });

      console.log("Approval action response:", result);

      setSelectedRequest(null);
      setDecision("");
      setReason("");

      setSuccess(
        action === "approve"
          ? "Request approved successfully. The workflow has advanced."
          : "Request rejected successfully."
      );

      await loadDashboard();
    } catch (err) {
      console.error("Approval action failed:", {
        taskId,
        resourceId,
        action,
        endpoint: err.endpoint || endpoint,
        status: err.status,
        clientRequestId: err.requestId,
        serverRequestId: err.serverRequestId,
        response: err.response,
        message: err.message,
      });

      setError(
        `${err.message || "Unable to submit manager decision."}${
          err.status ? ` (HTTP ${err.status})` : ""
        }${err.serverRequestId ? ` | Server Request ID: ${err.serverRequestId}` : ""}`
      );
    } finally {
      setSubmitting(false);
      console.groupEnd();
    }
  };

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  const closeModal = () => {
    if (submitting) return;

    setSelectedRequest(null);
    setDecision("");
    setReason("");
  };

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Pending Requests", icon: ClipboardList },
    { name: "Approval History", icon: CheckCircle2 },
  ];

  // ==========================================================
  // STATUS HELPERS
  // ==========================================================

  const statusStyle = (status) => {
    if (APPROVED_STATUSES.includes(status)) {
      return "approved";
    }

    if (REJECTED_STATUSES.includes(status)) {
      return "rejected";
    }

    if (FINANCE_PENDING_STATUSES.includes(status)) {
      return "finance";
    }

    return "pending";
  };

  const isManagerPending = (request) =>
    Boolean(request.workflowTaskId);

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="manager-app">
      <style>{`
        * { box-sizing: border-box; }

        .manager-app {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }

        .manager-sidebar {
          width: 250px;
          background: #111c35;
          color: white;
          padding: 25px 16px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .manager-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px 30px;
          font-size: 21px;
          font-weight: 800;
        }

        .manager-brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #3675f5;
        }

        .manager-nav-label {
          color: #8492ae;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          padding: 10px 12px;
        }

        .manager-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          border: 0;
          border-radius: 9px;
          padding: 13px 12px;
          margin: 3px 0;
          background: transparent;
          color: #aebbd2;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }

        .manager-nav.active,
        .manager-nav:hover {
          background: #263b65;
          color: white;
        }

        .manager-sidebar-bottom {
          margin-top: auto;
          border-top: 1px solid #2b3955;
          padding-top: 16px;
        }

        .manager-main {
          min-width: 0;
          flex: 1;
          padding: 28px 34px;
        }

        .manager-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 28px;
        }

        .manager-heading h1 {
          margin: 0 0 7px;
          font-size: 25px;
          color: #172033;
        }

        .manager-heading p {
          margin: 0;
          color: #8490a4;
          font-size: 13px;
        }

        .manager-top-actions {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .manager-icon-btn {
          border: 1px solid #e5e9f1;
          background: white;
          border-radius: 10px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #59677e;
        }

        .manager-icon-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .manager-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #e7ebf2;
          padding: 7px 12px;
          border-radius: 11px;
        }

        .manager-avatar {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: white;
          background: #3675f5;
          font-weight: 700;
        }

        .manager-profile strong {
          display: block;
          font-size: 12px;
        }

        .manager-profile small {
          color: #8a96a8;
          font-size: 10px;
        }

        .manager-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 25px;
        }

        .manager-stat {
          background: white;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          padding: 19px;
        }

        .manager-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #7d899c;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
        }

        .manager-stat-icon {
          width: 37px;
          height: 37px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #edf3ff;
          color: #3675f5;
          flex-shrink: 0;
        }

        .manager-stat h2 {
          margin: 13px 0 5px;
          font-size: 25px;
        }

        .manager-stat small {
          color: #929daf;
          font-size: 11px;
        }

        .manager-panel {
          background: white;
          border: 1px solid #e9edf4;
          border-radius: 13px;
          overflow: hidden;
        }

        .manager-panel-head {
          padding: 19px 21px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom: 1px solid #edf0f5;
        }

        .manager-panel-head h2 {
          margin: 0 0 5px;
          font-size: 16px;
        }

        .manager-panel-head p {
          margin: 0;
          color: #929daf;
          font-size: 11px;
        }

        .manager-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .manager-search {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          padding: 0 10px;
          background: white;
        }

        .manager-search input {
          width: 180px;
          border: 0;
          outline: 0;
          padding: 10px 0;
          font-size: 12px;
        }

        .manager-select {
          border: 1px solid #e3e8f0;
          border-radius: 8px;
          padding: 9px 11px;
          background: white;
          color: #526078;
          font-size: 12px;
          outline: 0;
        }

        .manager-table-wrap {
          overflow-x: auto;
        }

        .manager-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        .manager-table th {
          padding: 13px 16px;
          text-align: left;
          color: #8b96a8;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .6px;
          background: #fafbfd;
          border-bottom: 1px solid #edf0f5;
        }

        .manager-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #f0f2f6;
          font-size: 12px;
          color: #536078;
        }

        .manager-table tr:last-child td {
          border-bottom: 0;
        }

        .manager-person {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .manager-person-avatar {
          width: 31px;
          height: 31px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: #edf3ff;
          color: #3675f5;
          font-weight: 700;
          flex-shrink: 0;
        }

        .manager-person strong,
        .manager-product strong {
          display: block;
          color: #27344a;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .manager-person small,
        .manager-product small {
          display: block;
          color: #9aa4b4;
          font-size: 10px;
        }

        .manager-status {
          display: inline-block;
          border-radius: 20px;
          padding: 6px 9px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .manager-status.pending {
          background: #fff5df;
          color: #b77a13;
        }

        .manager-status.approved {
          background: #e6f8ef;
          color: #16844e;
        }

        .manager-status.rejected {
          background: #ffe9e9;
          color: #cf4444;
        }

        .manager-status.finance {
          background: #e9efff;
          color: #456bd3;
        }

        .manager-actions {
          display: flex;
          gap: 6px;
        }

        .manager-action {
          border: 1px solid #e5e9f1;
          background: white;
          color: #64728a;
          border-radius: 7px;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .manager-action.approve {
          color: #16844e;
        }

        .manager-action.reject {
          color: #cf4444;
        }

        .manager-action:hover {
          background: #f5f7fb;
        }

        .manager-action:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .manager-empty,
        .manager-loading {
          padding: 55px 20px;
          text-align: center;
          color: #8995a8;
          font-size: 13px;
        }

        .manager-empty svg {
          margin-bottom: 10px;
        }

        .manager-alert {
          padding: 12px 15px;
          border-radius: 9px;
          margin-bottom: 17px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .manager-alert.error {
          color: #b52c35;
          background: #fff0f0;
        }

        .manager-alert.success {
          color: #13764a;
          background: #e9f8f0;
        }

        .manager-btn {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .manager-btn.primary {
          background: #3675f5;
          color: white;
        }

        .manager-btn.green {
          background: #16844e;
          color: white;
        }

        .manager-btn.red {
          background: #d94a4a;
          color: white;
        }

        .manager-btn.light {
          background: #f0f3f8;
          color: #59677e;
        }

        .manager-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .manager-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(13, 24, 44, .55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 100;
        }

        .manager-modal {
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 15px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,.2);
        }

        .manager-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .manager-modal-head h2 {
          margin: 0;
          font-size: 18px;
        }

        .manager-close {
          border: 0;
          background: #f1f3f7;
          width: 31px;
          height: 31px;
          border-radius: 8px;
          cursor: pointer;
        }

        .manager-close:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .manager-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        .manager-detail {
          padding: 12px;
          border: 1px solid #edf0f5;
          border-radius: 9px;
          min-width: 0;
        }

        .manager-detail small {
          display: block;
          color: #929daf;
          font-size: 10px;
          margin-bottom: 6px;
        }

        .manager-detail strong {
          font-size: 12px;
          color: #27344a;
          overflow-wrap: anywhere;
        }

        .manager-reason {
          width: 100%;
          min-height: 90px;
          resize: vertical;
          border: 1px solid #e1e6ef;
          border-radius: 9px;
          padding: 12px;
          font: inherit;
          font-size: 12px;
          outline: 0;
        }

        .manager-reason:focus {
          border-color: #3675f5;
        }

        .manager-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 18px;
          flex-wrap: wrap;
        }

        .manager-mobile-menu {
          display: none;
        }

        @media(max-width: 1050px) {
          .manager-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .manager-main {
            padding: 22px;
          }
        }

        @media(max-width: 700px) {
          .manager-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 80;
            transform: translateX(-100%);
            transition: transform .2s ease;
          }

          .manager-sidebar.open {
            transform: translateX(0);
          }

          .manager-main {
            padding: 18px 13px;
          }

          .manager-mobile-menu {
            display: grid;
          }

          .manager-heading h1 {
            font-size: 20px;
          }

          .manager-profile {
            display: none;
          }

          .manager-stats {
            gap: 9px;
          }

          .manager-stat {
            padding: 13px;
          }

          .manager-stat h2 {
            font-size: 21px;
          }

          .manager-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .manager-search input {
            width: 130px;
          }

          .manager-details {
            grid-template-columns: 1fr;
          }

          .manager-topbar {
            align-items: flex-start;
          }

          .manager-top-actions {
            gap: 7px;
          }
        }
      `}</style>

      {/* SIDEBAR */}

      <aside
        className={`manager-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="manager-brand">
          <div className="manager-brand-icon">
            <Building2 size={21} />
          </div>
          ETDOX
        </div>

        <div className="manager-nav-label">
          WORKSPACE
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={`manager-nav ${
                activeTab === item.name ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(item.name);
                setStatusFilter("ALL");
                setSidebarOpen(false);
              }}
            >
              <Icon size={17} />

              {item.name}

              {item.name === "Pending Requests" &&
                managerPending.length > 0 && (
                  <span style={{ marginLeft: "auto" }}>
                    {managerPending.length}
                  </span>
                )}
            </button>
          );
        })}

        <div className="manager-sidebar-bottom">
          <button
            className="manager-nav"
            onClick={logout}
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN DASHBOARD */}

      <main className="manager-main">
        <header className="manager-topbar">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              className="manager-icon-btn manager-mobile-menu"
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? (
                <X size={18} />
              ) : (
                <Menu size={18} />
              )}
            </button>

            <div className="manager-heading">
              <h1>
                {activeTab === "Overview"
                  ? "Manager Dashboard"
                  : activeTab}
              </h1>

              <p>
                Review employee procurement requests and make decisions.
              </p>
            </div>
          </div>

          <div className="manager-top-actions">
            <button
              className="manager-icon-btn"
              title="Refresh"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCw size={16} />
            </button>

            <button
              className="manager-icon-btn"
              title="Notifications"
              type="button"
            >
              <Bell size={17} />
            </button>

            <div className="manager-profile">
              <div className="manager-avatar">
                {managerName.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{managerName}</strong>
                <small>Manager</small>
              </div>

              <ChevronDown
                size={14}
                color="#8490a4"
              />
            </div>
          </div>
        </header>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="manager-alert error">
            <AlertCircle size={16} />

            <span>{error}</span>

            <button
              onClick={() => setError("")}
              style={{
                marginLeft: "auto",
                border: 0,
                background: "none",
                cursor: "pointer",
              }}
              aria-label="Close error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {success && (
          <div className="manager-alert success">
            <CheckCircle2 size={16} />

            <span>{success}</span>

            <button
              onClick={() => setSuccess("")}
              style={{
                marginLeft: "auto",
                border: 0,
                background: "none",
                cursor: "pointer",
              }}
              aria-label="Close success message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* OVERVIEW STATISTICS */}

        {activeTab === "Overview" && (
          <section className="manager-stats">
            <div className="manager-stat">
              <div className="manager-stat-top">
                Pending My Approval

                <span className="manager-stat-icon">
                  <Clock size={18} />
                </span>
              </div>

              <h2>{managerPending.length}</h2>

              <small>
                Requests awaiting manager review
              </small>
            </div>

            <div className="manager-stat">
              <div className="manager-stat-top">
                Forwarded to Finance

                <span className="manager-stat-icon">
                  <CheckCircle2 size={18} />
                </span>
              </div>

              <h2>{financePending.length}</h2>

              <small>Approved by manager</small>
            </div>

            <div className="manager-stat">
              <div className="manager-stat-top">
                Approved Requests

                <span className="manager-stat-icon">
                  <ClipboardList size={18} />
                </span>
              </div>

              <h2>{approvedRequests.length}</h2>

              <small>
                Manager-approved or completed
              </small>
            </div>

            <div className="manager-stat">
              <div className="manager-stat-top">
                Rejected Requests

                <span className="manager-stat-icon">
                  <XCircle size={18} />
                </span>
              </div>

              <h2>{rejectedRequests.length}</h2>

              <small>Requests rejected</small>
            </div>
          </section>
        )}

        {/* PROCUREMENT REQUEST TABLE */}

        <section className="manager-panel">
          <div className="manager-panel-head">
            <div>
              <h2>
                {activeTab === "Overview"
                  ? "Employee Procurement Requests"
                  : activeTab}
              </h2>

              <p>
                {activeTab === "Pending Requests"
                  ? "Review requests that require your approval."
                  : activeTab === "Approval History"
                    ? "Previously reviewed procurement requests."
                    : "Requests submitted by employees in your organization."}
              </p>
            </div>

            <div className="manager-controls">
              <div className="manager-search">
                <Search
                  size={15}
                  color="#8d98aa"
                />

                <input
                  placeholder="Search requests..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                className="manager-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING_MANAGER">
                  Pending Manager
                </option>
                <option value="SUBMITTED">
                  Submitted
                </option>
                <option value="MANAGER_PENDING">
                  Manager Pending
                </option>
                <option value="IN_APPROVAL">
                  In Approval
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
                <option value="COMPLETED">
                  Completed
                </option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="manager-loading">
              <RefreshCw size={22} />
              <p>Loading procurement requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="manager-empty">
              <ClipboardList size={35} />

              <p>No procurement requests found.</p>

              <small>
                Employee requests will appear here when they are successfully
                submitted.
              </small>
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Product</th>
                    <th>Supplier</th>
                    <th>Department</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request, index) => {
                    const status = getStatus(request);
                    const isPending =
                      isManagerPending(request);

                    return (
                      <tr
                        key={
                          getRequestId(request) || index
                        }
                      >
                        <td>
                          <div className="manager-person">
                            <div className="manager-person-avatar">
                              {getEmployee(request)
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {getEmployee(request)}
                              </strong>

                              <small>
                                {request.employeeId ||
                                  request.employee_id ||
                                  request.employee?.employeeId ||
                                  request.requester?.email ||
                                  request.employeeEmail ||
                                  request.employee_email ||
                                  request.request_number ||
                                  "Employee"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="manager-product">
                            <strong>
                              {getProduct(request)}
                            </strong>

                            <small>
                              Qty: {request.quantity ?? "—"}
                            </small>
                          </div>
                        </td>

                        <td>{getSupplier(request)}</td>

                        <td>{getDepartment(request)}</td>

                        <td>
                          <strong style={{ color: "#27344a" }}>
                            {formatCurrency(
                              getAmount(request)
                            )}
                          </strong>
                        </td>

                        <td>
                          {formatDate(
                            getRequestDate(request)
                          )}
                        </td>

                        <td>
                          <span
                            className={`manager-status ${statusStyle(
                              status
                            )}`}
                          >
                            {status.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td>
                          <div className="manager-actions">
                            <button
                              className="manager-action"
                              title="View details"
                              onClick={() => {
                                setSelectedRequest(request);
                                setDecision("");
                                setReason("");
                                setError("");
                              }}
                            >
                              <Eye size={15} />
                            </button>

                            {isPending && (
                              <>
                                <button
                                  className="manager-action approve"
                                  title="Approve request"
                                  onClick={() =>
                                    openDecision(
                                      request,
                                      "approve"
                                    )
                                  }
                                >
                                  <Check size={15} />
                                </button>

                                <button
                                  className="manager-action reject"
                                  title="Reject request"
                                  onClick={() =>
                                    openDecision(
                                      request,
                                      "reject"
                                    )
                                  }
                                >
                                  <Ban size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* REQUEST DETAILS AND DECISION MODAL */}

      {selectedRequest && (
        <div
          className="manager-modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="manager-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="manager-modal-head">
              <h2>
                {decision
                  ? decision === "approve"
                    ? "Approve Request"
                    : "Reject Request"
                  : "Request Details"}
              </h2>

              <button
                className="manager-close"
                disabled={submitting}
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={17} />
              </button>
            </div>

            <div className="manager-details">
              <div className="manager-detail">
                <small>Employee</small>
                <strong>
                  {getEmployee(selectedRequest)}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Product</small>
                <strong>
                  {getProduct(selectedRequest)}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Supplier</small>
                <strong>
                  {getSupplier(selectedRequest)}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Department</small>
                <strong>
                  {getDepartment(selectedRequest)}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Quantity</small>
                <strong>
                  {selectedRequest.quantity ?? "—"}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Unit Price</small>
                <strong>
                  {formatCurrency(
                    selectedRequest.unitPrice ??
                      selectedRequest.unit_price
                  )}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Total Amount</small>
                <strong>
                  {formatCurrency(
                    getAmount(selectedRequest)
                  )}
                </strong>
              </div>

              <div className="manager-detail">
                <small>Submitted Date</small>
                <strong>
                  {formatDate(
                    getRequestDate(selectedRequest)
                  )}
                </strong>
              </div>
            </div>

            <div
              className="manager-detail"
              style={{ marginTop: 13 }}
            >
              <small>
                Justification / Description
              </small>

              <strong>
                {selectedRequest.justification ||
                  selectedRequest.description ||
                  selectedRequest.reason ||
                  "No description provided."}
              </strong>
            </div>

            {decision && (
              <div style={{ marginTop: 17 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {decision === "reject"
                    ? "Rejection reason (required)"
                    : "Approval note (optional)"}
                </label>

                <textarea
                  className="manager-reason"
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  placeholder={
                    decision === "reject"
                      ? "Enter why this request is being rejected..."
                      : "Add an optional note for Finance..."
                  }
                  disabled={submitting}
                  maxLength={4000}
                />
              </div>
            )}

            <div className="manager-modal-actions">
              <button
                className="manager-btn light"
                disabled={submitting}
                onClick={closeModal}
              >
                Close
              </button>

              {decision && (
                <button
                  className={`manager-btn ${
                    decision === "approve"
                      ? "green"
                      : "red"
                  }`}
                  disabled={
                    submitting ||
                    (decision === "reject" &&
                      !reason.trim())
                  }
                  onClick={submitDecision}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} />
                      Processing...
                    </>
                  ) : decision === "approve" ? (
                    <>
                      <Check size={14} />
                      Approve & Forward to Finance
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      Reject Request
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}