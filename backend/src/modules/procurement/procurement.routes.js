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
<<<<<<< HEAD
  financeDecision,
  managerDecision,
} from './procurement.controller.js';

import { authenticate } from '../../middleware/authenticate.js';
=======
} from "./procurement.controller.js";
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

const router = Router();

router.use(authenticate);

// List requests belonging to the authenticated tenant.
router.get(
  "/",
  validateListProcurement,
  listRequests
);

<<<<<<< HEAD
// Endpoints used by Manager and Finance dashboards
router.patch('/requests/:id/manager-decision', managerDecision);
router.patch('/requests/:id/finance-decision', financeDecision);
=======
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

// Retrieve one procurement request.
router.get(
  "/:id",
  validateProcurementId,
  getRequest
);

// Update an editable request.
router.patch(
  "/:id",
  validateProcurementId,
  validateUpdateProcurement,
  updateRequest
);
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

export default router;
