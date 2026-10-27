
import { getRequestContext } from '../../middleware/auth.js';
import {
  approveInvoice,
  createInvoice,
  getInvoice,
  listInvoices,
  transitionInvoice,
  validateInvoice,
} from './invoices.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createInvoice(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = req.query;

    res.json(await listInvoices(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getInvoice(getRequestContext(req), req.params.id),
    });
  } catch (error) {
    next(error);
  }
};

export const validate = async (req, res, next) => {
  try {
    res.json({
      data: await validateInvoice(getRequestContext(req), req.params.id),
    });
  } catch (error) {
    next(error);
  }
};

export const approve = async (req, res, next) => {
  try {
    res.json({
      data: await approveInvoice(getRequestContext(req), req.params.id),
    });
  } catch (error) {
    next(error);
  }
};

export const paymentReady = async (req, res, next) => {
  try {
    res.json({
      data: await transitionInvoice(
        getRequestContext(req),
        req.params.id,
        'APPROVED',
        'PAYMENT_READY',
        'invoice.payment_ready'
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const markPaid = async (req, res, next) => {
  try {
    res.json({
      data: await transitionInvoice(
        getRequestContext(req),
        req.params.id,
        'PAYMENT_READY',
        'PAID',
        'invoice.marked_paid'
      ),
    });
  } catch (error) {
    next(error);
  }
};
