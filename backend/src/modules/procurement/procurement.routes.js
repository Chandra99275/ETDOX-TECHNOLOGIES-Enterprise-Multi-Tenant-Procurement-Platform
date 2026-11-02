
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";

import {
  validateProcurementId,
  validateListProcurement,
  validateCreateProcurement,
  validateUpdateProcurement,
} from "./procurement.validation.js";

import {
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  submitRequest,
  financeDecision,
  managerDecision,
} from "./procurement.controller.js";

const router = Router();

// Require authentication for all procurement routes.
router.use(authenticate);

// List procurement requests belonging to the authenticated tenant.
router.get(
  "/",
  validateListProcurement,
  listRequests
);

// Manager and Finance dashboard decision endpoints.
router.patch(
  "/requests/:id/manager-decision",
  managerDecision
);

router.patch(
  "/requests/:id/finance-decision",
  financeDecision
);

// Create a procurement request.
router.post(
  "/",
  validateCreateProcurement,
  createRequest
);

// Submit a request for approval.
router.post(
  "/:id/submit",
  validateProcurementId,
  submitRequest
);

// Retrieve a single procurement request.
router.get(
  "/:id",
  validateProcurementId,
  getRequest
);

// Update an editable procurement request.
router.patch(
  "/:id",
  validateProcurementId,
  validateUpdateProcurement,
  updateRequest
);

export default router;
