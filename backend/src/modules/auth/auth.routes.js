import { Router } from "express";
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  testSmtp,
} from "./auth.controller.js";
import authenticate from "../../middleware/authenticate.js";

const router = Router();

// Public Authentication Flow
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Protected Identity & Session
router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);

// Diagnostic SMTP endpoint (Development / Admin)
router.post("/test-smtp", testSmtp);

export default router;
