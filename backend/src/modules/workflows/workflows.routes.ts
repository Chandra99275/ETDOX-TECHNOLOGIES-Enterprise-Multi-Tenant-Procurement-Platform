import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { act, activate, create, createVersion, get, list, pendingTasks, remove, updateVersion } from './workflows.controller';
import {
  createWorkflowSchema, createWorkflowVersionSchema, pendingTasksSchema,
  taskActionSchema, taskIdSchema, workflowIdSchema,
} from './workflows.schema';

export const router = Router();
router.use(authenticate);
router.get('/', requirePermission('workflows:manage'), list);
router.post('/', requirePermission('workflows:manage'), validate(createWorkflowSchema), create);
router.get('/tasks/pending', requirePermission('approvals:read'), validate(pendingTasksSchema, 'query'), pendingTasks);
router.post('/tasks/:taskId/actions', requirePermission('approvals:act'), validate(taskIdSchema, 'params'), validate(taskActionSchema), act);
router.post('/:id/activate', requirePermission('workflows:manage'), validate(workflowIdSchema, 'params'), activate);
router.post('/:id/versions', requirePermission('workflows:manage'), validate(workflowIdSchema, 'params'), validate(createWorkflowVersionSchema), createVersion);
router.patch('/:id', requirePermission('workflows:manage'), validate(workflowIdSchema, 'params'), validate(createWorkflowVersionSchema), updateVersion);
router.delete('/:id', requirePermission('workflows:manage'), validate(workflowIdSchema, 'params'), remove);
router.get('/:id', requirePermission('workflows:manage'), validate(workflowIdSchema, 'params'), get);
