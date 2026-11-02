
import { Router } from "express";

import {
  authenticate,
} from "../../middleware/auth.js";

import {
  requirePermission,
} from "../../middleware/rbac.js";

import {
  validate,
} from "../../middleware/validate.js";

import {
  search,
} from "./audit.controller.js";

import {
  auditSearchSchema,
} from "./audit.schema.js";

export const router = Router();

// Require authentication for every audit endpoint.
router.use(authenticate);

// Search audit events.
router.get(
  "/",
  requirePermission("audit:read"),
  validate(auditSearchSchema, "query"),
  search
);

export default router;
