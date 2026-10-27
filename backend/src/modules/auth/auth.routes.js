
import { Router } from "express";
import {
  login,
  getMe,
  logout,
} from "./auth.controller.js";
import authenticate from "../../middleware/authenticate.js";

const router = Router();

// Public endpoint: log in using a demo account.
router.post("/login", login);

// Protected endpoint: retrieve the currently authenticated user.
router.get("/me", authenticate, getMe);

// Protected endpoint: log out.
router.post("/logout", authenticate, logout);

export default router;
