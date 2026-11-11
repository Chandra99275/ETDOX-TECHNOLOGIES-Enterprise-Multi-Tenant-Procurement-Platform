
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
  recoverSubmittedRequest,
  financeDecision,
  managerDecision,
} from "./procurement.controller.js";

import {
  listBudgets,
} from "../budgets/budgets.controller.js";

const router = Router();

// ==================================================
// AUTHENTICATION
// All procurement routes require authentication.
// ==================================================

router.use(authenticate);

// ==================================================
// BUDGETS
// GET /api/v1/procurement/budgets
// Register before /:id routes.
// ==================================================

router.get(
  "/budgets",
  listBudgets
);

// ==================================================
// LIST PROCUREMENT REQUESTS
// GET /api/v1/procurement/requests
// GET /api/v1/procurement
// ==================================================

router.get(
  "/requests",
  validateListProcurement,
  listRequests
);

router.get(
  "/",
  validateListProcurement,
  listRequests
);

// ==================================================
// MANAGER APPROVAL / REJECTION
// PATCH /api/v1/procurement/requests/:id/manager-decision
// ==================================================

router.patch(
  "/requests/:id/manager-decision",
  validateProcurementId,
  managerDecision
);

// ==================================================
// FINANCE APPROVAL / REJECTION
// PATCH /api/v1/procurement/requests/:id/finance-decision
// ==================================================

router.patch(
  "/requests/:id/finance-decision",
  validateProcurementId,
  financeDecision
);

// ==================================================
// RECOVER SUBMITTED REQUEST
// POST /api/v1/procurement/requests/:id/recover
//
// Starts the approval workflow for a SUBMITTED request
// that does not have a workflow_run_id.
//
// The service enforces admin authorization.
// ==================================================

router.post(
  "/requests/:id/recover",
  validateProcurementId,
  recoverSubmittedRequest
);

// ==================================================
// CREATE PROCUREMENT REQUEST
// POST /api/v1/procurement
// ==================================================

router.post(
  "/",
  validateCreateProcurement,
  createRequest
);

// ==================================================
// SUBMIT PROCUREMENT REQUEST
// POST /api/v1/procurement/:id/submit
// ==================================================

router.post(
  "/:id/submit",
  validateProcurementId,
  submitRequest
);

// ==================================================
// GET SINGLE PROCUREMENT REQUEST
// GET /api/v1/procurement/:id
// ==================================================

router.get(
  "/:id",
  validateProcurementId,
  getRequest
);

// ==================================================
// UPDATE PROCUREMENT REQUEST
// PATCH /api/v1/procurement/:id
// ==================================================

router.patch(
  "/:id",
  validateProcurementId,
  validateUpdateProcurement,
  updateRequest
);

export default router;
