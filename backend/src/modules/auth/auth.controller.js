import * as authService from "./auth.service.js";
import { env } from "../../config/env.js";

function sendError(res, error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? (error?.message || "An unexpected error occurred.") : error.message,
    error: {
      code: error.code || "AUTH_ERROR",
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  });
}

function setAuthCookie(res, token) {
  res.cookie("etdox_token", token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "strict" : "lax",
    path: "/",
    maxAge: 8 * 3600 * 1000, // 8 hours
  });
}

function clearAuthCookie(res) {
  res.clearCookie("etdox_token", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "strict" : "lax",
    path: "/",
  });
}

export async function register(req, res) {
  try {
    const result = await authService.register(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token, otp, email } = req.body || {};
    const result = await authService.verifyEmail({ token, otp, email });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function resendVerification(req, res) {
  try {
    const { email } = req.body || {};
    const result = await authService.resendVerification({ email });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const ipAddress = req.ip || req.headers["x-forwarded-for"];
    const userAgent = req.headers["user-agent"];

    const result = await authService.login({
      email,
      password,
      ipAddress,
      userAgent,
    });

    setAuthCookie(res, result.accessToken);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function logout(req, res) {
  try {
    const userId = req.user?.id || req.user?.sub;
    await authService.logout(userId);
    clearAuthCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMe(req, res) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const tenantId = req.user?.tenantId || req.user?.tenant_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "UNAUTHENTICATED",
      });
    }

    const user = await authService.getCurrentUser(userId, tenantId);

    return res.status(200).json({
      success: true,
      user,
      data: { user },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    const result = await authService.forgotPassword({ email });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword, confirmPassword } = req.body || {};
    const result = await authService.resetPassword({
      token,
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
}
