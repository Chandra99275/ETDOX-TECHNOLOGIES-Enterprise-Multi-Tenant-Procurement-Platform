import { z } from "zod";
import { AUTH_CONSTANTS } from "./auth.constants.js";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(AUTH_CONSTANTS.MAX_EMAIL_LENGTH, "Email is too long")
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(1, "Password is required")
    .max(
      AUTH_CONSTANTS.MAX_PASSWORD_LENGTH,
      "Password must not exceed 128 characters"
    ),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),

    newPassword: z
      .string()
      .min(
        AUTH_CONSTANTS.MIN_PASSWORD_LENGTH,
        `Password must contain at least ${AUTH_CONSTANTS.MIN_PASSWORD_LENGTH} characters`
      )
      .max(
        AUTH_CONSTANTS.MAX_PASSWORD_LENGTH,
        "Password must not exceed 128 characters"
      ),
  })
  .refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message: "New password must differ from the current password",
      path: ["newPassword"],
    }
  );

/**
 * Express middleware for validating the login body.
 */
export function validateLogin(req, res, next) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Please check the submitted information",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  req.validatedBody = result.data;
  return next();
}