// backend/src/modules/invoices/invoices.routes.js

import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";

import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
} from "./invoices.controller.js";

import {
  validateInvoiceId,
  validateListInvoices,
  validateCreateInvoice,
  validateUpdateInvoice,
} from "./invoices.validation.js";

const router = Router();

// All invoice endpoints require authentication.
router.use(authenticate);

// GET /api/v1/invoices
router.get(
  "/",
  validateListInvoices,
  listInvoices,
);

// POST /api/v1/invoices
router.post(
  "/",
  validateCreateInvoice,
  createInvoice,
);

// GET /api/v1/invoices/:id
router.get(
  "/:id",
  validateInvoiceId,
  getInvoice,
);

// PATCH /api/v1/invoices/:id
router.patch(
  "/:id",
  validateInvoiceId,
  validateUpdateInvoice,
  updateInvoice,
);

export default router;