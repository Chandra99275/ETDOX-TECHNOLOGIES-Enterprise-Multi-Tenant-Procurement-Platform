
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import { env } from "../../config/env.js";
import * as authRepo from "./auth.repository.js";
import * as emailService from "./email.service.js";

import {
  AUTH_CONSTANTS,
  AUTH_MESSAGES,
} from "./auth.constants.js";

// --------------------------------------------------
// Configuration and validation
// --------------------------------------------------

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rateLimits = new Map();

function createAuthError(message, statusCode = 400, code) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (code) error.code = code;

  return error;
}

function normalizeEmail(email) {
  return typeof email === "string"
    ? email.trim().toLowerCase()
    : "";
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function checkRateLimit(key, cooldownSeconds) {
  const now = Date.now();
  const previous = rateLimits.get(key);

  if (previous && now < previous) {
    return Math.ceil((previous - now) / 1000);
  }

  rateLimits.set(key, now + cooldownSeconds * 1000);
  return 0;
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

function getTokenExpiryDate() {
  // Keep session expiry consistent with the JWT configuration.
  const configured = env.jwtExpiresIn || "8h";

  if (typeof configured === "number") {
    return new Date(Date.now() + configured * 1000);
  }

  const match = String(configured).match(/^(\d+)\s*(s|m|h|d)$/i);

  if (!match) {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + amount * multipliers[unit]);
}

// --------------------------------------------------
// Role and dashboard mapping
// --------------------------------------------------

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
  const normalized = roles.map((role) =>
    String(role).toLowerCase().trim()
  );

  if (
    normalized.includes("organization_admin") ||
    normalized.includes("admin")
  ) {
    return "organization_admin";
  }

  if (
    normalized.includes("finance_manager") ||
    normalized.includes("finance")
  ) {
    return "finance_manager";
  }

  if (normalized.includes("procurement_manager")) {
    return "procurement_manager";
  }

  if (
    normalized.includes("department_manager") ||
    normalized.includes("manager")
  ) {
    return "department_manager";
  }

  if (normalized.includes("procurement_specialist")) {
    return "procurement_specialist";
  }

  if (normalized.includes("auditor")) {
    return "auditor";
  }

  if (normalized.includes("supplier_user")) {
    return "supplier_user";
  }

  if (normalized.includes("employee")) {
    return "employee";
  }

  return "requester";
}

export function resolveDashboardRoute(roles = []) {
  const role = resolvePrimaryRole(roles);
  return ROLE_DASHBOARDS[role] || "/employee/dashboard";
}

// --------------------------------------------------
// User record compatibility
// --------------------------------------------------

function getField(user, snakeCase, camelCase) {
  return user?.[snakeCase] ?? user?.[camelCase] ?? null;
}

function getUserId(user) {
  return user?.id ?? null;
}

function getTenantId(user) {
  return getField(user, "tenant_id", "tenantId");
}

function getPasswordHash(user) {
  return getField(user, "password_hash", "passwordHash");
}

function getUserEmail(user) {
  return user?.email ?? null;
}

function getUserStatus(user) {
  return user?.status ?? null;
}

function getIsActive(user) {
  return getField(user, "is_active", "isActive");
}

function getFullName(user) {
  const existingName =
    getField(user, "full_name", "fullName") ??
    user?.name;

  if (existingName) return existingName;

  const firstName =
    getField(user, "first_name", "firstName") ?? "";

  const lastName =
    getField(user, "last_name", "lastName") ?? "";

  return `${firstName} ${lastName}`.trim() || getUserEmail(user);
}

function getUserRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.map((role) =>
      String(typeof role === "string" ? role : role?.name ?? "")
        .toLowerCase()
        .trim()
    ).filter(Boolean);
  }

  const role =
    user?.direct_role ??
    user?.directRole ??
    user?.role;

  return role
    ? [String(role).toLowerCase().trim()]
    : [];
}

