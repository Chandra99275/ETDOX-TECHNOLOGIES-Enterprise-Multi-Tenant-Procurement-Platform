import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import "./ForgotPassword.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
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

      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please check your connection.");
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

        {submitted ? (
          <div className="forgot-success-content">
            <div className="forgot-icon-badge">
              <CheckCircle2 size={38} />
            </div>
            <header className="forgot-heading text-center">
              <span className="forgot-eyebrow">INSTRUCTIONS DISPATCHED</span>
              <h1 id="forgot-title">Check your inbox</h1>
              <p>
                If an account exists for <strong>{email}</strong>, a secure password reset link has been sent.
              </p>
            </header>

            <div className="security-guidance-box">
              <p>
                The reset link is single-use and will expire in <strong>30 minutes</strong>. If you don't receive an email, please check your spam folder or verify your company email address.
              </p>
            </div>

            <Link to="/login" className="login-button">
              Return to Sign in <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <header className="forgot-heading">
              <span className="forgot-eyebrow">RECOVER ACCESS</span>
              <h1 id="forgot-title">Reset your password</h1>
              <p>
                Enter the work email address linked to your ETDOX account and we'll send you a password recovery link.
              </p>
            </header>

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="forgot-form" noValidate>
              <div className="form-group">
                <label htmlFor="email">Work email address</label>
                <div className="input-wrapper">
                  <Mail size={19} aria-hidden="true" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your company email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="spin" aria-hidden="true" />
                    Sending reset link…
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight size={19} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <footer className="login-footer">
              <p>Remember your password? <Link to="/login" className="login-link-bold">Sign in</Link></p>
              <Link to="/">Back to home</Link>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
