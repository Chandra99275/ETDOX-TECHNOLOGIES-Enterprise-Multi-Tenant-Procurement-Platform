import { z } from 'zod';

const decimal = z.string().regex(/^\d{1,11}(\.\d{1,4})?$/);

export const createInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  invoiceNumber: z.string().trim().min(1).max(120),
  issueDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().uuid().optional(),
    description: z.string().trim().max(1000).optional(),
    quantity: decimal.refine(value => Number(value) > 0, 'Quantity must be greater than zero'),
    unitPrice: decimal,
    taxAmount: decimal.default('0'),
  }).strict()).min(1).max(500),
}).strict().refine(
  value => !value.issueDate || !value.dueDate || value.dueDate >= value.issueDate,
  { path: ['dueDate'], message: 'Due date cannot be before invoice issue date' },
).refine(
  value => {
    const ids = value.items.map(item => item.purchaseOrderItemId).filter((id): id is string => Boolean(id));
    return new Set(ids).size === ids.length;
  },
  { path: ['items'], message: 'A purchase order line may only appear once per invoice' },
);

export const listInvoicesSchema = z.object({
  status: z.enum(['DRAFT', 'VALIDATING', 'EXCEPTION', 'PENDING_APPROVAL', 'APPROVED', 'PAYMENT_READY', 'PAID', 'CLOSED', 'VOID']).optional(),
  supplierId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const invoiceIdSchema = z.object({ id: z.string().uuid() }).strict();
export const emptyBodySchema = z.object({}).strict();
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
