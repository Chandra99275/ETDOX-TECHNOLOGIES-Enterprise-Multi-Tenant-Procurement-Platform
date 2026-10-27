
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';

import {
  act,
  activate,
  create,
  createVersion,
  get,
  list,
  pendingTasks,
  remove,
  updateVersion,
} from './workflows.controller.js';

import {
  createWorkflowSchema,
  createWorkflowVersionSchema,
  pendingTasksSchema,
  taskActionSchema,
  taskIdSchema,
  workflowIdSchema,
} from './workflows.schema.js';

export const router = Router();

// Require authentication for all workflow routes.
router.use(authenticate);

// List workflows.
router.get(
  '/',
  requirePermission('workflows:manage'),
  list
);

// Create a workflow.
router.post(
  '/',
  requirePermission('workflows:manage'),
  validate(createWorkflowSchema),
  create
);

// List pending approval tasks.
router.get(
  '/tasks/pending',
  requirePermission('approvals:read'),
  validate(pendingTasksSchema, 'query'),
  pendingTasks
);

// Approve, reject, or request changes for a task.
router.post(
  '/tasks/:taskId/actions',
  requirePermission('approvals:act'),
  validate(taskIdSchema, 'params'),
  validate(taskActionSchema),
  act
);

// Activate a workflow.
router.post(
  '/:id/activate',
  requirePermission('workflows:manage'),
  validate(workflowIdSchema, 'params'),
  activate
);

// Create a new workflow version.
router.post(
  '/:id/versions',
  requirePermission('workflows:manage'),
  validate(workflowIdSchema, 'params'),
  validate(createWorkflowVersionSchema),
  createVersion
);

// Update a workflow version.
router.patch(
  '/:id',
  requirePermission('workflows:manage'),
  validate(workflowIdSchema, 'params'),
  validate(createWorkflowVersionSchema),
  updateVersion
);

// Delete a workflow.
router.delete(
  '/:id',
  requirePermission('workflows:manage'),
  validate(workflowIdSchema, 'params'),
  remove
);

// Get a workflow by ID.
router.get(
  '/:id',
  requirePermission('workflows:manage'),
  validate(workflowIdSchema, 'params'),
  get
);
