import { RequestHandler } from 'express';
import { AppError } from '../../utils/errors';
import { login, registerTenantAdmin } from './auth.service';

export const register: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await registerTenantAdmin(req.body) });
  } catch (error) {
    next(error);
  }
};

export const signIn: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await login(req.body) });
  } catch (error) {
    next(error);
  }
};

export const currentUser: RequestHandler = (req, res, next) => {
  if (!req.context) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    return;
  }
  res.json({ data: req.context });
};
