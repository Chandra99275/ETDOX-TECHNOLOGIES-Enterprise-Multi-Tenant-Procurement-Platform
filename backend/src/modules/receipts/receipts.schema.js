import { z } from 'zod';

const itemSchema = z
  .object({
    purchaseOrderItemId: z.string().uuid(),
    quantityReceived: z
      .string()
      .regex(/^\d{1,11}(\.\d{1,4})?$/)
      .refine((value) => Number(value) > 0),
    condition: z
      .enum(['ACCEPTED', 'DAMAGED', 'REJECTED', 'PARTIAL'])
      .optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const createReceiptSchema = z
  .object({
    receiptNumber: z.string().trim().min(1).max(80).optional(),
    deliveryNoteReference: z.string().trim().max(160).optional(),
    items: z
      .array(itemSchema)
      .min(1)
      .max(500)
      .refine(
        (items) =>
          new Set(items.map((item) => item.purchaseOrderItemId)).size ===
          items.length,
        'A purchase order line may only appear once per receipt'
      ),
  })
  .strict();

export const receiptParamsSchema = z
  .object({
    purchaseOrderId: z.string().uuid(),
  })
  .strict();

export const receiptItemParamsSchema = receiptParamsSchema
  .extend({
    receiptId: z.string().uuid(),
  })
  .strict();

export const emptyBodySchema = z.object({}).strict();