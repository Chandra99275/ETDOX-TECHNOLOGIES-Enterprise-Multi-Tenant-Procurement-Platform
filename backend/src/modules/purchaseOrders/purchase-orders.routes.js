// backend/src/modules/purchase-orders/purchase-orders.routes.js

import { Router } from "express";

import {
  listPurchaseOrdersController,
  getPurchaseOrderController,
  createPurchaseOrderController,
  updatePurchaseOrderController,
  deletePurchaseOrderController,
} from "./purchase-orders.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

// All purchase-order endpoints require authentication.
router.use(authenticate);

// GET /api/v1/purchase-orders
router.get("/", listPurchaseOrdersController);

// GET /api/v1/purchase-orders/:id
router.get("/:id", getPurchaseOrderController);

// POST /api/v1/purchase-orders
router.post("/", createPurchaseOrderController);

// PATCH /api/v1/purchase-orders/:id
router.patch("/:id", updatePurchaseOrderController);

// DELETE /api/v1/purchase-orders/:id
router.delete("/:id", deletePurchaseOrderController);

export default router;