function validateIdentity(user) {
  const userId = getUserId(user);
  const tenantId = getTenantId(user);

  if (!userId || !UUID_REGEX.test(String(userId))) {
    throw createAuthError(
      "Authentication configuration error: invalid user ID.",
      500
    );
  }

  if (!tenantId || !UUID_REGEX.test(String(tenantId))) {
    throw createAuthError(
      "Authentication configuration error: invalid tenant ID.",
      500
    );
  }

  const roles = getUserRoles(user);

  if (!roles.length) {
    throw createAuthError(
      "Your account does not have an assigned role.",
      403
    );
  }

  return resolvePrimaryRole(roles);
}

function toPublicUser(user) {
  const roles = getUserRoles(user);
  const primaryRole = resolvePrimaryRole(roles);

  return {
    id: getUserId(user),
    email: getUserEmail(user),
    name: getFullName(user),
    firstName: getField(user, "first_name", "firstName"),
    lastName: getField(user, "last_name", "lastName"),
    tenantId: getTenantId(user),
    organizationName: getField(
      user,
      "organization_name",
      "organizationName"
    ),
    role: primaryRole,
    roleName: primaryRole,
    roles,
    status: getUserStatus(user),
  };
}

function ensureActiveUser(user) {
  const status = String(getUserStatus(user) ?? "").toUpperCase();
  const active = getIsActive(user);

  if (
    active === false ||
    active === 0 ||
    active === "false" ||
    ["DISABLED", "SUSPENDED", "INACTIVE"].includes(status)
  ) {
    throw createAuthError(
      AUTH_MESSAGES.ACCOUNT_DISABLED ??
        "This account has been deactivated.",
      403
    );
  }

  if (status === "PENDING_VERIFICATION") {
    throw createAuthError(
      "Please verify your email address before signing in.",
      403
    );
  }

  if (status === "PENDING_APPROVAL") {
    throw createAuthError(
      "Your account is awaiting administrator approval.",
      403
    );
  }
}

// --------------------------------------------------
// JWT generation
// --------------------------------------------------

function generateAccessToken(user, role, permissions = []) {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  const userId = getUserId(user);
  const tenantId = getTenantId(user);

  const payload = {
    sub: String(userId),
    email: getUserEmail(user),
    name: getFullName(user),
    tenantId: String(tenantId),
    tenant_id: String(tenantId),
    role,
    roles: getUserRoles(user),
    permissions,
  };

  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn:
      env.jwtExpiresIn ||
      AUTH_CONSTANTS.DEFAULT_TOKEN_EXPIRES_IN ||
      "8h",
    issuer: env.jwtIssuer || "etdox-api",
    audience: env.jwtAudience || "etdox-frontend",
  });
}

