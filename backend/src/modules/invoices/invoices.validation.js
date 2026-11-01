// backend/src/modules/invoices/invoices.validation.js

import { z } from "zod";

const invoiceStatuses = [
  "draft",
  "pending",
  "submitted",
  "approved",
  "rejected",
  "unpaid",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

const currencySchema = z.string().trim().length(3).transform((value) =>
  value.toUpperCase(),
);

const dateSchema = z.string().date();

export const invoiceIdSchema = z.string().uuid();

export const listInvoicesSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(invoiceStatuses).optional(),
  supplierName: z.string().trim().max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(100),
  supplierName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  amount: z.coerce.number().positive().finite(),
  currency: currencySchema.default("INR"),
  issueDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  purchaseRequestId: z.string().uuid().optional(),
  budgetId: z.string().uuid().optional(),
  status: z.enum(invoiceStatuses).default("unpaid"),
  paymentReference: z.string().trim().max(200).optional(),
}).superRefine((data, context) => {
  if (
    data.issueDate &&
    data.dueDate &&
    data.dueDate < data.issueDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Due date cannot be earlier than the issue date.",
    });
  }
});

export const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(100).optional(),
  supplierName: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  amount: z.coerce.number().positive().finite().optional(),
  currency: currencySchema.optional(),
  issueDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  purchaseRequestId: z.string().uuid().nullable().optional(),
  budgetId: z.string().uuid().nullable().optional(),
  status: z.enum(invoiceStatuses).optional(),
  paymentReference: z.string().trim().max(200).optional(),
}).strict().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: "Provide at least one field to update." },
);

function sendValidationError(res, message, issues) {
  return res.status(400).json({
    success: false,
    message,
    errors: issues,
  });
}

export function validateInvoiceId(req, res, next) {
  const result = invoiceIdSchema.safeParse(req.params.id);

  if (!result.success) {
    return sendValidationError(
      res,
      "Invalid invoice ID. A valid UUID is required.",
      result.error.issues,
    );
  }

  next();
}

export function validateListInvoices(req, res, next) {
  const result = listInvoicesSchema.safeParse(req.query);

  if (!result.success) {
    return sendValidationError(
      res,
      "Invalid invoice filters.",
      result.error.issues,
    );
  }

  req.validatedQuery = result.data;
  next();
}

export function validateCreateInvoice(req, res, next) {
  const result = createInvoiceSchema.safeParse(req.body);

  if (!result.success) {
    return sendValidationError(
      res,
      "Invalid invoice data.",
      result.error.issues,
    );
  }

  req.validatedBody = result.data;
  next();
}

export function validateUpdateInvoice(req, res, next) {
  const result = updateInvoiceSchema.safeParse(req.body);

  if (!result.success) {
    return sendValidationError(
      res,
      "Invalid invoice update.",
      result.error.issues,
    );
  }

  req.validatedBody = result.data;
  next();
}