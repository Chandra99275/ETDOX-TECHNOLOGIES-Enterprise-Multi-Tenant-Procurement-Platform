
import { getRequestContext } from '../../middleware/auth.js';

import {
  cancelPurchaseRequest,
  createPurchaseRequest,
  getPurchaseRequest,
  listPurchaseRequests,
  newRequestNumber,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from './purchase-requests.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createPurchaseRequest(
        getRequestContext(req),
        req.body,
        newRequestNumber()
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const query = req.query;

    const includeAll =
      context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('purchase_requests:read_all') ||
      context.permissions.includes('*');

    res.json({
      ...await listPurchaseRequests(context, {
        ...query,
        includeAll,
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    const context = getRequestContext(req);

    const includeAll =
      context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('purchase_requests:read_all') ||
      context.permissions.includes('*');

    res.json({
      data: await getPurchaseRequest(
        context,
        req.params.id,
        includeAll
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const context = getRequestContext(req);

    const canManage =
      context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('*');

    res.json({
      data: await updatePurchaseRequest(
        context,
        req.params.id,
        req.body,
        canManage
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const submit = async (req, res, next) => {
  try {
    res.json({
      data: await submitPurchaseRequest(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const cancel = async (req, res, next) => {
  try {
    const context = getRequestContext(req);

    const canManage =
      context.permissions.includes('purchase_requests:manage') ||
      context.permissions.includes('*');

    res.json({
      data: await cancelPurchaseRequest(
        context,
        req.params.id,
        canManage
      ),
    });
  } catch (error) {
    next(error);
  }
};
