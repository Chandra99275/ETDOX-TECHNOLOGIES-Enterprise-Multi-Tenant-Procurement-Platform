import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  approveInvoice,
  createInvoice,
  getInvoice,
  listInvoices,
  transitionInvoice,
  validateInvoice,
} from './invoices.repository';

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createInvoice(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as {
      status?: string; supplierId?: string; limit: number; offset: number;
    };
    res.json(await listInvoices(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getInvoice(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const validate: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await validateInvoice(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const approve: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await approveInvoice(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const paymentReady: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await transitionInvoice(getRequestContext(req), req.params.id, 'APPROVED', 'PAYMENT_READY', 'invoice.payment_ready'),
    });
  } catch (error) {
    next(error);
  }
};

export const markPaid: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await transitionInvoice(getRequestContext(req), req.params.id, 'PAYMENT_READY', 'PAID', 'invoice.marked_paid'),
    });
  } catch (error) {
    next(error);
  }
};
