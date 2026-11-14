
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  Clock3,
  IndianRupee,
  RefreshCw,
  Search,
  AlertCircle,
  TrendingUp,
  Package,
  ArrowUpRight,
} from "lucide-react";

import "./ProcurementPage.css";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");

const getToken = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("accessToken") ||
  sessionStorage.getItem("authToken") ||
  sessionStorage.getItem("token");

const getStatus = (request) =>
  String(request.status || "UNKNOWN").toUpperCase();

const getAmount = (request) =>
  Number(request.totalAmount ?? request.amount ?? 0);

const getDate = (request) =>
  request.createdAt ||
  request.created_at ||
  request.submittedAt ||
  request.submitted_at ||
  null;

const getTitle = (request) =>
  request.title || request.requestNumber || "Purchase Request";

const getRequestNumber = (request) =>
  request.requestNumber || request.id?.slice(0, 8) || "—";

const formatCurrency = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
};

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusClass = (status) => {
  if (["APPROVED", "FINANCE_APPROVED", "COMPLETED"].includes(status)) {
    return "approved";
  }

  if (["REJECTED", "FINANCE_REJECTED"].includes(status)) {
    return "rejected";
  }

  if (["DRAFT"].includes(status)) {
    return "draft";
  }

  return "pending";
};

export default function ProcurementPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const [formData, setFormData] = useState({
  title: "",
  description: "",
  amount: "",
  currency: "INR",
  justification: "",
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Session not found. Please log in again.");
      }

      const fetchPage = async (page) => {
        const response = await fetch(
          `${API_BASE}/procurement/requests?page=${page}&limit=100`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              `Unable to load requests (${response.status})`
          );
        }

        return data;
      };

      const firstPage = await fetchPage(1);

     const firstItems = Array.isArray(firstPage.data)
          ? firstPage.data
          : Array.isArray(firstPage.requests)
            ? firstPage.requests
            : Array.isArray(firstPage.items)
              ? firstPage.items
              : [];        

        const totalPages = Math.max(
          1,
          Number(
            firstPage.pagination?.totalPages ??
            firstPage.totalPages ??
            1
          )
        );

      const remainingPages = [];

      for (let page = 2; page <= totalPages; page += 1) {
        remainingPages.push(await fetchPage(page));
      }

          const allRequests = [
        ...firstItems,
        ...remainingPages.flatMap((page) => {
          if (Array.isArray(page.data)) return page.data;
          if (Array.isArray(page.requests)) return page.requests;
          if (Array.isArray(page.items)) return page.items;
          return [];
        }),
      ];

      setRequests(allRequests);
    } catch (err) {
      setError(err.message || "Unable to load procurement dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);
    
     
const loadRequestDetails = async (requestId) => {
  try {
    setDetailsLoading(true);
    setDetailsError("");
    setSubmitError("");
    setSelectedRequest(null);

    const token = getToken();

    if (!token) {
      throw new Error("Session not found. Please log in again.");
    }

    const response = await fetch(
      `${API_BASE}/procurement/${requestId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to load request details."
      );
    }

    const request = data.request || data.data;

    if (!request) {
      throw new Error("Request details were not found.");
    }

    setSelectedRequest(request);
  } catch (err) {
    setDetailsError(
      err.message || "Unable to load request details."
    );
  } finally {
    setDetailsLoading(false);
  }
};
  

  const handleSubmitRequest = async (requestId) => {
  setSubmitLoading(true);
  setSubmitError("");

  try {
    const response = await fetch(
      `${API_BASE}/procurement/${requestId}/submit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to submit request");
    }

    setSelectedRequest(null);
    await loadDashboard();
  } catch (err) {
    setSubmitError(err.message);
  } finally {
    setSubmitLoading(false);
  }
};



  const handleEditRequest = (request) => {
  setEditingRequestId(request.id);
  setIsEditMode(true);
  setEditLoading(false);
  setCreateError("");

  const requestTitle = getTitle(request);
  const storedDescription =
    request.description || request.justification || "";

  const cleanDescription = storedDescription
    .replace(/^Title:\s*[^\n]*(?:\r?\n)+/, "")
    .trim();

  setFormData({
    title: requestTitle,
    description: cleanDescription,
    amount: String(getAmount(request)),
    currency: request.currency || "INR",
    justification: "",
  });

  setSelectedRequest(null);
  setShowCreateForm(true);
};
   
    const handleUpdateRequest = async () => {
  if (!editingRequestId) return;

  setEditLoading(true);
  setCreateError("");

  try {
    const response = await fetch(
      `${API_BASE}/procurement/${editingRequestId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          amount: Number(formData.amount),
          currency: formData.currency,
          justification: formData.justification,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to update request");
    }

    setShowCreateForm(false);
    setIsEditMode(false);
    setEditingRequestId(null);
    setFormData({
      title: "",
      description: "",
      amount: "",
      currency: "INR",
      justification: "",
    });

    await loadDashboard();
  } catch (err) {
    setCreateError(err.message);
  } finally {
    setEditLoading(false);
  }
};


 const handleCreateRequest = async (e) => {
  e.preventDefault();

  try {
    setCreateLoading(true);
    setCreateError("");

    const token = getToken();

    if (!token) {
      throw new Error("Session not found. Please log in again.");
    }

    if (
      !formData.title.trim() ||
      !formData.description.trim() ||
      !formData.amount ||
      Number(formData.amount) <= 0
    ) {
      throw new Error("Please fill in all required fields correctly.");
    }

    const response = await fetch(`${API_BASE}/procurement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: formData.title.trim(),
        description: formData.description.trim(),
        amount: Number(formData.amount),
        currency: formData.currency,
        justification: formData.justification.trim(),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to create purchase request.");
    }

    setShowCreateForm(false);

    setFormData({
      title: "",
      description: "",
      amount: "",
      currency: "INR",
      justification: "",
    });

    await loadDashboard();
  } catch (err) {
    setCreateError(err.message || "Unable to create purchase request.");
  } finally {
    setCreateLoading(false);
  }
};

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const pending = requests.filter((request) =>
      [
        "IN_APPROVAL",
        "SUBMITTED",
        "PENDING",
        "PENDING_MANAGER",
        "PENDING_FINANCE",
      ].includes(getStatus(request))
    );

    const approved = requests.filter((request) =>
      ["APPROVED", "FINANCE_APPROVED", "COMPLETED"].includes(
        getStatus(request)
      )
    );

    const currencies = [
      ...new Set(
        requests.map((request) =>
          String(request.currency || "INR").toUpperCase()
        )
      ),
    ];

    const totalSpend = requests.reduce(
      (sum, request) => sum + getAmount(request),
      0
    );

    return {
      total: requests.length,
      pending: pending.length,
      approved: approved.length,
      totalSpend,
      currency: currencies.length === 1 ? currencies[0] : null,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        getStatus(request) === statusFilter;

      const searchable = [
        request.requestNumber,
        request.title,
        request.description,
        request.justification,
        request.department,
        request.departmentId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchable.includes(query);
    });
  }, [requests, search, statusFilter]);


  const monthlySpending = useMemo(() => {
    const months = [];

    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      months.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("en-IN", {
          month: "short",
        }),
        amount: 0,
      });
    }

    requests.forEach((request) => {
      const dateValue = getDate(request);
      if (!dateValue) return;

      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const month = months.find((item) => item.key === key);

      if (month) {
        month.amount += getAmount(request);
      }
    });

    return months;
  }, [requests]);

  const statusBreakdown = useMemo(() => {
    const counts = {};

    requests.forEach((request) => {
      const status = getStatus(request);
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      percentage: requests.length
        ? (count / requests.length) * 100
        : 0,
    }));
  }, [requests]);

  const maxMonthlyAmount = Math.max(
    ...monthlySpending.map((month) => month.amount),
    1
  );

  const recentRequests = filteredRequests.slice(0, 8);

  return (
    <div className="procurement-page">
      <aside className="procurement-sidebar">
        <div className="procurement-brand">
          <div className="procurement-brand-icon">E</div>
          <div>
            <h2>ETDOX</h2>
            <span>Procurement</span>
          </div>
        </div>

        <div className="procurement-nav-label">WORKSPACE</div>

        <div className="procurement-nav-item active">
          <LayoutDashboard size={19} />
          <span>Overview</span>
        </div>

        <div className="procurement-nav-item">
          <ClipboardList size={19} />
          <span>Purchase Requests</span>
        </div>

        <div className="procurement-nav-item">
          <Package size={19} />
          <span>Purchase Orders</span>
        </div>

        <div className="procurement-nav-item">
          <TrendingUp size={19} />
          <span>Reports</span>
        </div>

        <div className="procurement-sidebar-bottom">
          <span>Enterprise Procurement</span>
          <small>ETDOX Platform</small>
        </div>
      </aside>

      <main className="procurement-main">
        <header className="procurement-header">
          <div>
            <span className="procurement-breadcrumb">
              Workspace / Procurement
            </span>
            <h1>Procurement Overview</h1>
            <p>Monitor purchase requests and procurement activity.</p>
          </div>
            
            <button
             type="button"
             className="procurement-refresh"
              onClick={() => {
              setCreateError("");
              setShowCreateForm(true);
           }}
             >
           + New Request
            </button>

          <button
            className="procurement-refresh"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="procurement-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className="procurement-stats">
          <div className="procurement-stat-card">
            <div className="stat-top">
              <span>Total Requests</span>
              <div className="stat-icon blue">
                <ClipboardList size={20} />
              </div>
            </div>
            <strong>{loading ? "—" : stats.total}</strong>
            <small>Purchase requests in your accessible records</small>
          </div>

          <div className="procurement-stat-card">
            <div className="stat-top">
              <span>Pending Approval</span>
              <div className="stat-icon orange">
                <Clock3 size={20} />
              </div>
            </div>
            <strong>{loading ? "—" : stats.pending}</strong>
            <small>Requests awaiting approval</small>
          </div>

          <div className="procurement-stat-card">
            <div className="stat-top">
              <span>Approved Requests</span>
              <div className="stat-icon green">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <strong>{loading ? "—" : stats.approved}</strong>
            <small>Approved or completed requests</small>
          </div>

          <div className="procurement-stat-card">
            <div className="stat-top">
              <span>Total Request Value</span>
              <div className="stat-icon purple">
                <IndianRupee size={20} />
              </div>
            </div>

            <strong className="spend-value">
                {loading
                  ? "—"
                  : requests.length === 0
                    ? "₹0"
                    : stats.currency
                      ? formatCurrency(stats.totalSpend, stats.currency)
                      : "Multiple currencies"}
            </strong>

            <small>
              {stats.currency
                ? "Combined value of accessible requests"
                : "Values are not combined across currencies"}
            </small>
          </div>
        </section>
       
        
       <section className="procurement-analytics">
         <div className="analytics-heading">
           <div>
             <h2>Procurement Request Overview</h2>
             <p>Purchase request value over the last six months</p>
           </div>
           <span className="analytics-live-label">Live data</span>
         </div>       

         <div className="analytics-grid">
           <div className="analytics-card">
             <h3>Monthly Procurement Value</h3>
             <p className="analytics-description">
               Based on purchase request creation dates
             </p>       

             <div className="monthly-chart">
               {monthlySpending.map((month) => (
                 <div className="monthly-chart-column" key={month.key}>
                   <strong>
                     {formatCurrency(month.amount, "INR")}
                   </strong>       

                   <div className="monthly-chart-track">
                     <div
                       className="monthly-chart-bar"
                       style={{
                         height: `${(month.amount / maxMonthlyAmount) * 100}%`,
                       }}
                     />
                   </div>       

                   <span>{month.label}</span>
                 </div>
               ))}
             </div>
           </div>

    <div className="analytics-card">
      <h3>Request Status Breakdown</h3>
      <p className="analytics-description">
        Distribution of all accessible purchase requests
      </p>

      {statusBreakdown.length === 0 ? (
        <div className="analytics-no-data">
          No request data available
        </div>
      ) : (
        <div className="status-breakdown">
          {statusBreakdown.map((item) => (
            <div className="status-breakdown-item" key={item.status}>
              <div className="status-breakdown-label">
                <span>{item.status.replaceAll("_", " ")}</span>
                <strong>{item.count}</strong>
              </div>

              <div className="status-breakdown-track">
                <div
                  className={`status-breakdown-bar ${getStatusClass(item.status)}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>

              <small>{item.percentage.toFixed(1)}%</small>
                </div>
              ))}
            </div>
         )}
         </div>
       </div>
    </section>

        <section className="procurement-content-card">
          <div className="procurement-section-header">
            <div>
              <h2>Purchase Requests</h2>
              <p>Review and monitor recent purchase requests.</p>
            </div>

            <div className="procurement-filters">
              <div className="procurement-search">
                <Search size={17} />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_APPROVAL">In approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="procurement-empty">
              <RefreshCw className="spin" size={22} />
              <span>Loading procurement data...</span>
            </div>
          ) : recentRequests.length === 0 ? (
            <div className="procurement-empty">
              <ClipboardList size={30} />
              <strong>No purchase requests found</strong>
              <span>
                {requests.length === 0
                  ? "There are currently no accessible purchase requests."
                  : "Try changing your search or status filter."}
              </span>
            </div>
          ) : (
            <div className="procurement-table-wrap">
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Department</th>
                    <th>Amount</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {recentRequests.map((request) => {
                    const status = getStatus(request);
                    const currency = request.currency || "INR";

                    return (
                      <tr key={request.id}>
                        <td>
                          <div className="request-title">
                            <strong>{getTitle(request)}</strong>
                            <span>{getRequestNumber(request)}</span>
                          </div>
                        </td>

                        <td>
                          {request.department || request.departmentId || "—"}
                        </td>

                        <td className="request-amount">
                          {formatCurrency(getAmount(request), currency)}
                        </td>

                        <td>{formatDate(getDate(request))}</td>

                        <td>
                          <span
                            className={`request-status ${getStatusClass(status)}`}
                          >
                            {status.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td>
                          <button
                             className="request-view-button"
                             title="View request details"
                             onClick={() => loadRequestDetails(request.id)}
                             disabled={detailsLoading}
                             >
                           <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && requests.length > 8 && (
            <div className="procurement-table-footer">
              Showing {recentRequests.length} of {filteredRequests.length} filtered requests
            </div>
          )}
        </section>
      </main>

 {(detailsLoading || detailsError || selectedRequest) && (
  <div className="request-modal-overlay">
    <div className="request-modal">
      <div className="request-modal-header">
        <div>
          <h2>Purchase Request Details</h2>
          {selectedRequest && (
            <p>
              {getRequestNumber(selectedRequest)}
            </p>
          )}
        </div>
         
     <div className="request-modal-actions">
  {selectedRequest && getStatus(selectedRequest) === "DRAFT" && (
    <button
      className="create-request-submit"
      onClick={() => handleEditRequest(selectedRequest)}
    >
      Edit Request
    </button>
  )}

  {selectedRequest && getStatus(selectedRequest) === "DRAFT" && (
    <button
      className="create-request-submit"
      onClick={() => handleSubmitRequest(selectedRequest.id)}
      disabled={submitLoading}
    >
      {submitLoading ? "Submitting..." : "Submit Request"}
    </button>
  )}

  <button
    className="request-modal-close"
    onClick={() => {
      setSelectedRequest(null);
      setDetailsError("");
      setDetailsLoading(false);
    }}
       >
         Close
      </button>
   </div>


      </div>
        
        {submitError && (
             <p className="submit-error-message">
               {submitError}
             </p>
           )}
  
      {detailsLoading && (
        <p>Loading request details...</p>
      )}

      {detailsError && (
        <div className="request-modal-error">
          {detailsError}
        </div>
      )}

      {selectedRequest && !detailsLoading && (
        <div className="request-details-grid">
          <div>
            <span>Title</span>
            <strong>{getTitle(selectedRequest)}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{getStatus(selectedRequest)}</strong>
          </div>

          <div>
            <span>Amount</span>
            <strong>
              {formatCurrency(getAmount(selectedRequest))}
            </strong>
          </div>

          <div>
            <span>Currency</span>
            <strong>{selectedRequest.currency || "INR"}</strong>
          </div>

          <div>
            <span>Department ID</span>
            <strong>
              {selectedRequest.departmentId || "—"}
            </strong>
          </div>

          <div>
            <span>Supplier ID</span>
            <strong>
              {selectedRequest.preferredSupplierId || "—"}
            </strong>
          </div>

          <div>
            <span>Required By</span>
            <strong>
              {formatDate(selectedRequest.requiredByDate)}
            </strong>
          </div>

          <div>
            <span>Created On</span>
            <strong>
              {formatDate(getDate(selectedRequest))}
            </strong>
          </div>

          <div className="request-details-description">
            <span>Description / Justification</span>
            <p>
              {selectedRequest.description ||
                selectedRequest.justification ||
                "No description provided."}
            </p>
          </div>
        </div>
      )}
    </div>
  </div>
)}
  
    {showCreateForm && (
  <div className="request-modal-overlay">
    <div className="request-modal">
      <div className="request-modal-header">
        <div>
          <h2>Create Purchase Request</h2>
          <p>Enter the details of your purchase request.</p>
        </div>

        <button
          type="button"
          className="request-modal-close"
          onClick={() => {
            setShowCreateForm(false);
            setCreateError("");
          }}
        >
          Close
        </button>
      </div>

      <form
          onSubmit={(e) => {
            e.preventDefault();

            if (isEditMode) {
              handleUpdateRequest();
            } else {
              handleCreateRequest(e);
            }
          }}
      >         
        <div className="create-request-fields">
          <label>
            Request Title *
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  title: e.target.value,
                })
              }
              placeholder="e.g. Laptop Purchase"
              required
            />
          </label>

          <label>
            Description *
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  description: e.target.value,
                })
              }
              placeholder="Describe what you need..."
              rows={3}
              required
            />
          </label>

          <div className="create-request-row">
            <label>
              Amount *
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: e.target.value,
                  })
                }
                placeholder="Enter amount"
                required
              />
            </label>

            <label>
              Currency
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currency: e.target.value,
                  })
                }
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </label>
          </div>

          <label>
            Justification
            <textarea
              value={formData.justification}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  justification: e.target.value,
                })
              }
              placeholder="Why is this purchase required?"
              rows={3}
            />
          </label>
        </div>

        {createError && (
          <div className="request-modal-error">
            {createError}
          </div>
        )}

        <div className="create-request-actions">
          <button
            type="button"
            className="request-modal-close"
            onClick={() => {
             setShowCreateForm(false);
             setIsEditMode(false);
             setEditingRequestId(null);
             setCreateError("");
             setFormData({
               title: "",
               description: "",
               amount: "",
               currency: "INR",
               justification: "",
             });
           }}           
          >
            Cancel
          </button>

          <button
            type="submit"
            className="create-request-submit"
          disabled={isEditMode ? editLoading : createLoading}
          >
              {isEditMode
                ? editLoading
                  ? "Updating..."
                  : "Update Request"
                : createLoading
                  ? "Creating..."
                  : "Create Request"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>
  );
}
