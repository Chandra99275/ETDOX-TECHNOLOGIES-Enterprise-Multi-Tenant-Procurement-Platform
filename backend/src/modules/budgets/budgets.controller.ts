import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import { createBudget, listBudgets, updateBudget } from './budgets.repository';
import { BudgetListOptions } from './budgets.schema';

export const list: RequestHandler = async (req, res, next) => {
  try { res.json(await listBudgets(getRequestContext(req), req.query as unknown as BudgetListOptions)); } catch (error) { next(error); }
};
export const create: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createBudget(getRequestContext(req), req.body) }); } catch (error) { next(error); }
};
export const update: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateBudget(getRequestContext(req), req.params.id, req.body) }); } catch (error) { next(error); }
};
