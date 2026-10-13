import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  changeAccountStatus, create, getAccount, list, remove, update, upsertAccount,
} from './billing.controller';
import {
  billingAccountUpsertSchema, billingStatusSchema, createEntitlementSchema, entitlementIdSchema,
  listEntitlementsSchema, updateEntitlementSchema,
} from './billing.schema';

export const router = Router();
router.use(authenticate);
router.get('/account', requirePermission('billing:read'), getAccount);
router.put('/account', requirePermission('billing:manage'), validate(billingAccountUpsertSchema), upsertAccount);
router.patch('/account', requirePermission('billing:manage'), validate(billingAccountUpsertSchema), upsertAccount);
router.patch('/account/status', requirePermission('billing:manage'), validate(billingStatusSchema), changeAccountStatus);
router.get('/entitlements', requirePermission('billing:read'), validate(listEntitlementsSchema, 'query'), list);
router.post('/entitlements', requirePermission('billing:manage'), validate(createEntitlementSchema), create);
router.patch('/entitlements/:id', requirePermission('billing:manage'), validate(entitlementIdSchema, 'params'), validate(updateEntitlementSchema), update);
router.delete('/entitlements/:id', requirePermission('billing:manage'), validate(entitlementIdSchema, 'params'), remove);
