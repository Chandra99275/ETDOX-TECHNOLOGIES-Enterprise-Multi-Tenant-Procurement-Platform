import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { summary } from './analytics.controller';
import { analyticsSummarySchema } from './analytics.schema';

export const router = Router();
router.use(authenticate);
router.get('/summary', requirePermission('analytics:read'), validate(analyticsSummarySchema, 'query'), summary);
