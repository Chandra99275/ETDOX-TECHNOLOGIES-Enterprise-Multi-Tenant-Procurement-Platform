import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  changeSupplierStatus,
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from './suppliers.repository';

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createSupplier(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { status?: string; search?: string; limit: number; offset: number };
    res.json(await listSuppliers(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getSupplier(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateSupplier(getRequestContext(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
};

export const changeStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await changeSupplierStatus(getRequestContext(req), req.params.id, req.body.status),
    });
  } catch (error) {
    next(error);
  }
};
