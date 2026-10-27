
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate as validateRequest } from '../../middleware/validate.js';

import {
  approve,
  create,
  get,
  list,
  markPaid,
  paymentReady,
  validate,
} from './invoices.controller.js';

import {
  createInvoiceSchema,
  emptyBodySchema,
  invoiceIdSchema,
  listInvoicesSchema,
} from './invoices.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('invoices:read'),
  validateRequest(listInvoicesSchema, 'query'),
  list
);

router.post(
  '/',
  requirePermission('invoices:manage'),
  validateRequest(createInvoiceSchema),
  create
);

router.get(
  '/:id',
  requirePermission('invoices:read'),
  validateRequest(invoiceIdSchema, 'params'),
  get
);

router.post(
  '/:id/validate',
  requirePermission('invoices:manage'),
  validateRequest(invoiceIdSchema, 'params'),
  validateRequest(emptyBodySchema),
  validate
);

router.post(
  '/:id/approve',
  requirePermission('invoices:approve'),
  validateRequest(invoiceIdSchema, 'params'),
  validateRequest(emptyBodySchema),
  approve
);

router.post(
  '/:id/payment-ready',
  requirePermission('invoices:manage'),
  validateRequest(invoiceIdSchema, 'params'),
  validateRequest(emptyBodySchema),
  paymentReady
);

router.post(
  '/:id/mark-paid',
  requirePermission('invoices:manage'),
  validateRequest(invoiceIdSchema, 'params'),
  validateRequest(emptyBodySchema),
  markPaid
);
