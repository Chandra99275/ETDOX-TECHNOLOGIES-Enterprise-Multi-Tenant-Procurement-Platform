
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

/**
 * All analytics routes require authentication.
 * Tenant isolation remains enforced by the analytics service/repository.
 */
router.use(authenticate);

/**
 * Analytics permission middleware.
 * Admin and finance roles are allowed through the existing RBAC system
 * when they have analytics:read permission.
 */
const analyticsRead = requirePermission("analytics:read");

// General analytics summary.
router.get(
  "/",
  analyticsRead,
  getDashboardAnalyticsController,
);

// Validated analytics summary.
router.get(
  "/summary",
  analyticsRead,
  validate(analyticsSummarySchema, "query"),
  getDashboardAnalyticsController,
);

// Full dashboard analytics.
router.get(
  "/dashboard",
  analyticsRead,
  getDashboardAnalyticsController,
);

// Purchase request analytics.
router.get(
  "/purchase-requests",
  analyticsRead,
  getPurchaseRequestAnalyticsController,
);

// Invoice analytics.
router.get(
  "/invoices",
  analyticsRead,
  getInvoiceAnalyticsController,
);

// Budget analytics.
router.get(
  "/budgets",
  analyticsRead,
  getBudgetAnalyticsController,
);

// Analytics trends.
router.get(
  "/trends",
  analyticsRead,
  getAnalyticsTrendsController,
);

export default router;
