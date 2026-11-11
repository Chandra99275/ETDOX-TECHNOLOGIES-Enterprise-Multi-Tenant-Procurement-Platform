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
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

const LOGIN_URL = `${API_BASE_URL}/auth/login`;
const RESEND_VERIFICATION_URL = `${API_BASE_URL}/auth/resend-verification`;

const REQUEST_TIMEOUT = 15000;

// --------------------------------------------------
// ROLE-BASED DASHBOARD ROUTING
// --------------------------------------------------

const ROLE_DASHBOARDS = {
  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",

  employee: "/employee/dashboard",
  requester: "/employee/dashboard",
  supplier_user: "/employee/dashboard",

  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",
  procurement_manager: "/manager/dashboard",

  procurement_specialist: "/admin/dashboard",
  auditor: "/admin/dashboard",

  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",
};

// --------------------------------------------------
// RESPONSE HELPERS
// --------------------------------------------------

function getRole(user) {
  const directRole = user?.role ?? user?.roleName;

  if (typeof directRole === "string" && directRole.trim()) {
    return directRole.trim().toLowerCase();
  }

  if (Array.isArray(user?.roles)) {
    const role = user.roles.find((item) => {
      if (typeof item === "string") {
        return item.trim().length > 0;
      }

      return (
        typeof item?.name === "string" &&
        item.name.trim().length > 0
      );
    });

    if (typeof role === "string") {
      return role.trim().toLowerCase();
    }

    if (typeof role?.name === "string") {
      return role.name.trim().toLowerCase();
    }
  }

  return "";
}

async function readResponse(response) {
  const body = await response.text();

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return { message: body };
  }
}

function getPayload(data) {
  let payload = data;

  // Support common API response formats:
  // { data: { user, accessToken } }
  // { success: true, data: { user, token } }
  // { user, token }

  for (let index = 0; index < 3; index += 1) {
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

  for (const key of keys) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

function saveSession(user, token) {
  clearSession();

  // Some existing ETDOX API clients use different token keys.
  // Keep them consistent when the API returns a bearer token.
  if (token && typeof token === "string" && token.trim()) {
    const normalizedToken = token.trim();

    localStorage.setItem("token", normalizedToken);
    localStorage.setItem("accessToken", normalizedToken);
    localStorage.setItem("authToken", normalizedToken);
  }

  localStorage.setItem("user", JSON.stringify(user));
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

    if (loading) {
      return;
    }

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

        // Supports secure HTTP-only cookie authentication.
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

      const payload = getPayload(data);

      const token =
        payload?.accessToken ??
        payload?.access_token ??
        payload?.token ??
        data?.accessToken ??
        data?.access_token ??
        data?.token ??
        "";

      const user =
        payload?.user ??
        data?.user;

      if (
        !user ||
        typeof user !== "object" ||
        Array.isArray(user)
      ) {
        throw new Error(
          "Login succeeded, but the API response did not include valid user details. Check the backend login response."
        );
      }

      const role = getRole(user);

      const dashboard =
        data?.redirectTo ||
        payload?.redirectTo ||
        ROLE_DASHBOARDS[role] ||
        "/employee/dashboard";

      const authenticatedUser = {
        ...user,
        email: user.email || normalizedEmail,
        role,
      };

      try {
        saveSession(authenticatedUser, token);
      } catch (storageError) {
        console.error(
          "[ETDOX Login] Unable to save session:",
          storageError
        );

        throw new Error(
          "Login was accepted, but the browser could not save your session. Check your browser storage settings."
        );
      }

      // Navigate only after a successful API response.
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
          err?.message || "Login failed. Please try again."
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
    const normalizedEmail = email.trim().toLowerCase();

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
      const response = await fetch(RESEND_VERIFICATION_URL, {
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
  // UI
  // ------------------------------------------------

  return (
    <main className="login-page">
      <section
        className="login-card"
        aria-labelledby="login-title"
      >
        <Link
          to="/"
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

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
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

        <div className="login-security-note">
          <CheckCircle2
            size={16}
            aria-hidden="true"
          />

          <span>
            Protected with HTTP-only cookie session and enterprise encryption
          </span>
        </div>

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

          <Link to="/">
            Back to home
          </Link>
        </footer>
      </section>
    </main>
  );
}