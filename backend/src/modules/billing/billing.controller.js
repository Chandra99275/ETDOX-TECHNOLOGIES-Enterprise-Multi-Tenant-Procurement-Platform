
import { getRequestContext } from '../../middleware/auth.js';
import {
  changeBillingAccountStatus,
  createEntitlement,
  deleteEntitlement,
  getBillingAccount,
  listEntitlements,
  updateEntitlement,
  upsertBillingAccount,
} from './billing.repository.js';

export const getAccount = async (req, res, next) => {
  try {
    res.json({
      data: await getBillingAccount(getRequestContext(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const upsertAccount = async (req, res, next) => {
  try {
    res.json({
      data: await upsertBillingAccount(
        getRequestContext(req),
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const changeAccountStatus = async (req, res, next) => {
  try {
    res.json({
      data: await changeBillingAccountStatus(
        getRequestContext(req),
        req.body.status
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    res.json(
      await listEntitlements(
        getRequestContext(req),
        req.query
      )
    );
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createEntitlement(
        getRequestContext(req),
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json({
      data: await updateEntitlement(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteEntitlement(
      getRequestContext(req),
      req.params.id
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
