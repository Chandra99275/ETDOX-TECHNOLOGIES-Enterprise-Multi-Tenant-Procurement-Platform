import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { get, list, markRead } from './notifications.controller';
import { listNotificationsSchema, notificationIdSchema } from './notifications.schema';

export const router = Router();
router.use(authenticate);
router.get('/', requirePermission('notifications:read'), validate(listNotificationsSchema, 'query'), list);
router.get('/:id', requirePermission('notifications:read'), validate(notificationIdSchema, 'params'), get);
router.patch('/:id/read', requirePermission('notifications:manage'), validate(notificationIdSchema, 'params'), markRead);
