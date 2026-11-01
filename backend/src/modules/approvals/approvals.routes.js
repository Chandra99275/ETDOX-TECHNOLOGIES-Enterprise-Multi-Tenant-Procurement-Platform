// backend/src/modules/approvals/approvals.routes.js

import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../middleware/authenticate.js";

import {
  listApprovals,
  getApproval,
  approveRequest,
  rejectRequest,
  getApprovalHistory,
} from "./approvals.controller.js";

const router = Router();

const uuidSchema = z.string().uuid();

function validateRequestId(req, res, next) {
  const result = uuidSchema.safeParse(req.params.id);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid procurement request ID. A valid UUID is required.",
    });
  }

  return next();
}

function validateListQuery(req, res, next) {
  const schema = z.object({
    status: z.string().trim().min(1).max(50).optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  const result = schema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid approval list filters.",
      errors: result.error.issues,
    });
  }

  req.validatedQuery = result.data;
  return next();
}

function validateDecisionBody(req, res, next) {
  const schema = z.object({
    comments: z.string().trim().max(2000).optional().default(""),
  });

  const result = schema.safeParse(req.body ?? {});

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid approval decision data.",
      errors: result.error.issues,
    });
  }

  req.body = result.data;
  return next();
}

// All approval endpoints require an authenticated user.
router.use(authenticate);

// GET /api/v1/approvals
router.get("/", validateListQuery, listApprovals);

// GET /api/v1/approvals/:id/history
router.get("/:id/history", validateRequestId, getApprovalHistory);

// POST /api/v1/approvals/:id/approve
router.post(
  "/:id/approve",
  validateRequestId,
  validateDecisionBody,
  approveRequest,
);

// POST /api/v1/approvals/:id/reject
router.post(
  "/:id/reject",
  validateRequestId,
  validateDecisionBody,
  rejectRequest,
);

// GET /api/v1/approvals/:id
router.get("/:id", validateRequestId, getApproval);

export default router;