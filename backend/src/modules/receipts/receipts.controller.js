import { getRequestContext } from '../../middleware/auth.js';
import {
  createReceipt,
  listReceipts,
  postReceipt,
} from './receipts.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createReceipt(
        getRequestContext(req),
        req.params.purchaseOrderId,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    res.json({
      data: await listReceipts(
        getRequestContext(req),
        req.params.purchaseOrderId
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const post = async (req, res, next) => {
  try {
    res.json({
      data: await postReceipt(
        getRequestContext(req),
        req.params.purchaseOrderId,
        req.params.receiptId
      ),
    });
  } catch (error) {
    next(error);
  }
};