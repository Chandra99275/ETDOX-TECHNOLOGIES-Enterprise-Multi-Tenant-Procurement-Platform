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
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./Login.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

const LOGIN_URL = `${API_BASE_URL}/auth/login`;

const ROLE_DASHBOARDS = {
  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",
  employee: "/employee/dashboard",
  requester: "/employee/dashboard",
  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",
  procurement_manager: "/manager/dashboard",
  procurement_specialist: "/admin/dashboard",
  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",
  auditor: "/admin/dashboard",
  supplier_user: "/employee/dashboard",
};

function getRole(user) {
  const directRole = user?.role ?? user?.roleName;

  if (typeof directRole === "string" && directRole.trim()) {
    return directRole.trim().toLowerCase();
  }

  if (Array.isArray(user?.roles)) {
    const role = user.roles.find(
      (item) =>
        (typeof item === "string" && item.trim()) ||
        (typeof item?.name === "string" && item.name.trim())
    );

    if (typeof role === "string") return role.trim().toLowerCase();
    if (typeof role?.name === "string") return role.name.trim().toLowerCase();
  }

  return "";
}

async function readResponse(response) {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return { message: body };
  }
}

function getErrorMessage(data, fallback) {
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return fallback;
}

function clearSession() {
  for (const key of ["token", "accessToken", "authToken", "user"]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

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

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      let response;

      try {
        response = await fetch(LOGIN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include", // Enables secure HTTP-only cookies
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const data = await readResponse(response);

      if (!response.ok) {
        const code = data?.error?.code || data?.error || "";
        setErrorCode(code);

        throw new Error(
          getErrorMessage(
            data,
            response.status === 401
              ? "Invalid email or password."
              : `Login failed (HTTP ${response.status}).`
          )
        );
      }

      const payload = data?.data ?? data;
      const token =
        payload?.accessToken ??
        payload?.token ??
        data?.accessToken ??
        data?.token;

      const user = payload?.user ?? data?.user;

      if (!user || typeof user !== "object" || Array.isArray(user)) {
        throw new Error("The API response did not include valid user details.");
      }

      const role = getRole(user);
      const dashboard = data?.redirectTo || ROLE_DASHBOARDS[role] || "/employee/dashboard";

      const authenticatedUser = {
        ...user,
        email: user.email || normalizedEmail,
        role,
      };

      try {
        clearSession();
        if (token) {
          localStorage.setItem("token", token.trim());
        }
        localStorage.setItem("user", JSON.stringify(authenticatedUser));
      } catch {
        // Continue if storage is restricted
      }

      navigate(dashboard, { replace: true });
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Login timed out. Check that the API is running.");
      } else if (err instanceof TypeError) {
        setError(
          `Cannot connect to the API at ${API_BASE_URL}. Check that the backend is running and CORS is configured.`
        );
      } else {
        setError(err?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || resending) return;

    setResending(true);
    setResendStatus("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendStatus("A new verification link has been sent to your email.");
      } else {
        setResendStatus(data.message || "Failed to resend. Please try again later.");
      }
    } catch {
      setResendStatus("Could not resend email. Please check your connection.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Link to="/" className="login-brand" aria-label="ETDOX home">
          <span className="login-brand-icon">
            <ShieldCheck size={27} aria-hidden="true" />
          </span>
          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        <header className="login-heading">
          <span className="login-eyebrow">SECURE WORKSPACE ACCESS</span>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to continue to your ETDOX procurement dashboard.</p>
        </header>

        {noticeMessage && (
          <div className="login-notice-banner" role="status">
            <Info size={17} aria-hidden="true" />
            <span>{noticeMessage}</span>
          </div>
        )}

        {error && (
          <div className="login-error" role="alert" aria-live="polite">
            <AlertCircle size={18} aria-hidden="true" />
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
                    {resending ? "Sending…" : "Resend verification email"}
                  </button>
                  {resendStatus && <div className="inline-resend-feedback">{resendStatus}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <Mail size={19} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your company email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
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
              <Link to="/forgot-password" className="auth-subtle-link">
                Forgot password?
              </Link>
            </div>
            <div className="input-wrapper">
              <LockKeyhole size={19} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={19} aria-hidden="true" />
                ) : (
                  <Eye size={19} aria-hidden="true" />
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
                <ArrowRight size={19} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="login-security-note">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>Protected with HTTP-only cookie session and enterprise encryption</span>
        </div>

        <footer className="login-footer">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="login-link-bold">
              Create an account
            </Link>
          </p>
          <Link to="/">Back to home</Link>
        </footer>
      </section>
    </main>
  );
}