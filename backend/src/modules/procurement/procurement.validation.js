import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const procurementStatuses = [
  "draft",
  "pending",
  "submitted",
  "approved",
  "rejected",
  "cancelled",
];

export const procurementIdSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid procurement request ID"),
});

export const listProcurementSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  status: z.enum(procurementStatuses).optional(),
});

export const createProcurementSchema = z.object({
  title: z.string().trim().min(3).max(200),

  description: z.string().trim().max(5000).optional().default(""),

  amount: z.coerce.number().positive().finite(),

  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("INR"),

  category: z.string().trim().max(100).optional(),

  supplierName: z.string().trim().max(200).optional(),

  justification: z.string().trim().max(5000).optional(),
});

export const updateProcurementSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),

    description: z.string().trim().max(5000).optional(),

    amount: z.coerce.number().positive().finite().optional(),

    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .optional(),

    category: z.string().trim().max(100).optional(),

    supplierName: z.string().trim().max(200).optional(),

    justification: z.string().trim().max(5000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export function validateProcurementId(req, res, next) {
  const result = procurementIdSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid procurement request ID",
      errors: result.error.issues,
    });
  }

  next();
}

export function validateListProcurement(req, res, next) {
  const result = listProcurementSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid procurement query parameters",
      errors: result.error.issues,
    });
  }

  req.validatedQuery = result.data;
  next();
}

export function validateCreateProcurement(req, res, next) {
  const result = createProcurementSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid procurement request",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  next();
}

export function validateUpdateProcurement(req, res, next) {
  const result = updateProcurementSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid procurement update",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  next();
}