<<<<<<< HEAD
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { summary } from './analytics.controller.js';
import { analyticsSummarySchema } from './analytics.schema.js';

export const router = Router();
=======
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import {
  getDashboardAnalyticsController,
  getPurchaseRequestAnalyticsController,
  getInvoiceAnalyticsController,
  getBudgetAnalyticsController,
  getAnalyticsTrendsController,
} from "./analytics.controller.js";

const router = Router();
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

// Every analytics endpoint requires an authenticated user.
router.use(authenticate);

<<<<<<< HEAD
router.get(
  '/',
  requirePermission('analytics:read'),
  summary
);

router.get(
  '/summary',
  requirePermission('analytics:read'),
  validate(analyticsSummarySchema, 'query'),
  summary
);

export default router;
=======
// Full dashboard analytics
router.get("/", getDashboardAnalyticsController);
router.get("/dashboard", getDashboardAnalyticsController);

// Individual dashboard sections
router.get("/purchase-requests", getPurchaseRequestAnalyticsController);
router.get("/invoices", getInvoiceAnalyticsController);
router.get("/budgets", getBudgetAnalyticsController);
router.get("/trends", getAnalyticsTrendsController);

export default router;
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
