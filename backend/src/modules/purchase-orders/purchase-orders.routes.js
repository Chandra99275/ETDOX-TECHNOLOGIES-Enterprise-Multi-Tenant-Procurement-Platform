
import { Router } from "express";

import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";

import {
  acknowledge,
  approve,
  create,
  get,
  issue,
  list,
} from "./purchase-orders.controller.js";

import {
  createPurchaseOrderSchema,
  emptyBodySchema,
  listPurchaseOrdersSchema,
  purchaseOrderIdSchema,
} from "./purchase-orders.schema.js";

const router = Router();

/**
 * All purchase-order endpoints require authentication.
 */
router.use(authenticate);

/**
 * GET /api/v1/purchase-orders
 * List purchase orders.
 */
router.get(
  "/",
  requirePermission("purchase_orders:read"),
  validate(listPurchaseOrdersSchema, "query"),
  list
);

/**
 * POST /api/v1/purchase-orders
 * Create a purchase order.
 */
router.post(
  "/",
  requirePermission("purchase_orders:manage"),
  validate(createPurchaseOrderSchema),
  create
);

/**
 * GET /api/v1/purchase-orders/:id
 * Retrieve a purchase order.
 */
router.get(
  "/:id",
  requirePermission("purchase_orders:read"),
  validate(purchaseOrderIdSchema, "params"),
  get
);

/**
 * POST /api/v1/purchase-orders/:id/approve
 * Approve a purchase order.
 */
router.post(
  "/:id/approve",
  requirePermission("purchase_orders:approve"),
  validate(purchaseOrderIdSchema, "params"),
  validate(emptyBodySchema),
  approve
);

/**
 * POST /api/v1/purchase-orders/:id/issue
 * Issue a purchase order.
 */
router.post(
  "/:id/issue",
  requirePermission("purchase_orders:issue"),
  validate(purchaseOrderIdSchema, "params"),
  validate(emptyBodySchema),
  issue
);

/**
 * POST /api/v1/purchase-orders/:id/acknowledge
 * Acknowledge a purchase order.
 */
router.post(
  "/:id/acknowledge",
  requirePermission("purchase_orders:acknowledge"),
  validate(purchaseOrderIdSchema, "params"),
  validate(emptyBodySchema),
  acknowledge
);

export default router;