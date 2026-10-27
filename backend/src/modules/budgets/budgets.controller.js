
import { getRequestContext } from '../../middleware/auth.js';
import {
  createBudget,
  listBudgets,
  updateBudget,
} from './budgets.repository.js';

export const list = async (req, res, next) => {
  try {
    res.json(
      await listBudgets(getRequestContext(req), req.query)
    );
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createBudget(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json({
      data: await updateBudget(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};
