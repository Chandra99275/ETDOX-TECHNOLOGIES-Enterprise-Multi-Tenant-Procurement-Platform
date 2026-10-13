import { z } from 'zod';

const decimal = z.string().regex(/^\d{1,11}(\.\d{1,4})?$/, 'Must be a non-negative decimal with up to 4 decimal places');
const itemSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  quantity: decimal.refine(value => Number(value) > 0, 'Quantity must be greater than zero'),
  unitPrice: decimal,
  taxRate: z.string().regex(/^\d{1,3}(\.\d{1,4})?$/).refine(value => Number(value) <= 100, 'Tax rate cannot exceed 100%').default('0'),
  category: z.string().trim().max(120).optional(),
}).strict();

export const createPurchaseRequestSchema = z.object({
  departmentId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  preferredSupplierId: z.string().uuid().optional(),
  requiredByDate: z.string().date().optional(),
  justification: z.string().trim().max(5000).optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  items: z.array(itemSchema).min(1).max(500),
}).strict();

export const updatePurchaseRequestSchema = createPurchaseRequestSchema.partial().extend({
  items: z.array(itemSchema).min(1).max(500).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field must be provided');

export const listPurchaseRequestsSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'IN_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED', 'CONVERTED_TO_PO']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const purchaseRequestIdSchema = z.object({ id: z.string().uuid() }).strict();
export const emptyBodySchema = z.object({}).strict();

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;
export type PurchaseRequestItemInput = CreatePurchaseRequestInput['items'][number];
