import { Link } from "react-router-dom";
import { Clock, ShieldCheck, ArrowRight } from "lucide-react";
import "./VerifyEmail.css";

export default function PendingApproval() {
  return (
    <main className="verify-page">
      <section className="verify-card" aria-labelledby="approval-title">
        <Link to="/" className="login-brand" aria-label="ETDOX home">
          <span className="login-brand-icon">
            <ShieldCheck size={27} aria-hidden="true" />
          </span>
          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        <div className="status-container pending">
          <div className="status-badge pending-badge">
            <Clock size={44} />
          </div>
          <h1 id="approval-title">Registration Pending Approval</h1>
          <p>
            Your email has been successfully verified! Because you requested a privileged management or compliance role, your organization administrator must authorize your access before activation.
          </p>
          <div className="resend-box" style={{ marginTop: "24px" }}>
            <h3>What happens next?</h3>
            <p style={{ margin: 0 }}>
              An organization administrator will review your requested role and assign appropriate workspace permissions. You will receive an automated email notification once approved.
            </p>
          </div>
          <div className="status-actions">
            <Link to="/login" className="login-button secondary-btn">
              Return to Sign in <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <footer className="login-footer">
          <p>ETDOX Enterprise Security</p>
          <Link to="/">Back to home</Link>
        </footer>
      </section>
    </main>
  );
}
