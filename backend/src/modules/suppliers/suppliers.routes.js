import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  changeStatus,
  create,
  get,
  list,
  update,
} from './suppliers.controller.js';
import {
  createSupplierSchema,
  listSuppliersSchema,
  supplierIdSchema,
  supplierStatusSchema,
  updateSupplierSchema,
} from './suppliers.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('suppliers:read'),
  validate(listSuppliersSchema, 'query'),
  list
);

router.post(
  '/',
  requirePermission('suppliers:manage'),
  validate(createSupplierSchema),
  create
);

router.get(
  '/:id',
  requirePermission('suppliers:read'),
  validate(supplierIdSchema, 'params'),
  get
);

router.patch(
  '/:id',
  requirePermission('suppliers:manage'),
  validate(supplierIdSchema, 'params'),
  validate(updateSupplierSchema),
  update
);

router.post(
  '/:id/status',
  requirePermission('suppliers:manage'),
  validate(supplierIdSchema, 'params'),
  validate(supplierStatusSchema),
  changeStatus
);