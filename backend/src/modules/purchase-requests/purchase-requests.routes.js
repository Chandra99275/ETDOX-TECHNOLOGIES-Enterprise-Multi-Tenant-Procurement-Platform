import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  cancel,
  create,
  get,
  list,
  submit,
  update,
} from './purchase-requests.controller.js';
import {
  createPurchaseRequestSchema,
  emptyBodySchema,
  listPurchaseRequestsSchema,
  purchaseRequestIdSchema,
  updatePurchaseRequestSchema,
} from './purchase-requests.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('purchase_requests:read'),
  validate(listPurchaseRequestsSchema, 'query'),
  list
);

router.post(
  '/',
  requirePermission('purchase_requests:create'),
  validate(createPurchaseRequestSchema),
  create
);

router.get(
  '/:id',
  requirePermission('purchase_requests:read'),
  validate(purchaseRequestIdSchema, 'params'),
  get
);

router.patch(
  '/:id',
  requireAnyPermission('purchase_requests:create', 'purchase_requests:manage'),
  validate(purchaseRequestIdSchema, 'params'),
  validate(updatePurchaseRequestSchema),
  update
);

router.post(
  '/:id/submit',
  requirePermission('purchase_requests:submit'),
  validate(purchaseRequestIdSchema, 'params'),
  validate(emptyBodySchema),
  submit
);

router.post(
  '/:id/cancel',
  requireAnyPermission('purchase_requests:create', 'purchase_requests:manage'),
  validate(purchaseRequestIdSchema, 'params'),
  validate(emptyBodySchema),
  cancel
);