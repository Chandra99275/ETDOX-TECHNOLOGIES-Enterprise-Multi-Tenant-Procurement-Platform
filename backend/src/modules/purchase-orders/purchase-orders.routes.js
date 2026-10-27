
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';

import {
  acknowledge,
  approve,
  create,
  get,
  issue,
  list,
} from './purchase-orders.controller.js';

import {
  createPurchaseOrderSchema,
  emptyBodySchema,
  listPurchaseOrdersSchema,
  purchaseOrderIdSchema,
} from './purchase-orders.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('purchase_orders:read'),
  validate(listPurchaseOrdersSchema, 'query'),
  list
);

router.post(
  '/',
  requirePermission('purchase_orders:manage'),
  validate(createPurchaseOrderSchema),
  create
);

router.get(
  '/:id',
  requirePermission('purchase_orders:read'),
  validate(purchaseOrderIdSchema, 'params'),
  get
);

router.post(
  '/:id/approve',
  requirePermission('purchase_orders:approve'),
  validate(purchaseOrderIdSchema, 'params'),
  validate(emptyBodySchema),
  approve
);

router.post(
  '/:id/issue',
  requirePermission('purchase_orders:issue'),
  validate(purchaseOrderIdSchema, 'params'),
  validate(emptyBodySchema),
  issue
);

router.post(
  '/:id/acknowledge',
  requirePermission('purchase_orders:acknowledge'),
  validate(purchaseOrderIdSchema, 'params'),
  validate(emptyBodySchema),
  acknowledge
);
