import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/errors';

export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(source === 'body' && req.body === undefined ? {} : req[source]);
    if (!result.success) {
      next(new AppError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      ));
      return;
    }
    req[source] = result.data;
    next();
  };