// --------------------------------------------------
// 1. Registration
// --------------------------------------------------

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
  const normalizedEmail = normalizeEmail(email);

  if (!firstName?.trim() || !lastName?.trim()) {
    throw createAuthError(
      "First name and last name are required.",
      400
    );
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createAuthError("A valid email address is required.", 400);
  }

  if (termsAccepted !== true) {
    throw createAuthError(
      "You must accept the terms and conditions.",
      400
    );
  }

  if (password !== confirmPassword) {
    throw createAuthError("Passwords do not match.", 400);
  }

  const passwordError = validatePasswordPolicy(password);

  if (passwordError) {
    throw createAuthError(passwordError, 400);
  }

  if (!["create", "join"].includes(organizationMode)) {
    throw createAuthError(
      "Invalid organization registration mode.",
      400
    );
  }

  if (organizationMode === "create" && !organizationName?.trim()) {
    throw createAuthError(
      "Organization name is required.",
      400
    );
  }

  const normalizedRole = String(requestedRole)
    .toLowerCase()
    .trim();

  if (["platform_admin", "superadmin"].includes(normalizedRole)) {
    throw createAuthError(
      "Platform administrator cannot be registered publicly.",
      403
    );
  }

  const existingUser = await authRepo.findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw createAuthError(
      "An account with this email address already exists.",
      409
    );
  }

  let tenantId;
  let tenantName;
  let assignedRoles;

  if (organizationMode === "create") {
    const tenant = await authRepo.createTenant({
      name: organizationName.trim(),
    });

    tenantId = tenant.id;
    tenantName = tenant.name;
    assignedRoles = ["organization_admin", "admin"];
  } else {
    const tenant = await authRepo.findDefaultTenant();

    if (!tenant?.id) {
      throw createAuthError(
        "No organization is available to join.",
        400
      );
    }

    tenantId = tenant.id;
    tenantName = tenant.name;

    assignedRoles = ["requester", "employee"].includes(normalizedRole)
      ? ["requester", "employee"]
      : [];
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await authRepo.createUser({
    email: normalizedEmail,
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    tenantId,
    status: "PENDING_VERIFICATION",
    requestedRole: normalizedRole,
    assignedRoles,
  });

  const rawToken = generateSecureToken();
  const otp = generateOtp();

  const expiresAt = new Date(
    Date.now() +
      Number(env.emailVerificationTtlMinutes || 30) * 60 * 1000
  );

  await authRepo.createEmailVerificationToken({
    userId: user.id,
    tenantId,
    tokenHash: hashToken(rawToken),
    otp,
    expiresAt,
  });

  await emailService.sendVerificationEmail({
    to: normalizedEmail,
    name: `${firstName.trim()} ${lastName.trim()}`,
    token: rawToken,
    otp,
    expiresAt,
  });

  return {
    success: true,
    message: "Verification email sent successfully.",
    user: {
      id: user.id,
      email: user.email,
      organizationName: tenantName,
      status: "PENDING_VERIFICATION",
      requestedRole: normalizedRole,
      requiresAdminApproval:
        organizationMode === "join" &&
        !["requester", "employee"].includes(normalizedRole),
    },
  };
}

// --------------------------------------------------
// 2. Email verification
// --------------------------------------------------

export async function verifyEmail({ token, otp, email }) {
  const value = String(otp || token || "").trim();

  if (!value) {
    throw createAuthError(
      "Verification code or token is required.",
      400
    );
  }

  let record = null;

  if (/^\d{6}$/.test(value) && email) {
    record = await authRepo.findAndConsumeVerificationByOtp(
      normalizeEmail(email),
      value
    );
  }

  if (!record) {
    record = await authRepo.findAndConsumeVerificationToken(
      hashToken(value)
    );
  }

  if (!record) {
    throw createAuthError(
      "Verification code is invalid, expired, or already used.",
      400
    );
  }

  if (!record.tenantId) {
    throw createAuthError(
      "Verification record is missing tenant information.",
      500
    );
  }

  const user = await authRepo.findUserById(
    record.userId,
    record.tenantId
  );

  if (!user) {
    throw createAuthError("User account not found.", 404);
  }

  const requestedRole = String(
    getField(user, "requested_role", "requestedRole") ?? "requester"
  ).toLowerCase();

  const roles = getUserRoles(user);

  const isPrivilegedJoin =
    !roles.includes("organization_admin") &&
    !["requester", "employee"].includes(requestedRole);

  const status = isPrivilegedJoin
    ? "PENDING_APPROVAL"
    : "ACTIVE";

  await authRepo.updateUserStatus(
    user.id,
    record.tenantId,
    status,
    true
  );

  return {
    success: true,
    status,
    emailVerified: true,
    message:
      status === "ACTIVE"
        ? "Email verified successfully. You can now sign in."
        : "Email verified. Your account is awaiting administrator approval.",
  };
}

// --------------------------------------------------
// 3. Resend verification
// --------------------------------------------------

