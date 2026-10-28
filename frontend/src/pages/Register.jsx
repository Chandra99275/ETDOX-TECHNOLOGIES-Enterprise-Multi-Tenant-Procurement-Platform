import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import "./Register.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

const ROLES = [
  {
    id: "requester",
    title: "Requester",
    subtitle: "Standard Employee",
    description: "Create purchase requests and track deliveries. Instantly activated upon email OTP verification.",
    badge: "Instant Access",
    badgeClass: "badge-green",
  },
  {
    id: "organization_admin",
    title: "Organization Admin",
    subtitle: "Enterprise Owner",
    description: "Full control over organization setup, users, and policy. Assigned when creating a new organization.",
    badge: "Owner / Invite",
    badgeClass: "badge-blue",
  },
  {
    id: "department_manager",
    title: "Department Manager",
    subtitle: "Approver",
    description: "Review and approve department procurement requisitions. Requires administrator authorization.",
    badge: "Admin Approval",
    badgeClass: "badge-amber",
  },
  {
    id: "procurement_specialist",
    title: "Procurement Specialist",
    subtitle: "Sourcing & Quotes",
    description: "Manage RFQs, vendors, and PO issuance. Requires administrator authorization.",
    badge: "Admin Approval",
    badgeClass: "badge-amber",
  },
  {
    id: "procurement_manager",
    title: "Procurement Manager",
    subtitle: "Procurement Lead",
    description: "Oversee operational procurement and high-value approvals. Requires administrator authorization.",
    badge: "Admin Approval",
    badgeClass: "badge-amber",
  },
  {
    id: "finance_manager",
    title: "Finance Manager",
    subtitle: "Invoice & Audit",
    description: "Review 3-way matching and invoice disbursement approvals. Requires administrator authorization.",
    badge: "Admin Approval",
    badgeClass: "badge-amber",
  },
  {
    id: "auditor",
    title: "Auditor",
    subtitle: "Compliance",
    description: "Read-only access across procurement, audit trail, and compliance. Requires admin authorization.",
    badge: "Admin Approval",
    badgeClass: "badge-amber",
  },
  {
    id: "supplier_user",
    title: "Supplier User",
    subtitle: "Vendor Portal",
    description: "External vendor access for purchase orders and invoice submissions. Requires vendor approval.",
    badge: "Vendor Approval",
    badgeClass: "badge-purple",
  },
];

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    requestedRole: "requester",
    organizationMode: "create", // "create" | "join"
    organizationName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // OTP Verification state
  const [otpStep, setOtpStep] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  const passwordRequirements = [
    { label: "At least 8 characters", valid: formData.password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(formData.password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(formData.password) },
    { label: "One number", valid: /[0-9]/.test(formData.password) },
  ];

  const isPasswordValid = passwordRequirements.every((r) => r.valid);

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setFieldErrors({});

    const normalizedEmail = formData.email.trim().toLowerCase();
    const errors = {};

    if (!formData.firstName.trim()) errors.firstName = "First name is required.";
    if (!formData.lastName.trim()) errors.lastName = "Last name is required.";
    if (!normalizedEmail) errors.email = "Work email is required.";
    if (!formData.password) errors.password = "Password is required.";
    else if (!isPasswordValid) errors.password = "Password does not meet the security policy.";

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (formData.organizationMode === "create" && !formData.organizationName.trim()) {
      errors.organizationName = "Company or organization name is required.";
    }

    if (!formData.termsAccepted) {
      errors.termsAccepted = "You must agree to the Terms of Service.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fill in all required fields highlighted below.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: normalizedEmail,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          organizationMode: formData.organizationMode,
          organizationName: formData.organizationName.trim(),
          requestedRole: formData.requestedRole,
          termsAccepted: formData.termsAccepted,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data?.error?.fields && Array.isArray(data.error.fields)) {
          const remoteErrors = {};
          data.error.fields.forEach((f) => {
            remoteErrors[f.field] = f.message;
          });
          setFieldErrors(remoteErrors);
        }
        throw new Error(data?.message || "Registration failed. Please check your information.");
      }

      setRegisteredEmail(normalizedEmail);
      setOtpStep(true);
    } catch (err) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpLoading) return;

    setOtpError("");
    const cleanOtp = otpCode.trim();

    if (!cleanOtp) {
      setOtpError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setOtpLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          otp: cleanOtp,
          email: registeredEmail,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Invalid or expired verification code. Please try again.");
      }

      setOtpSuccess(true);
    } catch (err) {
      setOtpError(err.message || "Verification failed. Check the code and try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!registeredEmail || resending) return;
    setResending(true);
    setResendStatus("");
    setOtpError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendStatus("A new 6-digit OTP code has been delivered to your email.");
      } else {
        setResendStatus(data.message || "Failed to resend. Please try again in 1 minute.");
      }
    } catch {
      setResendStatus("Could not resend OTP. Please check your internet connection.");
    } finally {
      setResending(false);
    }
  }

  // OTP Verification View
  if (otpStep) {
    return (
      <main className="register-page">
        <section className="register-card otp-card" aria-labelledby="otp-title">
          <Link to="/" className="login-brand" aria-label="ETDOX home">
            <span className="login-brand-icon">
              <ShieldCheck size={27} aria-hidden="true" />
            </span>
            <span className="login-brand-text">
              <strong>ETDOX</strong>
              <small>Enterprise Platform</small>
            </span>
          </Link>

          {otpSuccess ? (
            <div className="otp-success-state">
              <div className="success-icon-badge">
                <CheckCircle2 size={44} />
              </div>
              <h1 id="otp-title">Account Verified!</h1>
              <p>Your email has been verified. You can now sign in to your ETDOX dashboard.</p>
              <Link to="/login" className="login-button" style={{ marginTop: "24px" }}>
                Sign in to Dashboard <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <>
              <header className="register-heading text-center">
                <span className="register-eyebrow">ENTER VERIFICATION CODE</span>
                <h1 id="otp-title">Check your inbox</h1>
                <p>
                  We have sent a <strong>6-digit OTP code</strong> to:
                  <br />
                  <span className="highlight-email">{registeredEmail}</span>
                </p>
              </header>

              {otpError && (
                <div className="login-error" role="alert" aria-live="polite">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>{otpError}</span>
                </div>
              )}

              {resendStatus && (
                <div className="resend-feedback" role="status">
                  {resendStatus}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="otp-form">
                <div className="form-group text-center">
                  <label htmlFor="otpCode">6-Digit Verification Code</label>
                  <div className="otp-input-container">
                    <input
                      id="otpCode"
                      name="otpCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setOtpCode(val);
                        setOtpError("");
                      }}
                      autoFocus
                      required
                      className="large-otp-input"
                    />
                  </div>
                  <small className="otp-hint">Enter the 6 digits from the subject or body of your email.</small>
                </div>

                <button
                  type="submit"
                  className="login-button"
                  disabled={otpLoading || otpCode.length < 6}
                >
                  {otpLoading ? (
                    <>
                      <LoaderCircle size={19} className="spin" /> Verifying OTP…
                    </>
                  ) : (
                    <>
                      Verify & Activate <ArrowRight size={19} />
                    </>
                  )}
                </button>
              </form>

              <div className="otp-resend-wrapper">
                <button
                  type="button"
                  className="resend-otp-btn"
                  onClick={handleResendOtp}
                  disabled={resending}
                >
                  {resending ? (
                    <>
                      <LoaderCircle size={15} className="spin" /> Resending code…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={15} /> Didn't receive OTP? Resend code
                    </>
                  )}
                </button>
              </div>

              <footer className="login-footer" style={{ marginTop: "24px" }}>
                <Link to="/login">Back to Sign in</Link>
              </footer>
            </>
          )}
        </section>
      </main>
    );
  }

  // Registration Form View
  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <Link to="/" className="login-brand" aria-label="ETDOX home">
          <span className="login-brand-icon">
            <ShieldCheck size={27} aria-hidden="true" />
          </span>
          <span className="login-brand-text">
            <strong>ETDOX</strong>
            <small>Enterprise Platform</small>
          </span>
        </Link>

        <header className="register-heading">
          <span className="register-eyebrow">STEP 1: SELECT YOUR ROLE</span>
          <h1 id="register-title">Create an Account</h1>
          <p>Choose your workspace role first, then enter your details below.</p>
        </header>

        {error && (
          <div className="login-error" role="alert" aria-live="polite">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* ======================================================== */}
          {/* 1. ROLE SELECTION (PLACED AT THE VERY TOP AS REQUESTED)  */}
          {/* ======================================================== */}
          <div className="role-selection-section">
            <div className="section-title-row">
              <span className="section-step-badge">1</span>
              <div>
                <label className="section-label">Select Workspace Role *</label>
                <small className="section-subtext">Permissions are granted according to organization governance rules.</small>
              </div>
            </div>

            <div className="roles-cards-grid">
              {ROLES.map((role) => {
                const isSelected = formData.requestedRole === role.id;
                return (
                  <button
                    type="button"
                    key={role.id}
                    className={`role-select-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleChange("requestedRole", role.id)}
                  >
                    <div className="role-card-header">
                      <strong className="role-card-title">{role.title}</strong>
                      <span className={`role-badge ${role.badgeClass}`}>{role.badge}</span>
                    </div>
                    <small className="role-card-sub">{role.subtitle}</small>
                    <p className="role-card-desc">{role.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. ORGANIZATION SETUP                                    */}
          {/* ======================================================== */}
          <div className="organization-section">
            <div className="section-title-row">
              <span className="section-step-badge">2</span>
              <div>
                <label className="section-label">Organization Mode *</label>
                <small className="section-subtext">Choose whether to create a new company workspace or join an existing one.</small>
              </div>
            </div>

            <div className="radio-options-grid">
              <label
                className={`radio-card ${formData.organizationMode === "create" ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name="organizationMode"
                  value="create"
                  checked={formData.organizationMode === "create"}
                  onChange={() => handleChange("organizationMode", "create")}
                />
                <Building2 size={20} className="radio-icon" />
                <div>
                  <strong>Create New Organization</strong>
                  <small>Register your company as the initial Organization Admin</small>
                </div>
              </label>

              <label
                className={`radio-card ${formData.organizationMode === "join" ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name="organizationMode"
                  value="join"
                  checked={formData.organizationMode === "join"}
                  onChange={() => handleChange("organizationMode", "join")}
                />
                <Users size={20} className="radio-icon" />
                <div>
                  <strong>Join Existing Organization</strong>
                  <small>Join your existing employer's workspace or supplier portal</small>
                </div>
              </label>
            </div>

            {formData.organizationMode === "create" && (
              <div className="form-group" style={{ marginTop: "14px" }}>
                <label htmlFor="organizationName">Company / Organization name *</label>
                <div className={`input-wrapper ${fieldErrors.organizationName ? "input-error" : ""}`}>
                  <Building2 size={18} aria-hidden="true" />
                  <input
                    id="organizationName"
                    name="organizationName"
                    type="text"
                    placeholder="e.g. Acme Procurement Global"
                    value={formData.organizationName}
                    onChange={(e) => handleChange("organizationName", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {fieldErrors.organizationName && (
                  <span className="field-error-text">{fieldErrors.organizationName}</span>
                )}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 3. USER DETAILS (NAME, EMAIL, PASSWORD AT THE BOTTOM)    */}
          {/* ======================================================== */}
          <div className="user-details-section">
            <div className="section-title-row">
              <span className="section-step-badge">3</span>
              <div>
                <label className="section-label">Your Personal & Login Details *</label>
                <small className="section-subtext">Enter your legal work credentials to complete registration.</small>
              </div>
            </div>

            {/* Name fields */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First name *</label>
                <div className={`input-wrapper ${fieldErrors.firstName ? "input-error" : ""}`}>
                  <User size={18} aria-hidden="true" />
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="e.g. Shadan"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {fieldErrors.firstName && <span className="field-error-text">{fieldErrors.firstName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last name *</label>
                <div className={`input-wrapper ${fieldErrors.lastName ? "input-error" : ""}`}>
                  <User size={18} aria-hidden="true" />
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="e.g. Akram"
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {fieldErrors.lastName && <span className="field-error-text">{fieldErrors.lastName}</span>}
              </div>
            </div>

            {/* Work Email */}
            <div className="form-group">
              <label htmlFor="email">Work email address *</label>
              <div className={`input-wrapper ${fieldErrors.email ? "input-error" : ""}`}>
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="yourname@company.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
              {fieldErrors.email && <span className="field-error-text">{fieldErrors.email}</span>}
            </div>

            {/* Passwords */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <div className={`input-wrapper ${fieldErrors.password ? "input-error" : ""}`}>
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && <span className="field-error-text">{fieldErrors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <div className={`input-wrapper ${fieldErrors.confirmPassword ? "input-error" : ""}`}>
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
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
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="field-error-text">{fieldErrors.confirmPassword}</span>
                )}
              </div>
            </div>

            {/* Password checklist */}
            {formData.password && (
              <div className="password-checklist">
                {passwordRequirements.map((req, idx) => (
                  <div key={idx} className={`req-item ${req.valid ? "met" : ""}`}>
                    <span className="req-dot" />
                    <span>{req.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Terms checkbox */}
          <div className="terms-checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={(e) => handleChange("termsAccepted", e.target.checked)}
                disabled={loading}
              />
              <span>
                I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.
              </span>
            </label>
            {fieldErrors.termsAccepted && (
              <span className="field-error-text">{fieldErrors.termsAccepted}</span>
            )}
          </div>

          {/* Submit */}
          <button type="submit" className="login-button register-submit" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle size={19} className="spin" aria-hidden="true" />
                Sending verification OTP…
              </>
            ) : (
              <>
                Create Account & Send OTP
                <ArrowRight size={19} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <footer className="login-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="login-link-bold">
              Sign in
            </Link>
          </p>
          <Link to="/">Back to home</Link>
        </footer>
      </section>
    </main>
  );
}
