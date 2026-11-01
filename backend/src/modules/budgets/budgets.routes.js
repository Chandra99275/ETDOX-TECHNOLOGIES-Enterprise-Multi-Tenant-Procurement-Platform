// backend/src/modules/budgets/budgets.routes.js

import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../middleware/authenticate.js";

import {
  listBudgets,
  getBudget,
  createBudget,
  updateBudget,
} from "./budgets.controller.js";

const router = Router();

const budgetStatuses = [
  "active",
  "inactive",
  "closed",
  "draft",
];

const budgetFields = {
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  allocatedAmount: z.coerce.number().positive().finite(),
  currency: z.string().trim().length(3).default("INR"),
  fiscalYear: z.union([
    z.string().trim().min(1).max(20),
    z.number().int(),
  ]).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(budgetStatuses).optional(),
};

const createBudgetSchema = z.object(budgetFields);

const updateBudgetSchema = z.object({
  name: budgetFields.name.optional(),
  description: budgetFields.description,
  department: budgetFields.department,
  category: budgetFields.category,
  allocatedAmount: budgetFields.allocatedAmount.optional(),
  currency: z.string().trim().length(3).optional(),
  fiscalYear: budgetFields.fiscalYear,
  startDate: budgetFields.startDate,
  endDate: budgetFields.endDate,
  status: budgetFields.status,
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: "Provide at least one field to update." },
);

const listBudgetsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  department: z.string().trim().max(100).optional(),
  fiscalYear: z.string().trim().max(20).optional(),
  status: z.enum(budgetStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function validateId(req, res, next) {
  const result = z.string().uuid().safeParse(req.params.id);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid budget ID. A valid UUID is required.",
    });
  }

  return next();
}

function validateQuery(req, res, next) {
  const result = listBudgetsSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid budget filters.",
      errors: result.error.issues,
    });
  }

  req.validatedQuery = result.data;
  return next();
}

function validateCreateBody(req, res, next) {
  const result = createBudgetSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid budget data.",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  return next();
}

function validateUpdateBody(req, res, next) {
  const result = updateBudgetSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid budget update data.",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  return next();
}

// Every budget endpoint requires authentication.
router.use(authenticate);

// GET /api/v1/budgets
router.get("/", validateQuery, listBudgets);

// POST /api/v1/budgets
router.post("/", validateCreateBody, createBudget);

// GET /api/v1/budgets/:id
router.get("/:id", validateId, getBudget);

// PATCH /api/v1/budgets/:id
router.patch("/:id", validateId, validateUpdateBody, updateBudget);

export default router;