export async function resendVerification({ email }) {
  const normalizedEmail = normalizeEmail(email);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createAuthError("A valid email address is required.", 400);
  }

  const remaining = checkRateLimit(
    `resend:${normalizedEmail}`,
    60
  );

  if (remaining > 0) {
    throw createAuthError(
      `Please wait ${remaining} seconds before trying again.`,
      429
    );
  }

  const user = await authRepo.findUserByEmail(normalizedEmail);

  if (user && getUserStatus(user) === "PENDING_VERIFICATION") {
    const token = generateSecureToken();
    const otp = generateOtp();
    const tenantId = getTenantId(user);

    const expiresAt = new Date(
      Date.now() +
        Number(env.emailVerificationTtlMinutes || 30) * 60 * 1000
    );

    await authRepo.createEmailVerificationToken({
      userId: getUserId(user),
      tenantId,
      tokenHash: hashToken(token),
      otp,
      expiresAt,
    });

    await emailService.sendVerificationEmail({
      to: normalizedEmail,
      name: getFullName(user),
      token,
      otp,
      expiresAt,
    });
  }

  return {
    success: true,
    message:
      "If an unverified account exists, a new verification code has been sent.",
  };
}

// --------------------------------------------------
// 4. Login
// --------------------------------------------------

export async function login({
  email,
  password,
  ipAddress,
  userAgent,
}) {
  const normalizedEmail = normalizeEmail(email);

  if (
    !EMAIL_REGEX.test(normalizedEmail) ||
    typeof password !== "string" ||
    !password
  ) {
    throw createAuthError(
      AUTH_MESSAGES.INVALID_CREDENTIALS ||
        "Invalid email or password.",
      401
    );
  }

  const user = await authRepo.findUserByEmail(normalizedEmail);

  if (!user) {
    throw createAuthError(
      AUTH_MESSAGES.INVALID_CREDENTIALS ||
        "Invalid email or password.",
      401
    );
  }

  const passwordHash = getPasswordHash(user);

  if (typeof passwordHash !== "string" || !passwordHash) {
    throw createAuthError(
      "The account has no configured password credential.",
      500
    );
  }

  const matches = await bcrypt.compare(password, passwordHash);

  if (!matches) {
    throw createAuthError(
      AUTH_MESSAGES.INVALID_CREDENTIALS ||
        "Invalid email or password.",
      401
    );
  }

  ensureActiveUser(user);

  const role = validateIdentity(user);
  const tenantId = getTenantId(user);

  const permissions = await authRepo.getUserPermissions(
    tenantId,
    getUserRoles(user)
  );

  const accessToken = generateAccessToken(
    user,
    role,
    permissions
  );

  await authRepo.createSession({
    userId: getUserId(user),
    tenantId,
    tokenHash: hashToken(accessToken),
    expiresAt: getTokenExpiryDate(),
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    message: AUTH_MESSAGES.LOGIN_SUCCESS || "Login successful.",
    accessToken,
    token: accessToken,
    tokenType: "Bearer",
    expiresIn: env.jwtExpiresIn || "8h",
    user: toPublicUser(user),
    redirectTo: resolveDashboardRoute(getUserRoles(user)),
  };
}

// --------------------------------------------------
// 5. Current authenticated user
// --------------------------------------------------

export async function getCurrentUser(userId, tenantId) {
  if (
    typeof userId !== "string" ||
    !UUID_REGEX.test(userId) ||
    typeof tenantId !== "string" ||
    !UUID_REGEX.test(tenantId)
  ) {
    throw createAuthError("Invalid authentication token.", 401);
  }

  const user = await authRepo.findUserById(userId, tenantId);

  if (!user) {
    throw createAuthError(
      "User account was not found or is disabled.",
      401
    );
  }

  if (
    String(getUserId(user)).toLowerCase() !== userId.toLowerCase() ||
    String(getTenantId(user)).toLowerCase() !== tenantId.toLowerCase()
  ) {
    throw createAuthError(
      "Authenticated user does not belong to this tenant.",
      403
    );
  }

  ensureActiveUser(user);
  validateIdentity(user);

  return toPublicUser(user);
}

// --------------------------------------------------
// 6. Forgot password
// --------------------------------------------------

export async function forgotPassword({ email }) {
  const normalizedEmail = normalizeEmail(email);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createAuthError("A valid email address is required.", 400);
  }

  const remaining = checkRateLimit(
    `forgot:${normalizedEmail}`,
    60
  );

  if (remaining > 0) {
    throw createAuthError(
      `Please wait ${remaining} seconds before requesting another code.`,
      429
    );
  }

  const user = await authRepo.findUserByEmail(normalizedEmail);

  if (user && getIsActive(user) !== false) {
    const token = generateSecureToken();
    const otp = generateOtp();
    const tenantId = getTenantId(user);

    const expiresAt = new Date(
      Date.now() +
        Number(env.passwordResetTtlMinutes || 15) * 60 * 1000
    );

    await authRepo.createPasswordResetToken({
      userId: getUserId(user),
      tenantId,
      tokenHash: hashToken(token),
      otp,
      expiresAt,
    });

    await emailService.sendPasswordResetEmail({
      to: normalizedEmail,
      name: getFullName(user),
      token,
      otp,
      expiresAt,
    });
  }

  return {
    success: true,
    message:
      "If an account exists for this email, password-reset instructions have been sent.",
  };
}

