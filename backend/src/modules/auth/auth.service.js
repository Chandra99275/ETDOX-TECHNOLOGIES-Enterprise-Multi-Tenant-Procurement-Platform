import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import * as authRepo from "./auth.repository.js";
import * as emailService from "../email/email.service.js";

// Rate-limiting cache for sensitive operations like resend verification & forgot password
const rateLimitCache = new Map();

function checkRateLimit(key, windowSeconds = 60) {
  const now = Date.now();
  const lastTime = rateLimitCache.get(key);
  if (lastTime && now - lastTime < windowSeconds * 1000) {
    const remaining = Math.ceil((windowSeconds * 1000 - (now - lastTime)) / 1000);
    return remaining;
  }
  rateLimitCache.set(key, now);
  return 0;
}

function hashToken(rawToken) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateSecureToken() {
  return randomBytes(32).toString("hex");
}

function createAuthError(message, statusCode = 400, code = "AUTH_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export const VALID_ROLES = [
  "requester",
  "department_manager",
  "procurement_specialist",
  "procurement_manager",
  "finance_manager",
  "organization_admin",
  "auditor",
  "supplier_user",
];

export const ROLE_DASHBOARDS = Object.freeze({
  admin: "/admin/dashboard",
  organization_admin: "/admin/dashboard",
  employee: "/employee/dashboard",
  requester: "/employee/dashboard",
  manager: "/manager/dashboard",
  department_manager: "/manager/dashboard",
  procurement_specialist: "/admin/dashboard",
  procurement_manager: "/manager/dashboard",
  finance: "/finance/dashboard",
  finance_manager: "/finance/dashboard",
  auditor: "/admin/dashboard",
  supplier_user: "/employee/dashboard",
});

export function resolvePrimaryRole(roles = []) {
  const normalized = roles.map((r) => String(r).toLowerCase().trim());
  if (normalized.includes("organization_admin") || normalized.includes("admin")) return "organization_admin";
  if (normalized.includes("finance_manager") || normalized.includes("finance")) return "finance_manager";
  if (normalized.includes("procurement_manager")) return "procurement_manager";
  if (normalized.includes("department_manager") || normalized.includes("manager")) return "department_manager";
  if (normalized.includes("procurement_specialist")) return "procurement_specialist";
  if (normalized.includes("auditor")) return "auditor";
  if (normalized.includes("supplier_user")) return "supplier_user";
  return "requester";
}

export function resolveDashboardRoute(roles = []) {
  const primaryRole = resolvePrimaryRole(roles);
  return ROLE_DASHBOARDS[primaryRole] || "/employee/dashboard";
}

function validatePasswordPolicy(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
}

// ----------------------------------------------------------------------
// 1. REGISTRATION
// ----------------------------------------------------------------------

