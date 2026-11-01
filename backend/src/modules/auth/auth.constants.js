export const AUTH_CONSTANTS = Object.freeze({
  TOKEN_TYPE: "Bearer",
  DEFAULT_TOKEN_EXPIRES_IN: "8h",
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MAX_EMAIL_LENGTH: 254,
});

export const AUTH_MESSAGES = Object.freeze({
  LOGIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logout successful",
  INVALID_CREDENTIALS: "Invalid email or password",
  ACCOUNT_DISABLED: "Your account is disabled. Contact your administrator.",
  UNAUTHORIZED: "Authentication is required",
  VALIDATION_ERROR: "Please check the submitted information",
  INTERNAL_ERROR: "An unexpected authentication error occurred",
});

export const AUTH_ROLES = Object.freeze({
  ADMIN: "admin",
  EMPLOYEE: "employee",
  MANAGER: "manager",
  FINANCE: "finance",
});

export const ALLOWED_AUTH_ROLES = Object.freeze(
  Object.values(AUTH_ROLES)
);