import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  changeBillingAccountStatus, createEntitlement, deleteEntitlement, getBillingAccount, listEntitlements,
  updateEntitlement, upsertBillingAccount,
} from './billing.repository';

export const getAccount: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getBillingAccount(getRequestContext(req)) }); }
  catch (error) { next(error); }
};
export const upsertAccount: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await upsertBillingAccount(getRequestContext(req), req.body) }); }
  catch (error) { next(error); }
};
export const changeAccountStatus: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await changeBillingAccountStatus(getRequestContext(req), req.body.status) }); }
  catch (error) { next(error); }
};
export const list: RequestHandler = async (req, res, next) => {
  try { res.json(await listEntitlements(getRequestContext(req), req.query as unknown as { limit: number; offset: number })); }
  catch (error) { next(error); }
};
export const create: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createEntitlement(getRequestContext(req), req.body) }); }
  catch (error) { next(error); }
};
export const update: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateEntitlement(getRequestContext(req), req.params.id, req.body) }); }
  catch (error) { next(error); }
};
export const remove: RequestHandler = async (req, res, next) => {
  try { await deleteEntitlement(getRequestContext(req), req.params.id); res.status(204).send(); }
  catch (error) { next(error); }
};
