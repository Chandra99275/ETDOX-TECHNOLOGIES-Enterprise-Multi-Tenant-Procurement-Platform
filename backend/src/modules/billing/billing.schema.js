
import { z } from 'zod';

const safeObject = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  const sensitiveKey =
    /(card|cvv|cvc|security.?code|bank|routing|account.?number|password|secret|token)/i;

  const inspect = (item, path) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      for (const [key, child] of Object.entries(item)) {
        if (sensitiveKey.test(key)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Payment secrets must not be stored',
            path: [...path, key],
          });
        }

        inspect(child, [...path, key]);
      }
    } else if (Array.isArray(item)) {
      item.forEach((child, index) =>
        inspect(child, [...path, String(index)])
      );
    }
  };

  inspect(value, []);
});

export const billingAccountUpsertSchema = z
  .object({
    provider: z.string().trim().max(100).nullable().optional(),
    providerCustomerId: z.string().trim().max(255).nullable().optional(),
    billingEmail: z.string().trim().email().max(254).nullable().optional(),
    billingDetails: safeObject.optional(),
    status: z
      .enum(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'])
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided'
  );

export const billingStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']),
  })
  .strict();

const entitlementValue = z.record(z.string(), z.unknown());
const startsAt = z.string().datetime({ offset: true });
const endsAt = startsAt.nullable();

const validEntitlementRange = (value) =>
  !value.startsAt ||
  !value.endsAt ||
  Date.parse(value.endsAt) > Date.parse(value.startsAt);

export const createEntitlementSchema = z
  .object({
    entitlementKey: z.string().trim().min(1).max(160),
    value: entitlementValue,
    startsAt: startsAt.optional(),
    endsAt: endsAt.optional(),
  })
  .strict()
  .refine(validEntitlementRange, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const updateEntitlementSchema = z
  .object({
    entitlementKey: z.string().trim().min(1).max(160).optional(),
    value: entitlementValue.optional(),
    startsAt: startsAt.optional(),
    endsAt: endsAt.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided'
  )
  .refine(validEntitlementRange, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const entitlementIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listEntitlementsSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();
