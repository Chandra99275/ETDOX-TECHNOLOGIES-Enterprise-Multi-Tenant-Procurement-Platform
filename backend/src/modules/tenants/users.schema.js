
import { z } from 'zod';

export const userIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listUsersSchema = z
  .object({
    active: z.enum(['true', 'false']).optional(),

    search: z
      .string()
      .trim()
      .max(120)
      .optional(),

    limit: z
      .coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25),

    offset: z
      .coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(0),
  })
  .strict();

export const createUserSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254),

    password: z
      .string()
      .min(12)
      .max(128),

    firstName: z
      .string()
      .trim()
      .min(1)
      .max(100),

    lastName: z
      .string()
      .trim()
      .min(1)
      .max(100),

    title: z
      .string()
      .trim()
      .max(120)
      .optional(),

    phone: z
      .string()
      .trim()
      .max(40)
      .optional(),

    departmentId: z
      .string()
      .uuid()
      .optional(),

    roleIds: z
      .array(z.string().uuid())
      .max(20)
      .default([]),
  })
  .strict();

export const updateUserSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    lastName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    title: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional(),

    phone: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional(),

    departmentId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    isActive: z
      .boolean()
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided'
  );

export const assignRolesSchema = z
  .object({
    roleIds: z
      .array(z.string().uuid())
      .max(20),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12)
      .max(128),
  })
  .strict();
