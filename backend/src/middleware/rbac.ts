import { RequestHandler } from 'express';
import { AppError } from '../utils/errors';

export const requirePermission = (permission: string): RequestHandler => (req, _res, next) => {
  if (!req.context) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    return;
  }
  if (!req.context.permissions.includes(permission) && !req.context.permissions.includes('*')) {
    next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    return;
  }
  next();
};

export const requireAnyPermission = (...permissions: string[]): RequestHandler => (req, _res, next) => {
  if (!req.context) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    return;
  }
  if (!permissions.some(permission =>
    req.context?.permissions.includes(permission) || req.context?.permissions.includes('*')
  )) {
    next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    return;
  }
  next();
};
