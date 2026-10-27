
import { ZodError } from 'zod';

export function validate({
  body,
  query,
  params,
} = {}) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }

      if (query) {
        req.validatedQuery = query.parse(req.query);
      }

      if (params) {
        req.validatedParams = params.parse(req.params);
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Request validation failed.',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
      }

      return next(error);
    }
  };
}

export default validate;
