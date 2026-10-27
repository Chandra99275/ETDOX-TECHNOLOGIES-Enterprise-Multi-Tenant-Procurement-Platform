
import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });

const contractFields = {
  contractNumber: z.string().trim().min(1).max(120),
  supplierId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10000).nullable().optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  contractValue: z
    .union([
      z.string().regex(/^\d{1,15}(\.\d{1,4})?$/),
      z.number().finite().nonnegative(),
    ])
    .nullable()
    .optional(),
  startsOn: date.nullable().optional(),
  endsOn: date.nullable().optional(),
  terms: z.record(z.unknown()).optional(),
  documentStorageKey: z.string().trim().max(1000).nullable().optional(),
};

const datesAreValid = (value) =>
  !value.startsOn ||
  !value.endsOn ||
  value.endsOn >= value.startsOn;

export const createContractSchema = z
  .object(contractFields)
  .strict()
  .refine(datesAreValid, {
    message: 'endsOn must be on or after startsOn',
    path: ['endsOn'],
  });

export const updateContractSchema = z
  .object(contractFields)
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided'
  )
  .refine(datesAreValid, {
    message: 'endsOn must be on or after startsOn',
    path: ['endsOn'],
  });

export const listContractsSchema = z
  .object({
    status: z
      .enum([
        'DRAFT',
        'PENDING_APPROVAL',
        'ACTIVE',
        'EXPIRED',
        'TERMINATED',
        'CLOSED',
      ])
      .optional(),
    supplierId: z.string().uuid().optional(),
    search: z.string().trim().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();

export const contractIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const contractStatusSchema = z
  .object({
    status: z.enum([
      'PENDING_APPROVAL',
      'ACTIVE',
      'EXPIRED',
      'TERMINATED',
      'CLOSED',
    ]),
  })
  .strict();
