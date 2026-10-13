import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  changeContractStatus, createContract, deleteContract, getContract, listContracts, updateContract,
} from './contracts.repository';

export const create: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createContract(getRequestContext(req), req.body) }); }
  catch (error) { next(error); }
};
export const list: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listContracts(getRequestContext(req), req.query as unknown as {
      status?: string; supplierId?: string; search?: string; limit: number; offset: number;
    }));
  } catch (error) { next(error); }
};
export const get: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getContract(getRequestContext(req), req.params.id) }); }
  catch (error) { next(error); }
};
export const update: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateContract(getRequestContext(req), req.params.id, req.body) }); }
  catch (error) { next(error); }
};
export const changeStatus: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await changeContractStatus(getRequestContext(req), req.params.id, req.body.status) }); }
  catch (error) { next(error); }
};
export const remove: RequestHandler = async (req, res, next) => {
  try { await deleteContract(getRequestContext(req), req.params.id); res.status(204).send(); }
  catch (error) { next(error); }
};
