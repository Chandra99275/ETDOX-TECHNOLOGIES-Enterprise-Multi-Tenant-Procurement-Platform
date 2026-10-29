import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { summary } from './analytics.controller.js';
import { analyticsSummarySchema } from './analytics.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('analytics:read'),
  summary
);

router.get(
  '/summary',
  requirePermission('analytics:read'),
  validate(analyticsSummarySchema, 'query'),
  summary
);

export default router;
