
import { getRequestContext } from '../../middleware/auth.js';

import {
  actOnTask,
  activateWorkflow,
  createWorkflow,
  createWorkflowVersion,
  deleteWorkflow,
  getWorkflow,
  listPendingTasks,
  listWorkflows,
} from './workflows.repository.js';

export const list = async (req, res, next) => {
  try {
    res.json({
      data: await listWorkflows(getRequestContext(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createWorkflow(
        getRequestContext(req),
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getWorkflow(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createVersion = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createWorkflowVersion(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateVersion = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createWorkflowVersion(
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
    await deleteWorkflow(
      getRequestContext(req),
      req.params.id
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const activate = async (req, res, next) => {
  try {
    res.json({
      data: await activateWorkflow(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const pendingTasks = async (req, res, next) => {
  try {
    const query = {
      limit: Number(req.query.limit ?? 25),
      offset: Number(req.query.offset ?? 0),
    };

    const result = await listPendingTasks(
      getRequestContext(req),
      query
    );

    res.json({
      ...result,
      pagination: {
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const act = async (req, res, next) => {
  try {
    res.json({
      data: await actOnTask(
        getRequestContext(req),
        req.params.taskId,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};
