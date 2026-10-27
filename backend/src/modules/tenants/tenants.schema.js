
import { z } from 'zod';

export const updateTenantSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .optional(),

    baseCurrency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .optional(),

    settings: z
      .record(z.unknown())
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided'
  );

export const departmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(160),

    code: z
      .string()
      .trim()
      .min(1)
      .max(40),

    managerId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    parentDepartmentId: z
      .string()
      .uuid()
      .nullable()
      .optional(),
  })
  .strict();

export const costCenterSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(40),

    name: z
      .string()
      .trim()
      .min(1)
      .max(160),

    departmentId: z
      .string()
      .uuid()
      .nullable()
      .optional(),
  })
  .strict();
