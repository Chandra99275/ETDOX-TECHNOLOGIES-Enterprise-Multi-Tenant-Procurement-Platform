import { z } from "zod";

export const uuidSchema = z.string().uuid({
  message: "A valid UUID is required.",
});

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(128, "Password cannot exceed 128 characters.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const roleSchema = z.enum([
  "admin",
  "employee",
  "manager",
  "finance",
]);

export const statusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const moneySchema = z
  .number({
    message: "Amount must be a number.",
  })
  .finite()
  .nonnegative()
  .max(999999999999);

export const nonEmptyStringSchema = z
  .string()
  .trim()
  .min(1, "This field cannot be empty.")
  .max(500);

export const descriptionSchema = z
  .string()
  .trim()
  .max(5000)
  .optional();

export const dateStringSchema = z
  .string()
  .datetime({
    message: "Enter a valid ISO 8601 date and time.",
  });

export const createPurchaseRequestSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: descriptionSchema,
  amount: moneySchema,
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional()
    .default("INR"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export function validateUUID(value) {
  return uuidSchema.safeParse(value);
}

export function validateEmail(value) {
  return emailSchema.safeParse(value);
}

export function validatePagination(value) {
  return paginationSchema.safeParse(value);
}

export default {
  uuidSchema,
  emailSchema,
  passwordSchema,
  paginationSchema,
  roleSchema,
  statusSchema,
  moneySchema,
  nonEmptyStringSchema,
  descriptionSchema,
  dateStringSchema,
  createPurchaseRequestSchema,
  loginSchema,
  validateUUID,
  validateEmail,
  validatePagination,
};