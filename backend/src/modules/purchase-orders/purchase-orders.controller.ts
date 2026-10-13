import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  acknowledgePurchaseOrder,
  approvePurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  issuePurchaseOrder,
  listPurchaseOrders,
  newPurchaseOrderNumber,
} from './purchase-orders.repository';

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createPurchaseOrder(getRequestContext(req), req.body, newPurchaseOrderNumber()),
    });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { status?: string; limit: number; offset: number };
    res.json(await listPurchaseOrders(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getPurchaseOrder(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const approve: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await approvePurchaseOrder(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const issue: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await issuePurchaseOrder(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const acknowledge: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await acknowledgePurchaseOrder(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};
