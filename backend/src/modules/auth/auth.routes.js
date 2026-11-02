import { Router } from "express";

import {
  register,
  verifyEmail,
  resendVerification,
  login,
  me,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  testSmtp,
} from "./auth.controller.js";

import { validateLogin } from "./auth.validation.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// --------------------------------------------------
// Public authentication routes
// --------------------------------------------------

// Register a new account and organization.
router.post("/register", register);

// Verify the user's email address.
router.post("/verify-email", verifyEmail);

// Resend email verification instructions.
router.post("/resend-verification", resendVerification);

// Authenticate an existing database user.
router.post("/login", validateLogin, login);

// Request password-reset instructions.
router.post("/forgot-password", forgotPassword);

// Verify the password-reset OTP.
router.post("/verify-reset-otp", verifyResetOtp);

// Set a new password after successful verification.
router.post("/reset-password", resetPassword);

// SMTP diagnostic endpoint.
// Protect this endpoint so it cannot be used publicly.
router.post("/test-smtp", authenticate, testSmtp);

// --------------------------------------------------
// Protected authentication routes
// --------------------------------------------------

// Return the authenticated user's information.
router.get("/me", authenticate, me);

// Notify the client that logout was successful.
router.post("/logout", authenticate, logout);

export default router;