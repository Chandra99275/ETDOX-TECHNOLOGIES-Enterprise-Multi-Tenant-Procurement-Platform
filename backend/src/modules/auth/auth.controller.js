
import * as authService from "./auth.service.js";

function getErrorStatus(error) {
  return Number.isInteger(error?.statusCode)
    ? error.statusCode
    : 500;
}

function sendError(res, error) {
  const statusCode = getErrorStatus(error);

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "An internal server error occurred."
        : error.message,
    error: error.code || "AUTHENTICATION_ERROR",
  });
}

/**
 * POST /api/v1/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
        error: "VALIDATION_ERROR",
      });
    }

    const result = await authService.login({
      email: email.trim(),
      password,
    });

    return res.status(200).json({
      success: true,
      message: result.message || "Login successful.",
      accessToken: result.accessToken,
      token: result.token || result.accessToken,
      tokenType: result.tokenType || "Bearer",
      expiresIn: result.expiresIn,
      user: result.user,
      redirectTo: result.redirectTo,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/auth/me
 */
export async function getMe(req, res) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const tenantId =
      req.user?.tenantId ||
      req.user?.tenant_id ||
      req.context?.tenantId ||
      req.context?.tenant_id;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: "The authenticated user or tenant is missing.",
        error: "INVALID_AUTH_CONTEXT",
      });
    }

    const user = await authService.getCurrentUser(userId, tenantId);

    return res.status(200).json({
      success: true,
      user,
      data: user,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/v1/auth/logout
 *
 * The frontend removes its stored token after this response.
 */
export async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
}