export async function register({
  firstName,
  lastName,
  email,
  password,
  confirmPassword,
  organizationMode = "create",
  organizationName,
  requestedRole = "requester",
  termsAccepted,
}) {
  const fields = [];

  const normalizedEmail = (email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
    fields.push({ field: "email", message: "A valid email address is required." });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    fields.push({ field: "password", message: "Password must be at least 8 characters long." });
  }

  if (organizationMode === "create" && (!organizationName || !organizationName.trim())) {
    fields.push({ field: "organizationName", message: "Organization name is required." });
  }

  if (fields.length > 0) {
    const validationError = createAuthError("Validation failed.", 400, "VALIDATION_ERROR");
    validationError.fields = fields;
    throw validationError;
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw createAuthError("Passwords do not match.", 400, "PASSWORD_MISMATCH");
  }

  const passwordError = validatePasswordPolicy(password);
  if (passwordError) {
    throw createAuthError(passwordError, 400, "WEAK_PASSWORD");
  }

  // Security Rule: Platform Admin can never be publicly registered
  const cleanRequestedRole = String(requestedRole).toLowerCase().trim();
  if (cleanRequestedRole === "platform_admin" || cleanRequestedRole === "superadmin") {
    throw createAuthError("Platform administrator cannot be requested through public registration.", 403, "FORBIDDEN_ROLE");
  }

  // Check duplicate email
  const existingUser = await authRepo.findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw createAuthError("An account with this email address already exists.", 409, "EMAIL_EXISTS");
  }

  let tenantId;
  let tenantName;
  let status = "PENDING_VERIFICATION";
  let assignedRoles = [];

  if (organizationMode === "create") {
    // Atomic First-Owner Flow
    const orgName = (organizationName || `${firstName}'s Organization`).trim();
    const newTenant = await authRepo.createTenant({ name: orgName });
    tenantId = newTenant.id;
    tenantName = newTenant.name;
    // The creator is the first-owner (organization_admin), active only after email verification
    assignedRoles = ["organization_admin", "admin"];
  } else {
    // Join existing organization
    const defaultTenant = await authRepo.findDefaultTenant();
    tenantId = defaultTenant?.id || env.demoTenantId;
    tenantName = defaultTenant?.name || "ETDOX Enterprise";

    // Secure Role Assignment Rules:
    // Only 'requester' is automatically assigned upon email verification.
    // Privileged roles require admin authorization (user enters PENDING_APPROVAL after verification).
    if (cleanRequestedRole === "requester" || cleanRequestedRole === "employee") {
      assignedRoles = ["requester", "employee"];
    } else {
      // Privileged role: not assigned until admin approves
      assignedRoles = [];
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await authRepo.createUser({
    email: normalizedEmail,
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    tenantId,
    status,
    requestedRole: cleanRequestedRole,
    assignedRoles,
  });

  // Generate Email Verification Token & 6-Digit OTP Code
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + env.emailVerificationTtlMinutes * 60 * 1000);

  await authRepo.createEmailVerificationToken({
    userId: newUser.id,
    tokenHash,
    otp,
    expiresAt,
  });

  // Send verification email with OTP via SMTP
  await emailService.sendVerificationEmail({
    to: normalizedEmail,
    name: `${firstName} ${lastName}`.trim(),
    token: rawToken,
    otp,
    expiresAt,
  });

  const requiresAdminApproval = organizationMode === "join" && cleanRequestedRole !== "requester" && cleanRequestedRole !== "employee";

  return {
    success: true,
    message: `Verification email with your 6-digit code has been sent to ${normalizedEmail}.`,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.fullName,
      organizationName: tenantName,
      status: newUser.status,
      requestedRole: cleanRequestedRole,
      requiresAdminApproval,
    },
  };
}

// ----------------------------------------------------------------------
// 2. EMAIL VERIFICATION (Supports 6-digit OTP code or link token)
// ----------------------------------------------------------------------

export async function verifyEmail({ token, otp, email }) {
  const codeToVerify = String(otp || token || "").trim();

  if (!codeToVerify) {
    throw createAuthError("Verification code or link is required.", 400, "MISSING_TOKEN");
  }

  let tokenRecord = null;

  // If 6-digit numerical OTP code was provided
  if (/^\d{6}$/.test(codeToVerify)) {
    if (email) {
      tokenRecord = await authRepo.findAndConsumeVerificationByOtp(email.trim().toLowerCase(), codeToVerify);
    }
    if (!tokenRecord) {
      tokenRecord = await authRepo.findAndConsumeVerificationToken(codeToVerify);
    }
  }

  // Fallback to token hash comparison
  if (!tokenRecord) {
    const tokenHash = hashToken(codeToVerify);
    tokenRecord = await authRepo.findAndConsumeVerificationToken(tokenHash);
  }

  if (!tokenRecord) {
    throw createAuthError("Verification code is invalid, expired, or has already been used.", 400, "INVALID_TOKEN");
  }

  const user = await authRepo.findUserById(tokenRecord.userId);
  if (!user) {
    throw createAuthError("Associated user account was not found.", 404, "USER_NOT_FOUND");
  }

  // Determine post-verification status
  const requestedRole = user.requestedRole || "requester";
  const isPrivilegedJoin =
    !user.roles.includes("organization_admin") &&
    requestedRole !== "requester" &&
    requestedRole !== "employee";

  let newStatus = "ACTIVE";
  if (isPrivilegedJoin) {
    newStatus = "PENDING_APPROVAL";
  }

  await authRepo.updateUserStatus(user.id, newStatus, true);

  return {
    success: true,
    status: newStatus,
    message:
      newStatus === "ACTIVE"
        ? "Your email has been verified successfully. You can now sign in to your ETDOX account."
        : "Your email has been verified. Your requested role is pending administrator approval before activation.",
    emailVerified: true,
  };
}

