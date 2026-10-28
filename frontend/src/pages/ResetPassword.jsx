import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import "./ResetPassword.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { label: "At least 8 characters", valid: newPassword.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", valid: /[a-z]/.test(newPassword) },
    { label: "One number", valid: /[0-9]/.test(newPassword) },
  ];

  const isPasswordValid = passwordRequirements.every((r) => r.valid);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");

    if (!token) {
      setError("Reset token is missing from the link. Please request a new password reset link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet the complexity requirements.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password. The link may have expired.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || "Password reset failed. Please request a new link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="reset-page">
      <section className="reset-card" aria-labelledby="reset-title">
        <Link to="/" className="login-brand" aria-label="ETDOX home">
          <span className="login-brand-icon">
            <ShieldCheck size={27} aria-hidden="true" />
          </span>
          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        {success ? (
          <div className="reset-success-box">
            <div className="success-icon-badge">
              <CheckCircle2 size={40} />
            </div>
            <header className="reset-heading text-center">
              <span className="reset-eyebrow">SECURITY CONFIRMED</span>
              <h1 id="reset-title">Password Reset Complete</h1>
              <p>Your ETDOX account password has been updated and previous sessions have been revoked.</p>
            </header>
            <Link to="/login" className="login-button">
              Sign in with New Password <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <header className="reset-heading">
              <span className="reset-eyebrow">CHOOSE NEW CREDENTIALS</span>
              <h1 id="reset-title">Set new password</h1>
              <p>Create a strong password to protect your corporate procurement account.</p>
            </header>

            {!token && (
              <div className="login-error" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>No reset token provided. Please use the link sent to your email.</span>
              </div>
            )}

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="reset-form" noValidate>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <div className="input-wrapper">
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError("");
                    }}
                    autoComplete="new-password"
                    required
                    disabled={loading || !token}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div className="input-wrapper">
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    autoComplete="new-password"
                    required
                    disabled={loading || !token}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div className="password-checklist">
                  {passwordRequirements.map((req, idx) => (
                    <div key={idx} className={`req-item ${req.valid ? "met" : ""}`}>
                      <span className="req-dot" />
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="login-button" disabled={loading || !token}>
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="spin" aria-hidden="true" />
                    Updating password…
                  </>
                ) : (
                  <>
                    Reset Password
                    <ArrowRight size={19} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <footer className="login-footer">
              <Link to="/login">Back to Sign in</Link>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
