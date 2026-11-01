import { Router } from "express";

import {
  login,
  me,
  logout,
<<<<<<< HEAD
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  testSmtp,
=======
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
} from "./auth.controller.js";

import { validateLogin } from "./auth.validation.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

<<<<<<< HEAD
// Public Authentication Flow
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
=======
/**
 * Public route:
 * Authenticate an existing database user.
 */
router.post("/login", validateLogin, login);
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

/**
 * Protected route:
 * Return the currently authenticated user's information.
 */
router.get("/me", authenticate, me);

/**
 * Protected route:
 * Notify the client that logout was successful.
 *
 * Since JWTs are stateless, the client must delete its token.
 */
router.post("/logout", authenticate, logout);

export default router;