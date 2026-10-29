import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./VerifyEmail.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const emailFromUrl = searchParams.get("email") || "";

  const [codeOrToken, setCodeOrToken] = useState(tokenFromUrl);
  const [emailInput, setEmailInput] = useState(emailFromUrl);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // "idle" | "verifying" | "success" | "pending_approval" | "error"
  const [message, setMessage] = useState("");

  const [resendEmail, setResendEmail] = useState(emailFromUrl);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  async function performVerification({ code, email }) {
    const cleanCode = (code || "").trim();
    if (!cleanCode) {
      setStatus("error");
      setMessage("A 6-digit OTP code or verification token is required.");
      return;
    }

    setLoading(true);
    setStatus("verifying");
    setMessage("");

    try {
      const payload = {
        token: cleanCode,
        otp: /^\d{6}$/.test(cleanCode) ? cleanCode : undefined,
        email: email ? email.trim().toLowerCase() : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Email verification failed or token has expired.");
      }

      if (data.status === "PENDING_APPROVAL") {
        setStatus("pending_approval");
        setMessage(
          data.message ||
            "Your email has been verified. Your requested role is pending administrator review and approval."
        );
      } else {
        setStatus("success");
        setMessage(data.message || "Your email has been verified successfully. You can now sign in.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "The verification code is invalid, expired, or has already been used.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tokenFromUrl) {
      performVerification({ code: tokenFromUrl, email: emailFromUrl });
    }
  }, [tokenFromUrl, emailFromUrl]);

  async function handleResend(e) {
    e.preventDefault();
    if (!resendEmail.trim() || resending) return;

    setResending(true);
    setResendStatus("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendStatus("A new verification code has been dispatched to your email.");
      } else {
        setResendStatus(data.message || "Failed to resend. Please try again shortly.");
      }
    } catch {
      setResendStatus("Network error. Please verify the backend service is running.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="verify-page">
      <section className="verify-card" aria-labelledby="verify-title">
        <Link to="/" className="login-brand" aria-label="ETDOX home">
          <span className="login-brand-icon">
            <ShieldCheck size={27} aria-hidden="true" />
          </span>
          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        {status === "verifying" && (
          <div className="status-container verifying">
            <LoaderCircle size={48} className="spin status-icon-spin" />
            <h1 id="verify-title">Verifying your email</h1>
            <p>Please wait while we validate your security OTP with ETDOX…</p>
          </div>
        )}

        {status === "success" && (
          <div className="status-container success">
            <div className="status-badge success-badge">
              <CheckCircle2 size={44} />
            </div>
            <h1 id="verify-title">Email Verified!</h1>
            <p>{message}</p>
            <div className="status-actions">
              <Link to="/login" className="login-button">
                Sign in to Dashboard <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}

        {status === "pending_approval" && (
          <div className="status-container pending">
            <div className="status-badge pending-badge">
              <Clock size={44} />
            </div>
            <h1 id="verify-title">Email Verified — Awaiting Approval</h1>
            <p>{message}</p>
            <div className="status-actions">
              <Link to="/login" className="login-button secondary-btn">
                Return to Sign in <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="status-container error">
            <div className="status-badge error-badge">
              <AlertCircle size={44} />
            </div>
            <h1 id="verify-title">Verification Failed</h1>
            <p>{message}</p>

            <div className="resend-box">
              <h3>Need a new verification OTP?</h3>
              <p>Enter your work email address below to receive another 6-digit code:</p>
              <form onSubmit={handleResend} className="resend-inline-form">
                <div className="input-wrapper">
                  <Mail size={18} />
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    disabled={resending}
                  />
                </div>
                <button type="submit" className="login-button resend-submit" disabled={resending}>
                  {resending ? <LoaderCircle size={16} className="spin" /> : "Resend OTP Code"}
                </button>
              </form>
              {resendStatus && <div className="resend-feedback">{resendStatus}</div>}
            </div>

            <div className="status-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => setStatus("idle")}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                Try entering OTP again
              </button>
              <span style={{ margin: "0 8px", color: "#cbd5e1" }}>|</span>
              <Link to="/login" className="text-link">
                Back to Sign in
              </Link>
            </div>
          </div>
        )}

        {status === "idle" && (
          <div className="status-container idle">
            <div className="status-badge neutral-badge">
              <KeyRound size={44} />
            </div>
            <h1 id="verify-title">Enter Verification Code</h1>
            <p>Enter the 6-digit OTP code sent to your registered email:</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                performVerification({ code: codeOrToken, email: emailInput });
              }}
              className="manual-token-form"
            >
              <div className="input-wrapper">
                <Mail size={18} />
                <input
                  type="email"
                  placeholder="Registered work email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
              </div>

              <div className="input-wrapper">
                <KeyRound size={18} />
                <input
                  type="text"
                  placeholder="6-Digit OTP Code (e.g. 849201)"
                  value={codeOrToken}
                  onChange={(e) => setCodeOrToken(e.target.value)}
                  required
                  style={{ fontWeight: "700", letterSpacing: "3px", textAlign: "center" }}
                />
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? <LoaderCircle size={18} className="spin" /> : "Verify & Activate Account"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="resend-box" style={{ marginTop: "20px" }}>
              <h3>Didn't get the OTP code?</h3>
              <form onSubmit={handleResend} className="resend-inline-form">
                <button
                  type="button"
                  className="resend-otp-btn"
                  onClick={handleResend}
                  disabled={resending || (!emailInput && !resendEmail)}
                >
                  {resending ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
                  Resend Verification OTP Code
                </button>
              </form>
              {resendStatus && <div className="resend-feedback">{resendStatus}</div>}
            </div>

            <div className="status-actions">
              <Link to="/login" className="text-link">
                Back to Sign in
              </Link>
            </div>
          </div>
        )}

        <footer className="login-footer">
          <p>ETDOX Enterprise Security</p>
          <Link to="/">Back to home</Link>
        </footer>
      </section>
    </main>
  );
}
