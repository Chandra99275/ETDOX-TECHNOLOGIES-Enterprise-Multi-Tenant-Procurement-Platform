
import { getRequestContext } from '../../middleware/auth.js';
import {
  changeContractStatus,
  createContract,
  deleteContract,
  getContract,
  listContracts,
  updateContract,
} from './contracts.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createContract(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    res.json(
      await listContracts(getRequestContext(req), req.query)
    );
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getContract(getRequestContext(req), req.params.id),
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json({
      data: await updateContract(
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
      data: await changeContractStatus(
        getRequestContext(req),
        req.params.id,
        req.body.status
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteContract(getRequestContext(req), req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
