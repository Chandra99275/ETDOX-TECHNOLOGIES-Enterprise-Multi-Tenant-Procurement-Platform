import { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors';
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (!(err instanceof AppError)) {
    console.error(`[${req.requestId ?? 'unknown'}]`, err);
  }
  const e = err instanceof AppError ? err : new AppError(500, 'INTERNAL_ERROR', 'Unexpected error');
  res.status(e.status).json({
    error: {
      code: e.code,
      message: e.message,
      fields: e.fields,
      requestId: req.requestId,
    },
  });
};
