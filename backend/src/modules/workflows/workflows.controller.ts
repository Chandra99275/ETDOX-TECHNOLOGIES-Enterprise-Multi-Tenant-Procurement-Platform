import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  actOnTask, activateWorkflow, createWorkflow, createWorkflowVersion, deleteWorkflow, getWorkflow,
  listPendingTasks, listWorkflows,
} from './workflows.repository';

export const list: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await listWorkflows(getRequestContext(req)) }); } catch (error) { next(error); }
};
export const create: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createWorkflow(getRequestContext(req), req.body) }); } catch (error) { next(error); }
};
export const get: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getWorkflow(getRequestContext(req), req.params.id) }); } catch (error) { next(error); }
};
export const createVersion: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createWorkflowVersion(getRequestContext(req), req.params.id, req.body) }); } catch (error) { next(error); }
};
export const updateVersion: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createWorkflowVersion(getRequestContext(req), req.params.id, req.body) }); } catch (error) { next(error); }
};
export const remove: RequestHandler = async (req, res, next) => {
  try {
    await deleteWorkflow(getRequestContext(req), req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
};
export const activate: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await activateWorkflow(getRequestContext(req), req.params.id) }); } catch (error) { next(error); }
};
export const pendingTasks: RequestHandler = async (req, res, next) => {
  try {
    const result = await listPendingTasks(getRequestContext(req), req.query as unknown as { limit: number; offset: number });
    res.json({ ...result, pagination: { limit: Number(req.query.limit), offset: Number(req.query.offset) } });
  } catch (error) { next(error); }
};
export const act: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await actOnTask(getRequestContext(req), req.params.taskId, req.body) }); } catch (error) { next(error); }
};
