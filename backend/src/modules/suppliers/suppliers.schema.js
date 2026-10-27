import { z } from 'zod';

export const createSupplierSchema = z
  .object({
    supplierCode: z.string().trim().min(1).max(64),
    legalName: z.string().trim().min(1).max(240),
    taxIdentifier: z.string().trim().max(120).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
    paymentTerms: z.string().trim().max(500).optional(),
    contactEmail: z.string().trim().email().max(254).optional(),
  })
  .strict();

export const updateSupplierSchema = createSupplierSchema
  .omit({ supplierCode: true })
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided'
  );

export const listSuppliersSchema = z
  .object({
    status: z
      .enum([
        'DRAFT',
        'PENDING_REVIEW',
        'ACTIVE',
        'SUSPENDED',
        'ARCHIVED',
      ])
      .optional(),
    search: z.string().trim().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();

export const supplierIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const supplierStatusSchema = z
  .object({
    status: z.enum([
      'PENDING_REVIEW',
      'ACTIVE',
      'REJECTED',
      'SUSPENDED',
      'ARCHIVED',
    ]),
  })
  .strict();