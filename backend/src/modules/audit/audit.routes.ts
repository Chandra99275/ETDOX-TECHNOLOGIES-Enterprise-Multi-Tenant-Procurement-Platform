import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { search } from './audit.controller';
import { auditSearchSchema } from './audit.schema';

export const router = Router();
router.use(authenticate);
router.get('/', requirePermission('audit:read'), validate(auditSearchSchema, 'query'), search);
