// backend/src/modules/receipts/receipts.routes.js

import { Router } from "express";

import {
  listReceiptsController,
  getReceiptController,
  createReceiptController,
  updateReceiptController,
  deleteReceiptController,
} from "./receipts.controller.js";

import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// All receipt endpoints require authentication.
router.use(authenticate);

// GET /api/v1/receipts
router.get("/", listReceiptsController);

// GET /api/v1/receipts/:id
router.get("/:id", getReceiptController);

// POST /api/v1/receipts
router.post("/", createReceiptController);

// PATCH /api/v1/receipts/:id
router.patch("/:id", updateReceiptController);

// DELETE /api/v1/receipts/:id
router.delete("/:id", deleteReceiptController);

export default router;