import { z } from 'zod';

export const auditSearchSchema = z.object({
  action: z.string().trim().min(1).max(200).optional(),
  resourceType: z.string().trim().min(1).max(100).optional(),
  resourceId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, {
  message: 'from must be earlier than or equal to to',
  path: ['from'],
});
export type AuditSearchOptions = z.infer<typeof auditSearchSchema>;