// ----------------------------------------------------------------------
// 3. RESEND VERIFICATION
// ----------------------------------------------------------------------

export async function resendVerification({ email }) {
  if (!email || typeof email !== "string") {
    throw createAuthError("Email address is required.", 400, "VALIDATION_ERROR");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const remaining = checkRateLimit(`resend:${normalizedEmail}`, 60);
  if (remaining > 0) {
    throw createAuthError(`Please wait ${remaining} seconds before requesting another verification email.`, 429, "RATE_LIMITED");
  }

  const user = await authRepo.findUserByEmail(normalizedEmail);
  if (user && user.status === "PENDING_VERIFICATION") {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + env.emailVerificationTtlMinutes * 60 * 1000);

    await authRepo.createEmailVerificationToken({
      userId: user.id,
      tokenHash,
      otp,
      expiresAt,
    });

    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.fullName,
      token: rawToken,
      otp,
      expiresAt,
    });
  }

  return {
    success: true,
    message: "If an unverified account exists for this email, a new 6-digit verification code has been sent.",
  };
}

// ----------------------------------------------------------------------
// 4. LOGIN
// ----------------------------------------------------------------------

export async function login({ email, password, ipAddress, userAgent }) {
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    throw createAuthError("Email and password are required.", 400, "VALIDATION_ERROR");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await authRepo.findUserByEmail(normalizedEmail);

  if (!user) {
    throw createAuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw createAuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  // Enforce account states
  if (user.status === "PENDING_VERIFICATION") {
    throw createAuthError(
      "Please verify your email address before signing in. Check your inbox for the verification link.",
      403,
      "EMAIL_NOT_VERIFIED"
    );
  }

  if (user.status === "PENDING_APPROVAL") {
    throw createAuthError(
      "Your account registration is awaiting administrator approval. You will receive an email once approved.",
      403,
      "ACCOUNT_PENDING_APPROVAL"
    );
  }

  if (user.status === "SUSPENDED") {
    throw createAuthError("Your account has been suspended. Please contact your administrator.", 403, "ACCOUNT_SUSPENDED");
  }

  if (user.status === "DISABLED" || !user.isActive) {
    throw createAuthError("This account has been deactivated.", 403, "ACCOUNT_DISABLED");
  }

  const primaryRole = resolvePrimaryRole(user.roles);
  const redirectTo = resolveDashboardRoute(user.roles);
  const permissions = await authRepo.getUserPermissions(user.tenantId, user.roles);

  // Generate JWT access token
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    tenant_id: user.tenantId,
    tenantId: user.tenantId,
    role: primaryRole,
    roles: user.roles,
    permissions,
    iss: env.jwtIssuer,
    aud: env.jwtAudience,
  };

  const accessToken = jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn || "8h",
  });

  // Track session
  const tokenHash = hashToken(accessToken);
  const expiresAt = new Date(Date.now() + 8 * 3600 * 1000);
  await authRepo.createSession({
    userId: user.id,
    tenantId: user.tenantId,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: "Login successful.",
    accessToken,
    token: accessToken,
    tokenType: "Bearer",
    expiresIn: env.jwtExpiresIn,
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName,
      tenantId: user.tenantId,
      organizationName: user.organizationName,
      role: primaryRole,
      roles: user.roles,
      status: user.status,
    },
    redirectTo,
  };
}

// ----------------------------------------------------------------------
// 5. GET CURRENT USER (Session Restoration)
// ----------------------------------------------------------------------

export async function getCurrentUser(userId, tenantId) {
  const user = await authRepo.findUserById(userId);

  if (!user || user.status === "DISABLED" || user.status === "SUSPENDED") {
    throw createAuthError("User session is invalid or account is inactive.", 401, "UNAUTHORIZED");
  }

  const primaryRole = resolvePrimaryRole(user.roles);
  const permissions = await authRepo.getUserPermissions(user.tenantId, user.roles);

  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    tenantId: user.tenantId,
    organizationName: user.organizationName,
    role: primaryRole,
    roleName: primaryRole,
    roles: user.roles,
    status: user.status,
    permissions,
  };
}

// ----------------------------------------------------------------------
// 6. FORGOT PASSWORD (OTP-First Flow)
// ----------------------------------------------------------------------

