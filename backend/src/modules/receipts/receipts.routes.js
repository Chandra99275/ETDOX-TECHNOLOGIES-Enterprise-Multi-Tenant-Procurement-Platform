import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  create,
  list,
  post,
} from './receipts.controller.js';
import {
  createReceiptSchema,
  emptyBodySchema,
  receiptItemParamsSchema,
  receiptParamsSchema,
} from './receipts.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/:purchaseOrderId/receipts',
  requirePermission('receipts:read'),
  validate(receiptParamsSchema, 'params'),
  list
);

router.post(
  '/:purchaseOrderId/receipts',
  requirePermission('receipts:manage'),
  validate(receiptParamsSchema, 'params'),
  validate(createReceiptSchema),
  create
);

router.post(
  '/:purchaseOrderId/receipts/:receiptId/post',
  requirePermission('receipts:manage'),
  validate(receiptItemParamsSchema, 'params'),
  validate(emptyBodySchema),
  post
);