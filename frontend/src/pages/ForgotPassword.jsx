import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./ForgotPassword.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Multi-step state: "email" | "otp" | "password" | "success"
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const passwordRequirements = [
    { label: "At least 8 characters", valid: newPassword.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", valid: /[a-z]/.test(newPassword) },
    { label: "One number", valid: /[0-9]/.test(newPassword) },
  ];

  const isPasswordValid = passwordRequirements.every((r) => r.valid);

  // Step 1: Request OTP to Email
  async function handleRequestOtp(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setSuccessMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your work email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to process request. Please try again.");
      }

      setStep("otp");
      setResendCooldown(30);
      setSuccessMessage("Verification code has been sent to your email.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    if (resendCooldown > 0 || loading) return;

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend code.");
      }

      setResendCooldown(30);
      setSuccessMessage("A fresh verification code has been dispatched to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify 6-digit OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    if (cleanOtp.length !== 6) {
      setError("Verification code must be exactly 6 digits.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-reset-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Invalid or expired verification code.");
      }

      setSuccessMessage("");
      setStep("password");
    } catch (err) {
      setError(err.message || "The verification code is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Set New Password
  async function handleResetPassword(e) {
    e.preventDefault();
    if (loading) return;

    setError("");

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
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password. Please try again.");
      }

      setStep("success");
    } catch (err) {
      setError(err.message || "Failed to update password. Please verify your OTP code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="forgot-page">
      <section className="forgot-card" aria-labelledby="forgot-title">
        <Link to="/" className="login-brand" aria-label="ETDOX home">
          <span className="login-brand-icon">
            <ShieldCheck size={27} aria-hidden="true" />
          </span>
          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        {/* STEP 1: ENTER EMAIL */}
        {step === "email" && (
          <>
            <header className="forgot-heading">
              <span className="forgot-eyebrow">RECOVER ACCESS</span>
              <h1 id="forgot-title">Reset your password</h1>
              <p>
                Enter the work email address linked to your ETDOX account and we will send you a 6-digit verification code.
              </p>
            </header>

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="forgot-form" noValidate>
              <div className="form-group">
                <label htmlFor="email">Work email address</label>
                <div className="input-wrapper">
                  <Mail size={19} aria-hidden="true" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your corporate email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    autoComplete="email"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="spin" aria-hidden="true" />
                    Sending verification code…
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <ArrowRight size={19} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <footer className="login-footer">
              <p>
                Remember your password?{" "}
                <Link to="/login" className="login-link-bold">
                  Sign in
                </Link>
              </p>
              <Link to="/">Back to home</Link>
            </footer>
          </>
        )}

        {/* STEP 2: ENTER & VERIFY 6-DIGIT OTP */}
        {step === "otp" && (
          <>
            <header className="forgot-heading">
              <span className="forgot-eyebrow">ENTER VERIFICATION CODE</span>
              <h1 id="forgot-title">Check your inbox</h1>
              <p>
                We sent a 6-digit verification code to <strong>{email}</strong>. Enter the code below to proceed to the password reset view.
              </p>
            </header>

            {successMessage && (
              <div className="login-notice" style={{ marginBottom: "16px" }}>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="forgot-form" noValidate>
              <div className="form-group">
                <label htmlFor="otp">6-Digit Verification Code (OTP)</label>
                <div className="input-wrapper">
                  <KeyRound size={19} aria-hidden="true" />
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      setError("");
                    }}
                    autoComplete="one-time-code"
                    required
                    disabled={loading}
                    autoFocus
                    style={{
                      fontSize: "22px",
                      letterSpacing: "8px",
                      textAlign: "center",
                      fontFamily: "monospace",
                      fontWeight: "700",
                    }}
                  />
                </div>
              </div>

              <div className="security-guidance-box">
                <p>
                  The verification code is single-use and will expire in <strong>30 minutes</strong>. If you do not see it in your inbox, please check your spam folder.
                </p>
              </div>

              <button type="submit" className="login-button" disabled={loading || otp.trim().length !== 6}>
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="spin" aria-hidden="true" />
                    Verifying code…
                  </>
                ) : (
                  <>
                    Verify Code & Continue
                    <ArrowRight size={19} aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="otp-actions-row">
                <button
                  type="button"
                  className="resend-btn"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                >
                  <RefreshCw size={14} className={loading ? "spin" : ""} />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>

                <button
                  type="button"
                  className="change-email-btn"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError("");
                    setSuccessMessage("");
                  }}
                  disabled={loading}
                >
                  Change email
                </button>
              </div>
            </form>

            <footer className="login-footer">
              <Link to="/login">Cancel and return to Sign in</Link>
            </footer>
          </>
        )}

        {/* STEP 3: SET NEW PASSWORD */}
        {step === "password" && (
          <>
            <header className="forgot-heading">
              <span className="forgot-eyebrow">CHOOSE NEW CREDENTIALS</span>
              <h1 id="forgot-title">Set new password</h1>
              <p>Create a strong password to protect your corporate procurement account.</p>
            </header>

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="forgot-form" noValidate>
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
                    disabled={loading}
                    autoFocus
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
                    disabled={loading}
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

              <button type="submit" className="login-button" disabled={loading || !isPasswordValid}>
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="spin" aria-hidden="true" />
                    Updating password…
                  </>
                ) : (
                  <>
                    Reset Password & Sign In
                    <ArrowRight size={19} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <footer className="login-footer">
              <Link to="/login">Cancel and return to Sign in</Link>
            </footer>
          </>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === "success" && (
          <div className="forgot-success-content">
            <div className="forgot-icon-badge">
              <CheckCircle2 size={38} />
            </div>
            <header className="forgot-heading text-center">
              <span className="forgot-eyebrow">SECURITY CONFIRMED</span>
              <h1 id="forgot-title">Password Reset Complete</h1>
              <p>
                Your ETDOX account password has been updated and previous sessions have been revoked. You can now sign in with your new credentials.
              </p>
            </header>

            <button
              type="button"
              className="login-button"
              onClick={() => {
                navigate("/login", {
                  state: {
                    message: "Password reset complete. Please sign in with your new password.",
                  },
                });
              }}
            >
              Sign In to ETDOX <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
