
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
} from "lucide-react";
import "./LoginPage.css";

// --------------------------------------------------
// API CONFIGURATION
// --------------------------------------------------

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

const LOGIN_URL = `${API_BASE_URL}/auth/login`;
const RESEND_VERIFICATION_URL =
  `${API_BASE_URL}/auth/resend-verification`;

const REQUEST_TIMEOUT = 15000;

// --------------------------------------------------
// ALL 9 ETDOX ROLE DASHBOARDS
// --------------------------------------------------

const ROLE_DASHBOARDS = {
  // 1. Employee / Requester
  employee: "/employee/dashboard",
  requester: "/employee/dashboard",

  // 2. Department Manager
  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",

  // 3. Finance Manager
  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",

  // 4. Organization Admin
  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",

  // 5. Procurement Manager
  procurement_manager: "/procurement-manager/dashboard",

  // 6. Procurement Specialist
  procurement_specialist: "/procurement-specialist/dashboard",

  // 7. Auditor
  auditor: "/auditor/dashboard",

  // 8. Supplier User
  supplier_user: "/supplier/dashboard",

  // 9. Platform Admin
  platform_admin: "/platform-admin/dashboard",
};

// --------------------------------------------------
// ROLE PRIORITY
// --------------------------------------------------

const ROLE_PRIORITY = [
  "platform_admin",
  "procurement_manager",
  "procurement_specialist",
  "organization_admin",
  "admin",
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
// ROLE NORMALIZATION
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

// --------------------------------------------------
// GET ALL USER ROLES
// --------------------------------------------------

function getUserRoles(user) {
  const possibleRoles = [
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
    user?.permissions?.role,
  ];

  const roles = [];

  possibleRoles.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const role = normalizeRole(item);

        if (role) {
          roles.push(role);
        }
      });
    } else {
      const role = normalizeRole(value);

      if (role) {
        roles.push(role);
      }
    }
  });

  return [...new Set(roles)];
}

// --------------------------------------------------
// GET PRIMARY ROLE
// --------------------------------------------------

function getPrimaryRole(user) {
  const roles = getUserRoles(user);

  return (
    ROLE_PRIORITY.find((role) =>
      roles.includes(role)
    ) || ""
  );
}

// --------------------------------------------------
// API RESPONSE HELPERS
// --------------------------------------------------

async function readResponse(response) {
  const body = await response.text();

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return {
      message: body,
    };
  }
}

