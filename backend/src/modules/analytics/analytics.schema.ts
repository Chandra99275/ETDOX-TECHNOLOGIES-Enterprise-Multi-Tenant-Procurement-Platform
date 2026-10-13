import { z } from 'zod';

export const analyticsSummarySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, {
  message: 'from must be earlier than or equal to to',
  path: ['from'],
});
export type AnalyticsOptions = z.infer<typeof analyticsSummarySchema>;
