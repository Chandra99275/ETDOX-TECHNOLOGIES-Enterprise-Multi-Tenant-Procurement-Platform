
import { z } from "zod";

export const createPurchaseOrderSchema = z.object({
  purchaseRequestId: z.string().uuid(),
  supplierId: z.string().uuid(),
  paymentTerms: z.string().trim().max(500).optional(),
  shippingAddress: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const listPurchaseOrdersSchema = z.object({
  status: z.enum([
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "ISSUED",
    "ACKNOWLEDGED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
  ]).optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
}).strict().transform((query) => ({
  ...query,
  offset: query.offset ?? (query.page - 1) * query.limit,
}));

export const purchaseOrderIdSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const emptyBodySchema = z.object({}).strict();
