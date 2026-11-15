
import { z } from "zod";

export const auditSearchSchema = z
  .object({
    // Filter by audit action.
    action: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .optional(),

    // Filter by entity/resource type.
    resourceType: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    // Filter by resource/entity ID.
    resourceId: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .optional(),

    // Filter by the user who performed the action.
    actorId: z
      .string()
      .uuid()
      .optional(),

    // Filter events from this date/time.
    from: z
      .string()
      .datetime({ offset: true })
      .optional(),

    // Filter events until this date/time.
    to: z
      .string()
      .datetime({ offset: true })
      .optional(),

    // Maximum number of records returned.
    limit: z
      .coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50),

    // Number of records to skip.
    offset: z
      .coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(0),
  })
  .strict()
  .refine(
    (value) => {
      if (!value.from || !value.to) {
        return true;
      }

      return (
        Date.parse(value.from) <= Date.parse(value.to)
      );
    },
    {
      message:
        "from must be earlier than or equal to to",
      path: ["from"],
    }
  );
