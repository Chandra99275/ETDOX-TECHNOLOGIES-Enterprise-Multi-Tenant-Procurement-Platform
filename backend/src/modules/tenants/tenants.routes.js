import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../middleware/authenticate.js";

import {
  listTenants,
  getMyTenant,
  getTenant,
  createTenant,
  updateTenant,
} from "./tenants.controller.js";

const router = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),

  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),

    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),

    status: z.enum(["active", "inactive", "suspended"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

function validateTenantId(req, res, next) {
  if (!UUID_REGEX.test(req.params.id ?? "")) {
    return res.status(400).json({
      success: false,
      message: "Invalid tenant ID",
    });
  }

  next();
}

function validateList(req, res, next) {
  const result = listSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid tenant query parameters",
      errors: result.error.issues,
    });
  }

  req.validatedQuery = result.data;
  next();
}

function validateCreate(req, res, next) {
  const result = createSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid tenant details",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  next();
}

function validateUpdate(req, res, next) {
  const result = updateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid tenant update",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  next();
}

// Every endpoint requires a valid access token.
router.use(authenticate);

// Get the authenticated user's own tenant.
router.get("/me", getMyTenant);

// Platform-wide tenant listing.
// The service performs the platform-admin authorization check.
router.get("/", validateList, listTenants);

// Create a new tenant.
router.post("/", validateCreate, createTenant);

// Get one tenant by UUID.
// The service prevents unauthorized cross-tenant access.
router.get("/:id", validateTenantId, getTenant);

// Update tenant metadata.
router.patch(
  "/:id",
  validateTenantId,
  validateUpdate,
  updateTenant
);

export default router;