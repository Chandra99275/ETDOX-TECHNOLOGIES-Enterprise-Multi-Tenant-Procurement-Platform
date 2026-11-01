// backend/src/modules/suppliers/suppliers.routes.js

import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../middleware/authenticate.js";

import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
} from "./suppliers.controller.js";

const router = Router();

const supplierStatuses = [
  "active",
  "inactive",
  "pending",
  "suspended",
];

const optionalText = (maxLength) =>
  z.string().trim().max(maxLength).optional();

const supplierFields = {
  name: z.string().trim().min(2).max(200),
  code: optionalText(100),
  email: z.string().trim().email().max(254).optional(),
  phone: optionalText(30),
  contactPerson: optionalText(150),
  address: optionalText(500),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  postalCode: optionalText(20),
  taxId: optionalText(50),
  category: optionalText(100),
  paymentTerms: optionalText(200),
  notes: optionalText(2000),
  status: z.enum(supplierStatuses).optional(),
};

const createSupplierSchema = z.object(supplierFields).strict();

const updateSupplierSchema = z
  .object({
    ...supplierFields,
    name: supplierFields.name.optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.values(data).some((value) => value !== undefined),
    {
      message: "Provide at least one field to update.",
    },
  );

const listSuppliersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(supplierStatuses).optional(),
  category: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function validateSupplierId(req, res, next) {
  const result = z.string().uuid().safeParse(req.params.id);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid supplier ID. A valid UUID is required.",
      errors: result.error.issues,
    });
  }

  return next();
}

function validateListQuery(req, res, next) {
  const result = listSuppliersSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid supplier filters.",
      errors: result.error.issues,
    });
  }

  req.validatedQuery = result.data;
  return next();
}

function validateCreateBody(req, res, next) {
  const result = createSupplierSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid supplier data.",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  return next();
}

function validateUpdateBody(req, res, next) {
  const result = updateSupplierSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid supplier update.",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  return next();
}

// All supplier endpoints require authentication.
router.use(authenticate);

// GET /api/v1/suppliers
router.get("/", validateListQuery, listSuppliers);

// POST /api/v1/suppliers
router.post("/", validateCreateBody, createSupplier);

// GET /api/v1/suppliers/:id
router.get("/:id", validateSupplierId, getSupplier);

// PATCH /api/v1/suppliers/:id
router.patch(
  "/:id",
  validateSupplierId,
  validateUpdateBody,
  updateSupplier,
);

export default router;