export async function forgotPassword({ email }) {
  if (!email || typeof email !== "string") {
    throw createAuthError("Please provide an email address.", 400, "VALIDATION_ERROR");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const remaining = checkRateLimit(`forgot:${normalizedEmail}`, 15);
  if (remaining > 0) {
    throw createAuthError(`Please wait ${remaining} seconds before requesting another verification code.`, 429, "RATE_LIMITED");
  }

  const user = await authRepo.findUserByEmail(normalizedEmail);

  if (user && user.isActive) {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000);

    await authRepo.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      otp,
      expiresAt,
    });

    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.fullName,
      token: rawToken,
      otp,
      expiresAt,
    });
  }

  // Return success response to the user
  return {
    success: true,
    message: "If an account with that email address exists, a 6-digit verification code has been dispatched to your email.",
  };
}

// ----------------------------------------------------------------------
// 6b. VERIFY RESET OTP
// ----------------------------------------------------------------------

export async function verifyResetOtp({ email, otp }) {
  if (!email || !otp) {
    throw createAuthError("Email address and 6-digit verification code are required.", 400, "VALIDATION_ERROR");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  const user = await authRepo.findUserByEmail(normalizedEmail);
  if (!user || !user.isActive) {
    throw createAuthError("Invalid or expired verification code.", 400, "INVALID_OTP");
  }

  const activeReset = await authRepo.findActivePasswordResetByOtp(normalizedEmail, cleanOtp);
  if (!activeReset) {
    throw createAuthError("Invalid or expired verification code.", 400, "INVALID_OTP");
  }

  return {
    success: true,
    message: "Verification code confirmed successfully. Please set your new password.",
    verified: true,
    email: normalizedEmail,
  };
}

// ----------------------------------------------------------------------
// 7. RESET PASSWORD (Supports both OTP & Direct Token)
// ----------------------------------------------------------------------

export async function resetPassword({ token, email, otp, newPassword, confirmPassword }) {
  const hasOtp = Boolean(email && otp);
  const hasToken = Boolean(token && typeof token === "string" && token.trim());

  if (!hasOtp && !hasToken) {
    throw createAuthError("Password reset verification code or token is required.", 400, "MISSING_TOKEN");
  }

  if (!newPassword || !confirmPassword) {
    throw createAuthError("New password and confirmation are required.", 400, "VALIDATION_ERROR");
  }

  if (newPassword !== confirmPassword) {
    throw createAuthError("Passwords do not match.", 400, "PASSWORD_MISMATCH");
  }

  const passwordError = validatePasswordPolicy(newPassword);
  if (passwordError) {
    throw createAuthError(passwordError, 400, "WEAK_PASSWORD");
  }

  let resetRecord = null;
  if (hasOtp) {
    resetRecord = await authRepo.findAndConsumePasswordResetByOtp(email.trim().toLowerCase(), String(otp).trim());
  } else if (hasToken) {
    const tokenHash = hashToken(token.trim());
    resetRecord = await authRepo.findAndConsumePasswordResetToken(tokenHash);
  }

  if (!resetRecord) {
    throw createAuthError("Verification code or reset link is invalid, expired, or has already been used.", 400, "INVALID_TOKEN");
  }

  const user = await authRepo.findUserById(resetRecord.userId);
  if (!user) {
    throw createAuthError("User account not found.", 404, "USER_NOT_FOUND");
  }

  // Hash new password and update
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await authRepo.updateUserPassword(user.id, newPasswordHash);

  // Invalidate all existing sessions
  await authRepo.revokeUserSessions(user.id);

  // Send security confirmation email
  await emailService.sendPasswordChangedEmail({
    to: user.email,
    name: user.fullName,
  });

  return {
    success: true,
    message: "Your password has been reset successfully. Please sign in with your new password.",
  };
}

// ----------------------------------------------------------------------
// 8. LOGOUT
// ----------------------------------------------------------------------

export async function logout(userId) {
  if (userId) {
    await authRepo.revokeUserSessions(userId);
  }
  return {
    success: true,
    message: "Logged out successfully.",
  };
}

// ----------------------------------------------------------------------
// 9. SMTP DIAGNOSTIC TEST
// ----------------------------------------------------------------------

export async function testSmtpConnection(targetEmail) {
  const emailToTest = targetEmail || env.smtp.user || "etdox3300@gmail.com";
  return emailService.testSmtp(emailToTest);
}
