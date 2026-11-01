import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const userIdSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid user ID"),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  role: z.string().trim().max(50).optional(),
});

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254)
    .transform((value) => value.toLowerCase()),

  password: z.string().min(8).max(128),

  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),

  role: z.enum(["admin", "employee", "manager", "finance"]),

  isActive: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(254)
      .transform((value) => value.toLowerCase())
      .optional(),

    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),

    role: z.enum(["admin", "employee", "manager", "finance"]).optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided" }
  );

export function validateListUsers(req, res, next) {
  const result = listUsersSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid user query parameters",
      errors: result.error.issues,
    });
  }

  req.validatedQuery = result.data;
  next();
}

export function validateUserId(req, res, next) {
  const result = userIdSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID",
      errors: result.error.issues,
    });
  }

  next();
}

export function validateCreateUser(req, res, next) {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid user details",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  next();
}

export function validateUpdateUser(req, res, next) {
  const result = updateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid user update",
      errors: result.error.issues,
    });
  }

  req.validatedBody = result.data;
  next();
}