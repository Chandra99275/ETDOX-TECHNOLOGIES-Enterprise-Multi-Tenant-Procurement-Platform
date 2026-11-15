
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  TrendingUp,
  ShoppingCart,
  Users,
  Wallet,
  Building2,
  BarChart3,
  ArrowUpRight,
  Activity,
  ChevronRight,
} from "lucide-react";
import "./LoginPage.css";

// --------------------------------------------------
// API CONFIGURATION
// --------------------------------------------------

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).trim().replace(/\/+$/, "");

const LOGIN_URL = `${API_BASE_URL}/auth/login`;
const RESEND_VERIFICATION_URL = `${API_BASE_URL}/auth/resend-verification`;
const REQUEST_TIMEOUT = 15000;

// --------------------------------------------------
// ROLE DASHBOARDS
// --------------------------------------------------

const ROLE_DASHBOARDS = Object.freeze({
  platform_admin: "/platform-admin/dashboard",
  organization_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  procurement_manager: "/procurement-manager/dashboard",
  procurement_specialist: "/procurement-specialist/dashboard",
  auditor: "/auditor/dashboard",
  finance_manager: "/finance/dashboard",
  finance: "/finance/dashboard",
  department_manager: "/manager/dashboard",
  manager: "/manager/dashboard",
  supplier_user: "/supplier/dashboard",
  requester: "/employee/dashboard",
  employee: "/employee/dashboard",
});

const ROLE_PRIORITY = [
  "platform_admin",
  "organization_admin",
  "admin",
  "procurement_manager",
  "procurement_specialist",
  "finance_manager",
  "finance",
  "auditor",
  "department_manager",
  "manager",
  "supplier_user",
  "requester",
  "employee",
];

// --------------------------------------------------
// ROLE HELPERS
// --------------------------------------------------

function normalizeRole(role) {
  if (!role) return "";

  if (typeof role === "object") {
    role =
      role.name ||
      role.slug ||
      role.code ||
      role.role ||
      "";
  }

  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getUserRoles(user) {
  const roles = [];

  function addRole(value) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(addRole);
      return;
    }

    const normalized = normalizeRole(value);
    if (normalized) roles.push(normalized);
  }

  [
    user?.role,
    user?.roleName,
    user?.role_name,
    user?.userRole,
    user?.user_type,
    user?.userType,
    user?.primaryRole,
    user?.primary_role,
    user?.roles,
    user?.account?.role,
    user?.account?.roles,
    user?.permissions?.role,
  ].forEach(addRole);

  return [...new Set(roles)];
}

function getPrimaryRole(user) {
  const roles = getUserRoles(user);
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || "";
}

// --------------------------------------------------
// API RESPONSE HELPERS
// --------------------------------------------------

async function readResponse(response) {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    return { message: body };
  }
}

function getPayload(data) {
  let payload = data;

  for (let index = 0; index < 5; index += 1) {
    if (
      payload?.data &&
      typeof payload.data === "object" &&
      !Array.isArray(payload.data)
    ) {
      payload = payload.data;
    } else {
      break;
    }
  }

  return payload;
}

function getErrorCode(data) {
  const error = data?.error;

  if (typeof error === "object" && error !== null) {
    return error.code || data?.code || data?.errorCode || "";
  }

  return data?.code || data?.errorCode || "";
}

function getErrorMessage(data, fallback) {
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (
    typeof data?.error?.message === "string" &&
    data.error.message.trim()
  ) {
    return data.error.message.trim();
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error.trim();
  }

  return fallback;
}

function getAuthenticatedUser(payload, data) {
  return (
    payload?.user ||
    payload?.account?.user ||
    payload?.account ||
    data?.user ||
    null
  );
}

function getAccessToken(payload, data) {
  return (
    payload?.accessToken ||
    payload?.access_token ||
    payload?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.token ||
    ""
  );
}

// --------------------------------------------------
// SESSION HELPERS
// --------------------------------------------------

function clearSession() {
  ["token", "accessToken", "authToken", "user"].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function saveSession(user, token) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error(
      "The login API did not return a valid access token."
    );
  }

  if (!user || typeof user !== "object" || Array.isArray(user)) {
    throw new Error(
      "The login API did not return valid user details."
    );
  }

  const normalizedToken = token.trim();

  clearSession();

  localStorage.setItem("accessToken", normalizedToken);
  localStorage.setItem("token", normalizedToken);
  localStorage.setItem("authToken", normalizedToken);
  localStorage.setItem("user", JSON.stringify(user));
}

