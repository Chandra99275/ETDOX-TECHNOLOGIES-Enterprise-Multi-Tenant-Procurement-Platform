
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';

import {
  get,
  list,
  markRead,
} from './notifications.controller.js';

import {
  listNotificationsSchema,
  notificationIdSchema,
} from './notifications.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('notifications:read'),
  validate(listNotificationsSchema, 'query'),
  list
);

router.get(
  '/:id',
  requirePermission('notifications:read'),
  validate(notificationIdSchema, 'params'),
  get
);

router.patch(
  '/:id/read',
  requirePermission('notifications:manage'),
  validate(notificationIdSchema, 'params'),
  markRead
);