// --------------------------------------------------
// 7. Verify password-reset OTP
// --------------------------------------------------

export async function verifyResetOtp({ email, otp }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanOtp = String(otp ?? "").trim();

  if (
    !EMAIL_REGEX.test(normalizedEmail) ||
    !/^\d{6}$/.test(cleanOtp)
  ) {
    throw createAuthError(
      "A valid email address and six-digit code are required.",
      400
    );
  }

  const record = await authRepo.findActivePasswordResetByOtp(
    normalizedEmail,
    cleanOtp
  );

  if (!record) {
    throw createAuthError(
      "Invalid or expired verification code.",
      400
    );
  }

  return {
    success: true,
    verified: true,
    email: normalizedEmail,
    message: "Verification code confirmed.",
  };
}

// --------------------------------------------------
// 8. Reset password
// --------------------------------------------------

export async function resetPassword({
  token,
  email,
  otp,
  newPassword,
  confirmPassword,
}) {
  const hasOtp = Boolean(email && otp);

  const hasToken =
    typeof token === "string" && token.trim().length > 0;

  if (!hasOtp && !hasToken) {
    throw createAuthError(
      "A password-reset verification code or token is required.",
      400
    );
  }

  if (
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    throw createAuthError(
      "New password and confirmation are required.",
      400
    );
  }

  if (newPassword !== confirmPassword) {
    throw createAuthError("Passwords do not match.", 400);
  }

  const passwordError = validatePasswordPolicy(newPassword);

  if (passwordError) {
    throw createAuthError(passwordError, 400);
  }

  let record;

  if (hasOtp) {
    record = await authRepo.findAndConsumePasswordResetByOtp(
      normalizeEmail(email),
      String(otp).trim()
    );
  } else {
    record = await authRepo.findAndConsumePasswordResetToken(
      hashToken(token.trim())
    );
  }

  if (!record) {
    throw createAuthError(
      "The reset code or token is invalid, expired, or already used.",
      400
    );
  }

  if (!record.tenantId) {
    throw createAuthError(
      "Password reset record is missing tenant information.",
      500
    );
  }

  const user = await authRepo.findUserById(
    record.userId,
    record.tenantId
  );

  if (!user) {
    throw createAuthError("User account not found.", 404);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await authRepo.updateUserPassword(
    getUserId(user),
    record.tenantId,
    passwordHash
  );

  await authRepo.revokeUserSessions(
    getUserId(user),
    record.tenantId
  );

  return {
    success: true,
    message: "Your password has been reset successfully.",
  };
}

// --------------------------------------------------
// 9. SMTP connectivity test
// --------------------------------------------------

export async function testSmtpConnection(targetEmail) {
  if (typeof emailService.testSmtpConnection !== "function") {
    throw createAuthError(
      "SMTP testing is not implemented in the email service.",
      501
    );
  }

  return emailService.testSmtpConnection(targetEmail);
}
