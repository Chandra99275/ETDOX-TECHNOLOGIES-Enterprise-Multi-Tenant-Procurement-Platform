
import { z } from 'zod';

const uuid = z.string().uuid();

const amount = z
  .union([z.string(), z.number().finite()])
  .transform((value) => String(value))
  .refine(
    (value) => /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/.test(value),
    {
      message:
        'Amount must be nonnegative and have at most 15 integer and 4 fractional digits',
    }
  );

export const budgetIdSchema = z.object({
  id: uuid,
});

export const listBudgetsSchema = z
  .object({
    fiscalYear: z.coerce.number().int().min(2000).max(9999).optional(),
    departmentId: uuid.optional(),
    costCenterId: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();

export const createBudgetSchema = z
  .object({
    departmentId: uuid.nullable().optional(),
    costCenterId: uuid.nullable().optional(),
    fiscalYear: z.number().int().min(2000).max(9999),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase()),
    allocated: amount,
    reserved: amount.optional().default('0'),
    committed: amount.optional().default('0'),
    spent: amount.optional().default('0'),
  })
  .strict();

export const updateBudgetSchema = z
  .object({
    departmentId: uuid.nullable().optional(),
    costCenterId: uuid.nullable().optional(),
    fiscalYear: z.number().int().min(2000).max(9999).optional(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    allocated: amount.optional(),
    reserved: amount.optional(),
    committed: amount.optional(),
    spent: amount.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
