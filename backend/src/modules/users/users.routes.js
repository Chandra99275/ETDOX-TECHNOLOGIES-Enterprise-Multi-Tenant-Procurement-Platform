import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";

import {
  validateListUsers,
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
} from "./users.validation.js";

import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
} from "./users.controller.js";

const router = Router();

function allowRoles(...allowedRoles) {
  return function roleAuthorization(req, res, next) {
    const role = String(req.user?.role ?? "").toLowerCase();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this operation",
      });
    }

    next();
  };
}

const adminOnly = allowRoles("admin");
const adminOrManager = allowRoles("admin", "manager");

router.use(authenticate);

// List users belonging to the authenticated tenant.
router.get(
  "/",
  adminOrManager,
  validateListUsers,
  listUsers
);

// Create a user in the authenticated tenant.
router.post(
  "/",
  adminOnly,
  validateCreateUser,
  createUser
);

// View one user belonging to the authenticated tenant.
router.get(
  "/:id",
  adminOrManager,
  validateUserId,
  getUser
);

// Update an existing user.
router.patch(
  "/:id",
  adminOnly,
  validateUserId,
  validateUpdateUser,
  updateUser
);

// Deactivate an account without physically deleting its record.
router.patch(
  "/:id/deactivate",
  adminOnly,
  validateUserId,
  deactivateUser
);

export default router;