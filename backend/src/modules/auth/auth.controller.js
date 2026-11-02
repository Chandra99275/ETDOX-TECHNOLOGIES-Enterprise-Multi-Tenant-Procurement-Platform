import {
  login as loginService,
  getCurrentUser,
} from "./auth.service.js";

import * as authService from "./auth.service.js";
import { AUTH_MESSAGES } from "./auth.constants.js";

// ------------------------------------------------------------
// Shared error handler
// ------------------------------------------------------------

function sendError(res, error) {
  const status = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : Number.isInteger(error?.status)
      ? error.status
      : 500;

  if (status >= 500) {
    console.error("[Auth Controller]", error);
  }

  return res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "An internal server error occurred."
        : error.message || "The request could not be completed.",
  });
}

// ------------------------------------------------------------
// POST /api/v1/auth/register
// ------------------------------------------------------------

export async function register(req, res) {
  try {
    const body = req.validatedBody ?? req.body ?? {};

    const result = await authService.register({
      firstName: body.firstName ?? body.first_name,
      lastName: body.lastName ?? body.last_name,
      email: body.email,
      password: body.password,
      confirmPassword:
        body.confirmPassword ?? body.confirm_password,
      organizationMode:
        body.organizationMode ??
        body.organization_mode ??
        "create",
      organizationName:
        body.organizationName ??
        body.organization_name,
      requestedRole:
        body.requestedRole ??
        body.requested_role ??
        "requester",
      termsAccepted:
        body.termsAccepted ?? body.terms_accepted,
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

// ------------------------------------------------------------
// POST /api/v1/auth/verify-email
// ------------------------------------------------------------

export async function verifyEmail(req, res) {
  try {
    const body = req.validatedBody ?? req.body ?? {};

    const result = await authService.verifyEmail({
      token: body.token,
      otp: body.otp,
      email: body.email,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

// ------------------------------------------------------------
// POST /api/v1/auth/resend-verification
// ------------------------------------------------------------

export async function resendVerification(req, res) {
  try {
    const body = req.validatedBody ?? req.body ?? {};

    const result = await authService.resendVerification({
      email: body.email,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

// ------------------------------------------------------------
// POST /api/v1/auth/login
// ------------------------------------------------------------

export async function login(req, res, next) {
  try {
    const { email, password } =
      req.validatedBody ?? req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const result = await loginService({
      email,
      password,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      success: true,
      message:
        AUTH_MESSAGES.LOGIN_SUCCESS || "Login successful.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

// ------------------------------------------------------------
// GET /api/v1/auth/me
// ------------------------------------------------------------

export async function me(req, res, next) {
  try {
    // These values must come from the verified JWT.
    const userId =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId;

    const tenantId =
      req.user?.tenantId ??
      req.user?.tenant_id;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message:
          AUTH_MESSAGES.UNAUTHORIZED ??
          "Authentication is required.",
      });
    }

    const user = await getCurrentUser(
      String(userId),
      String(tenantId)
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Authenticated user was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Authenticated user retrieved successfully.",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

// Compatibility alias for routes that import getMe.
export const getMe = me;

// ------------------------------------------------------------
// POST /api/v1/auth/logout
// ------------------------------------------------------------

export async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: AUTH_MESSAGES.LOGOUT_SUCCESS || "Logout successful.",
    data: null,
  });
}

// ------------------------------------------------------------
// POST /api/v1/auth/forgot-password
// ------------------------------------------------------------

export async function forgotPassword(req, res) {
  try {
    const { email } = req.validatedBody ?? req.body ?? {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const result = await authService.forgotPassword({ email });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

// ------------------------------------------------------------
// POST /api/v1/auth/verify-reset-otp
// ------------------------------------------------------------

export async function verifyResetOtp(req, res) {
  try {
    const { email, otp } =
      req.validatedBody ?? req.body ?? {};

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required.",
      });
    }

    const result = await authService.verifyResetOtp({
      email,
      otp,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

// ------------------------------------------------------------
// POST /api/v1/auth/reset-password
// ------------------------------------------------------------

export async function resetPassword(req, res) {
  try {
    const {
      token,
      email,
      otp,
      newPassword,
      confirmPassword,
    } = req.validatedBody ?? req.body ?? {};

    if (
      typeof newPassword !== "string" ||
      newPassword.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "New password is required.",
      });
    }

    if (
      typeof confirmPassword === "string" &&
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

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

// ------------------------------------------------------------
// POST /api/v1/auth/test-smtp
// ------------------------------------------------------------

export async function testSmtp(req, res) {
  try {
    const { targetEmail } = req.body ?? {};

    const result = await authService.testSmtpConnection(
      targetEmail
    );

    return res
      .status(result?.success === false ? 500 : 200)
      .json(result);
  } catch (error) {
    return sendError(res, error);
  }
}