import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  cancelPurchaseRequest,
  createPurchaseRequest,
  getPurchaseRequest,
  listPurchaseRequests,
  newRequestNumber,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from './purchase-requests.repository';

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createPurchaseRequest(getRequestContext(req), req.body, newRequestNumber()),
    });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const query = req.query as unknown as { status?: string; limit: number; offset: number };
    const includeAll = context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('purchase_requests:read_all') ||
      context.permissions.includes('*');
    res.json({ ...await listPurchaseRequests(context, { ...query, includeAll }) });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const includeAll = context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('purchase_requests:read_all') ||
      context.permissions.includes('*');
    res.json({ data: await getPurchaseRequest(context, req.params.id, includeAll) });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const canManage = context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('*');
    res.json({ data: await updatePurchaseRequest(context, req.params.id, req.body, canManage) });
  } catch (error) {
    next(error);
  }
};

export const submit: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await submitPurchaseRequest(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const cancel: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const canManage = context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('*');
    res.json({ data: await cancelPurchaseRequest(context, req.params.id, canManage) });
  } catch (error) {
    next(error);
  }
};
