
import { getRequestContext } from '../../middleware/auth.js';

import {
  acknowledgePurchaseOrder,
  approvePurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  issuePurchaseOrder,
  listPurchaseOrders,
  newPurchaseOrderNumber,
} from './purchase-orders.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createPurchaseOrder(
        getRequestContext(req),
        req.body,
        newPurchaseOrderNumber()
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = req.query;

    res.json(
      await listPurchaseOrders(getRequestContext(req), query)
    );
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getPurchaseOrder(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const approve = async (req, res, next) => {
  try {
    res.json({
      data: await approvePurchaseOrder(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const issue = async (req, res, next) => {
  try {
    res.json({
      data: await issuePurchaseOrder(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const acknowledge = async (req, res, next) => {
  try {
    res.json({
      data: await acknowledgePurchaseOrder(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};
