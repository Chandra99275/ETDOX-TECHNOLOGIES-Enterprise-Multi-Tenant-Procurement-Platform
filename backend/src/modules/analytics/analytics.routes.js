import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";

import {
  getDashboardAnalyticsController,
  getPurchaseRequestAnalyticsController,
  getInvoiceAnalyticsController,
  getBudgetAnalyticsController,
  getAnalyticsTrendsController,
} from "./analytics.controller.js";

import { analyticsSummarySchema } from "./analytics.schema.js";

const router = Router();

// Require authentication for all analytics endpoints.
router.use(authenticate);

// General analytics summary.
router.get(
  "/",
  requirePermission("analytics:read"),
  getDashboardAnalyticsController
);

// Validated analytics summary.
router.get(
  "/summary",
  requirePermission("analytics:read"),
  validate(analyticsSummarySchema, "query"),
  getDashboardAnalyticsController
);

// Full dashboard analytics.
router.get(
  "/dashboard",
  requirePermission("analytics:read"),
  getDashboardAnalyticsController
);

// Purchase request analytics.
router.get(
  "/purchase-requests",
  requirePermission("analytics:read"),
  getPurchaseRequestAnalyticsController
);

// Invoice analytics.
router.get(
  "/invoices",
  requirePermission("analytics:read"),
  getInvoiceAnalyticsController
);

// Budget analytics.
router.get(
  "/budgets",
  requirePermission("analytics:read"),
  getBudgetAnalyticsController
);

// Analytics trends.
router.get(
  "/trends",
  requirePermission("analytics:read"),
  getAnalyticsTrendsController
);

export default router;