function getPayload(data) {
  let payload = data;

  for (let index = 0; index < 4; index += 1) {
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

  if (
    typeof error === "object" &&
    error !== null
  ) {
    return (
      error.code ||
      data?.code ||
      data?.errorCode ||
      ""
    );
  }

  return (
    data?.code ||
    data?.errorCode ||
    ""
  );
}

function getErrorMessage(data, fallback) {
  if (
    typeof data?.message === "string" &&
    data.message.trim()
  ) {
    return data.message.trim();
  }

  if (
    typeof data?.error?.message === "string" &&
    data.error.message.trim()
  ) {
    return data.error.message.trim();
  }

  if (
    typeof data?.error === "string" &&
    data.error.trim()
  ) {
    return data.error.trim();
  }

  return fallback;
}

// --------------------------------------------------
// SESSION HELPERS
// --------------------------------------------------

function clearSession() {
  const keys = [
    "token",
    "accessToken",
    "authToken",
    "user",
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function saveSession(user, token) {
  clearSession();

  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "The login API did not return a valid access token."
    );
  }

  const normalizedToken = token.trim();

  localStorage.setItem("token", normalizedToken);
  localStorage.setItem("accessToken", normalizedToken);
  localStorage.setItem("authToken", normalizedToken);

  localStorage.setItem(
    "user",
    JSON.stringify(user)
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
  // HANDLE LOGIN
  // ------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setErrorCode("");
    setResendStatus("");

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      setError(
        "Enter your email address and password."
      );
      return;
    }

    setLoading(true);

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

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

      // --------------------------------------------
      // HANDLE API ERRORS
      // --------------------------------------------

      if (!response.ok) {
        const code = getErrorCode(data);

        setErrorCode(code);

        if (response.status === 401) {
          throw new Error(
            "Invalid email or password. Check your credentials and make sure this account exists in the ETDOX database."
          );
        }

        if (response.status === 403) {
          throw new Error(
            getErrorMessage(
              data,
              "Access denied. Your account may need verification or authorization."
            )
          );
        }

        if (response.status === 429) {
          throw new Error(
            "Too many login attempts. Please wait a moment before trying again."
          );
        }

        if (response.status >= 500) {
          throw new Error(
            "The ETDOX server encountered an error. Check the backend terminal for details."
          );
        }

        throw new Error(
          getErrorMessage(
            data,
            `Login failed with HTTP ${response.status}.`
          )
        );
      }

      // --------------------------------------------
      // EXTRACT RESPONSE DATA
      // --------------------------------------------

      const payload = getPayload(data);

      const token =
        payload?.accessToken ||
        payload?.access_token ||
        payload?.token ||
        data?.accessToken ||
        data?.access_token ||
        data?.token ||
        "";

      const user =
        payload?.user ||
        data?.user ||
        payload?.account ||
        null;

      if (
        !user ||
        typeof user !== "object" ||
        Array.isArray(user)
      ) {
        throw new Error(
          "Login succeeded, but the API response did not include valid user details. Check the backend login response."
        );
      }

      // --------------------------------------------
      // IDENTIFY ROLE
      // --------------------------------------------

      const roles = getUserRoles(user);
      const role = getPrimaryRole(user);

      if (!role || !ROLE_DASHBOARDS[role]) {
        throw new Error(
          "Your account does not have a supported ETDOX role. Contact your administrator to assign the correct role."
        );
      }

      // --------------------------------------------
      // GET ROLE DASHBOARD
      // --------------------------------------------

      const dashboard = ROLE_DASHBOARDS[role];

      // --------------------------------------------
      // PREPARE AUTHENTICATED USER
      // --------------------------------------------

      const authenticatedUser = {
        ...user,

        email: user.email || normalizedEmail,

        role,

        roles,
      };

      // --------------------------------------------
      // SAVE SESSION
      // --------------------------------------------

      try {
        saveSession(
          authenticatedUser,
          token
        );
      } catch (storageError) {
        clearSession();

        console.error(
          "[ETDOX Login] Unable to save session:",
          storageError
        );

        throw new Error(
          storageError?.message ||
            "Unable to save your login session. Check browser storage settings."
        );
      }

      // --------------------------------------------
      // NAVIGATE TO ROLE DASHBOARD
      // --------------------------------------------

      navigate(dashboard, {
        replace: true,
      });

    } catch (err) {
      if (err?.name === "AbortError") {
        setError(
          "Login timed out. Check that the backend is running on port 5000."
        );
      } else if (err instanceof TypeError) {
        setError(
          `Cannot connect to the API at ${API_BASE_URL}. Check that the backend is running and CORS allows your frontend origin.`
        );
      } else {
        setError(
          err?.message ||
            "Login failed. Please try again."
        );
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
  // RESEND VERIFICATION EMAIL
  // ------------------------------------------------

  async function handleResendVerification() {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (!normalizedEmail || resending) {
      return;
    }

    setResending(true);
    setResendStatus("");

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      const response = await fetch(
        RESEND_VERIFICATION_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            email: normalizedEmail,
          }),

          signal: controller.signal,
        }
      );

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
      <section
        className="login-card"
        aria-labelledby="login-title"
      >
        {/* BRAND */}

        <Link
          to="/landingpage"
          className="login-brand"
          aria-label="ETDOX home"
        >
          <span className="login-brand-icon">
            <ShieldCheck
              size={27}
              aria-hidden="true"
            />
          </span>

          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        {/* HEADING */}

        <header className="login-heading">
          <span className="login-eyebrow">
            SECURE WORKSPACE ACCESS
          </span>

          <h1 id="login-title">
            Welcome back
          </h1>

          <p>
            Sign in to continue to your ETDOX procurement dashboard.
          </p>
        </header>

        {/* NOTICE */}

        {noticeMessage && (
          <div
            className="login-notice-banner"
            role="status"
          >
            <Info
              size={17}
              aria-hidden="true"
            />

            <span>{noticeMessage}</span>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div
            className="login-error"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle
              size={18}
              aria-hidden="true"
            />

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

        {/* LOGIN FORM */}

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          {/* EMAIL */}

          <div className="form-group">
            <label htmlFor="email">
              Email address
            </label>

            <div className="input-wrapper">
              <Mail
                size={19}
                aria-hidden="true"
              />

              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your company email"
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

          {/* PASSWORD */}

          <div className="form-group">
            <div className="label-with-link">
              <label htmlFor="password">
                Password
              </label>

              <Link
                to="/forgot-password"
                className="auth-subtle-link"
              >
                Forgot password?
              </Link>
            </div>

            <div className="input-wrapper">
              <LockKeyhole
                size={19}
                aria-hidden="true"
              />

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
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
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff
                    size={19}
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    size={19}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>

          {/* SUBMIT */}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="login-spinner spin"
                  aria-hidden="true"
                />

                Signing in…
              </>
            ) : (
              <>
                Sign in

                <ArrowRight
                  size={19}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </form>

        {/* SECURITY */}

        <div className="login-security-note">
          <CheckCircle2
            size={16}
            aria-hidden="true"
          />

          <span>
            Protected with secure authentication and enterprise encryption
          </span>
        </div>

        {/* FOOTER */}

        <footer className="login-footer">
          <p>
            Don't have an account?{" "}

            <Link
              to="/register"
              className="login-link-bold"
            >
              Create an account
            </Link>
          </p>

          <Link to="/landingpage">
            Back to home
          </Link>
        </footer>
      </section>
    </main>
  );
}
