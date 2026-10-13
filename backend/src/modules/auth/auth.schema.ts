import { z } from 'zod';

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
}).strict();

export const loginSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
