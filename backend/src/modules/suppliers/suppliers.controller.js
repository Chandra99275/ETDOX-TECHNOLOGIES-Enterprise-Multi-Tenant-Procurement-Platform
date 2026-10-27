import { getRequestContext } from '../../middleware/auth.js';
import {
  changeSupplierStatus,
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from './suppliers.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createSupplier(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = req.query;

    res.json(
      await listSuppliers(getRequestContext(req), {
        status: query.status,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getSupplier(getRequestContext(req), req.params.id),
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json({
      data: await updateSupplier(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const changeStatus = async (req, res, next) => {
  try {
    res.json({
      data: await changeSupplierStatus(
        getRequestContext(req),
        req.params.id,
        req.body.status
      ),
    });
  } catch (error) {
    next(error);
  }
};