// --------------------------------------------------
// ANALYTICS DISPLAY
// Sample data only — not connected to backend APIs.
// --------------------------------------------------

function OrganizationShowcase() {
  const activity = [
    { month: "May", value: 44 },
    { month: "Jun", value: 59 },
    { month: "Jul", value: 48 },
    { month: "Aug", value: 73 },
    { month: "Sep", value: 62 },
    { month: "Oct", value: 87 },
    { month: "Nov", value: 76 },
  ];

  return (
    <section className="organization-showcase">
      <div className="showcase-decoration showcase-decoration-one" />
      <div className="showcase-decoration showcase-decoration-two" />

      {/* ORGANIZATION HEADER */}

      <header className="showcase-header">
        <Link to="/landingpage" className="showcase-logo">
          <span className="showcase-logo-icon">
            <Building2 size={19} />
          </span>

          <span className="showcase-logo-copy">
            <strong>ETDOX</strong>
            <small>ORGANIZATION</small>
          </span>
        </Link>

        <div className="showcase-status">
          <span className="status-indicator" />
          ENTERPRISE PLATFORM
        </div>
      </header>

      {/* INTRODUCTION */}

      <div className="showcase-intro">
        <span className="showcase-eyebrow">
          <span />
          THE FUTURE OF PROCUREMENT
        </span>

        <h2>
          Every decision.
          <br />
          <span>One connected platform.</span>
        </h2>

        <p>
          Manage purchasing, suppliers, finance, and organizational
          operations with clarity, control, and confidence.
        </p>
      </div>

      {/* KPI ROW */}

      <div className="showcase-kpis">
        <article className="showcase-kpi">
          <div className="kpi-top">
            <span className="kpi-icon kpi-icon-blue">
              <Wallet size={17} />
            </span>
            <span className="kpi-caption">SPEND OVERVIEW</span>
          </div>
          <strong>₹24.8L</strong>
          <small><TrendingUp size={12} /> Illustrative figure</small>
        </article>

        <article className="showcase-kpi">
          <div className="kpi-top">
            <span className="kpi-icon kpi-icon-cyan">
              <ShoppingCart size={17} />
            </span>
            <span className="kpi-caption">PURCHASE ORDERS</span>
          </div>
          <strong>128</strong>
          <small>Sample dashboard metric</small>
        </article>

        <article className="showcase-kpi">
          <div className="kpi-top">
            <span className="kpi-icon kpi-icon-purple">
              <Users size={17} />
            </span>
            <span className="kpi-caption">SUPPLIERS</span>
          </div>
          <strong>46</strong>
          <small>Sample dashboard metric</small>
        </article>
      </div>

      {/* MAIN SPEND CHART */}

      <article className="showcase-panel spend-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-overline">FINANCIAL INSIGHTS</span>
            <h3>Procurement spend</h3>
          </div>

          <span className="sample-tag">SAMPLE DATA</span>
        </div>

        <div className="spend-summary">
          <div>
            <strong>₹24.8L</strong>
            <span>Illustrative total spend</span>
          </div>
          <span className="spend-trend">
            <TrendingUp size={13} />
            Trend preview
          </span>
        </div>

        <div className="spend-graph">
          <div className="spend-axis">
            <span>30L</span>
            <span>20L</span>
            <span>10L</span>
            <span>0</span>
          </div>

          <div className="spend-graph-area">
            <div className="spend-grid">
              <i />
              <i />
              <i />
              <i />
            </div>

            <svg
              viewBox="0 0 600 180"
              preserveAspectRatio="none"
              role="img"
              aria-label="Illustrative procurement spend trend"
              className="spend-line-chart"
            >
              <defs>
                <linearGradient id="etdoxLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#40d8e8" />
                  <stop offset="100%" stopColor="#6e9cff" />
                </linearGradient>

                <linearGradient id="etdoxArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#40d8e8" stopOpacity=".27" />
                  <stop offset="100%" stopColor="#40d8e8" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M0 145 C45 139 55 116 95 122 S150 103 190 110 S235 77 280 88 S335 62 375 74 S430 42 470 53 S530 23 600 17 L600 180 L0 180 Z"
                fill="url(#etdoxArea)"
              />

              <path
                d="M0 145 C45 139 55 116 95 122 S150 103 190 110 S235 77 280 88 S335 62 375 74 S430 42 470 53 S530 23 600 17"
                fill="none"
                stroke="url(#etdoxLine)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              <circle cx="600" cy="17" r="5" fill="#69e4ee" stroke="#102c4b" strokeWidth="3" />
            </svg>

            <div className="spend-months">
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
              <span>Nov</span>
            </div>
          </div>
        </div>
      </article>

      {/* SUPPORTING ANALYTICS */}

      <div className="showcase-bottom">
        <article className="showcase-panel mini-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-overline">PROCUREMENT</span>
              <h3>Monthly activity</h3>
            </div>
            <Activity size={17} />
          </div>

          <div className="activity-graph">
            {activity.map((item) => (
              <div className="activity-column" key={item.month}>
                <div className="activity-track">
                  <span style={{ height: `${item.value}%` }} />
                </div>
                <small>{item.month}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="showcase-panel mini-panel supplier-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-overline">ORGANIZATION</span>
              <h3>Supplier network</h3>
            </div>
            <Users size={17} />
          </div>

          <div className="supplier-content">
            <div className="supplier-ring">
              <div>
                <strong>46</strong>
                <small>SUPPLIERS</small>
              </div>
            </div>

            <div className="supplier-legend">
              <span><i className="supplier-blue" /> Active</span>
              <span><i className="supplier-cyan" /> Review</span>
              <span><i className="supplier-purple" /> Pending</span>
            </div>
          </div>
        </article>
      </div>

      {/* FOOTER */}

      <footer className="showcase-footer">
        <div className="showcase-security">
          <ShieldCheck size={15} />
          <span>Secure enterprise access</span>
        </div>

        <span className="showcase-footer-label">
          PROCUREMENT · FINANCE · SUPPLIERS
        </span>
      </footer>
    </section>
  );
}

// --------------------------------------------------
// LOGIN COMPONENT
// --------------------------------------------------

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  const noticeMessage = location.state?.message;

  // ------------------------------------------------
  // LOGIN
  // ------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setErrorCode("");
    setResendStatus("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
        signal: controller.signal,
      });

      const data = await readResponse(response);

      if (!response.ok) {
        const code = getErrorCode(data);
        setErrorCode(code);

        if (response.status === 401) {
          throw new Error(
            "Invalid email or password. Check your credentials and try again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            getErrorMessage(
              data,
              "Access denied. Your account may need verification or administrator approval."
            )
          );
        }

        if (response.status === 429) {
          throw new Error(
            "Too many login attempts. Please wait before trying again."
          );
        }

        if (response.status >= 500) {
          throw new Error(
            getErrorMessage(
              data,
              "The ETDOX server encountered an error. Check the backend terminal."
            )
          );
        }

        throw new Error(
          getErrorMessage(data, `Login failed with HTTP ${response.status}.`)
        );
      }

      const payload = getPayload(data);
      const token = getAccessToken(payload, data);
      const user = getAuthenticatedUser(payload, data);

      if (!user || typeof user !== "object" || Array.isArray(user)) {
        throw new Error(
          "Login succeeded, but the API response did not include valid user details."
        );
      }

      const roles = getUserRoles(user);
      const primaryRole = getPrimaryRole(user);

      if (!roles.length || !primaryRole) {
        throw new Error(
          "Your account does not have a supported ETDOX role. Contact your administrator."
        );
      }

      const dashboard = ROLE_DASHBOARDS[primaryRole];

      if (!dashboard) {
        throw new Error(
          `No dashboard is configured for role: ${primaryRole}.`
        );
      }

      const userId = user.id || user.userId || user.user_id;

      if (!userId) {
        throw new Error(
          "The login response is missing the user ID. Contact your administrator."
        );
      }

      const authenticatedUser = {
        ...user,
        id: userId,
        email: user.email || normalizedEmail,
        role: primaryRole,
        roleName: primaryRole,
        roles,
      };

      try {
        saveSession(authenticatedUser, token);
      } catch (storageError) {
        clearSession();

        console.error(
          "[ETDOX Login] Session storage error:",
          storageError
        );

        throw new Error(
          storageError?.message || "Unable to save your login session."
        );
      }

      console.info("[ETDOX Login] Authentication successful", {
        userId,
        roles,
        primaryRole,
        dashboard,
      });

      navigate(dashboard, { replace: true });
    } catch (err) {
      if (err?.name === "AbortError") {
        setError(
          "Login timed out. Check that the backend is running on port 5000."
        );
      } else if (err instanceof TypeError) {
        setError(
          `Cannot connect to the API at ${API_BASE_URL}. Check the backend and CORS configuration.`
        );
      } else {
        setError(err?.message || "Login failed. Please try again.");
      }

      console.error("[ETDOX Login Error]", {
        endpoint: LOGIN_URL,
        message: err?.message,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  // ------------------------------------------------
  // RESEND VERIFICATION
  // ------------------------------------------------

  async function handleResendVerification() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || resending) return;

    setResending(true);
    setResendStatus("");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(RESEND_VERIFICATION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail }),
        signal: controller.signal,
      });

      const data = await readResponse(response);

      if (response.ok) {
        setResendStatus(
          getErrorMessage(
            data,
            "If the account requires verification, a verification email will be sent."
          )
        );
      } else {
        setResendStatus(
          getErrorMessage(
            data,
            "Unable to resend the verification email. Please try again later."
          )
        );
      }
    } catch (err) {
      setResendStatus(
        err?.name === "AbortError"
          ? "The request timed out. Please try again."
          : "Could not contact the server. Check your connection and try again."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setResending(false);
    }
  }

  // ------------------------------------------------
  // LOGIN UI
  // ------------------------------------------------

  return (
    <main className="login-page">
      <div className="login-layout">

        {/* LEFT: LOGIN FORM */}

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-content">

            <Link
              to="/landingpage"
              className="login-brand"
              aria-label="ETDOX home"
            >
              <span className="login-brand-icon">
                <ShieldCheck size={25} />
              </span>

              <span className="login-brand-text">
                <strong>ETDOX</strong>
                <small>Enterprise Platform</small>
              </span>
            </Link>

            <header className="login-heading">
              <span className="login-eyebrow">
                YOUR WORKSPACE AWAITS
              </span>

              <h1 id="login-title">Welcome back.</h1>

              <p>
                Sign in to access your organization's procurement
                workspace and business operations.
              </p>
            </header>

            {noticeMessage && (
              <div className="login-notice-banner" role="status">
                <Info size={17} />
                <span>{noticeMessage}</span>
              </div>
            )}

            {error && (
              <div
                className="login-error"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle size={18} />

                <div className="error-body">
                  <span>{error}</span>

                  {errorCode === "EMAIL_NOT_VERIFIED" && (
                    <div className="unverified-action">
                      <button
                        type="button"
                        className="inline-resend-btn"
                        onClick={handleResendVerification}
                        disabled={resending}
                      >
                        {resending
                          ? "Sending…"
                          : "Resend verification email"}
                      </button>

                      {resendStatus && (
                        <div
                          className="inline-resend-feedback"
                          role="status"
                        >
                          {resendStatus}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Work email address</label>

                <div className="input-wrapper">
                  <Mail size={18} aria-hidden="true" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setErrorCode("");
                      setResendStatus("");
                    }}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-with-link">
                  <label htmlFor="password">Password</label>

                  <Link
                    to="/forgot-password"
                    className="auth-subtle-link"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="input-wrapper">
                  <LockKeyhole size={18} aria-hidden="true" />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      setErrorCode("");
                      setResendStatus("");
                    }}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((visible) => !visible)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="login-spinner"
                    />
                    Signing in…
                  </>
                ) : (
                  <>
                    Access workspace
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="login-divider">
              <span />
              <small>SECURE ORGANIZATION ACCESS</small>
              <span />
            </div>

            <div className="login-security-note">
              <ShieldCheck size={16} />
              <span>
                Your account is protected with secure authentication.
              </span>
            </div>

            <footer className="login-footer">
              <p>
                New to ETDOX?{" "}
                <Link to="/register" className="login-link-bold">
                  Create an account
                </Link>
              </p>

              <Link to="/landingpage" className="back-home-link">
                Back to ETDOX home
                <ChevronRight size={14} />
              </Link>
            </footer>
          </div>

          <div className="login-card-bottom">
            <span>© {new Date().getFullYear()} ETDOX</span>
            <span>Enterprise Procurement Platform</span>
          </div>
        </section>

        {/* RIGHT: ORGANIZATION ANALYTICS */}

        <OrganizationShowcase />
      </div>
    </main>
  );
}
