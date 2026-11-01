
import {
  login as loginService,
  getCurrentUser,
} from "./auth.service.js";

import { AUTH_MESSAGES } from "./auth.constants.js";

/**
 * POST /api/v1/auth/login
 *
 * Authenticates a user and returns a JWT.
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.validatedBody ?? req.body;

    const result = await loginService({
      email,
      password,
    });

    return res.status(200).json({
      success: true,
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/auth/me
 *
 * Requires a valid bearer token.
 * The authentication middleware must populate req.user
 * with the verified JWT claims.
 */
export async function me(req, res, next) {
  try {
    // Support common JWT middleware claim formats.
    const userId =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId;

    const tenantId =
      req.user?.tenantId ??
      req.user?.tenant_id;

    // Both values are required for tenant-scoped access.
    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.UNAUTHORIZED,
      });
    }

    // Fetch the user within the verified tenant context.
    const user = await getCurrentUser(userId, tenantId);

    return res.status(200).json({
      success: true,
      message: "Authenticated user retrieved successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    return next(error);
  }
}

<<<<<<< HEAD
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    const result = await authService.forgotPassword({ email });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function verifyResetOtp(req, res) {
  try {
    const { email, otp } = req.body || {};
    const result = await authService.verifyResetOtp({ email, otp });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, email, otp, newPassword, confirmPassword } = req.body || {};
    const result = await authService.resetPassword({
      token,
      email,
      otp,
      newPassword,
      confirmPassword,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function testSmtp(req, res) {
  try {
    const { targetEmail } = req.body || {};
    const result = await authService.testSmtpConnection(targetEmail);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    return sendError(res, error);
  }
=======
/**
 * POST /api/v1/auth/logout
 *
 * Authentication uses stateless JWTs. The client should discard
 * its token after logout. This endpoint does not revoke an
 * already-issued token.
 */
export async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.LOGOUT_SUCCESS,
    data: null,
  });
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
}
