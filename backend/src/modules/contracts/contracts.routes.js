
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  changeStatus,
  create,
  get,
  list,
  remove,
  update,
} from './contracts.controller.js';
import {
  contractIdSchema,
  contractStatusSchema,
  createContractSchema,
  listContractsSchema,
  updateContractSchema,
} from './contracts.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('contracts:read'),
  validate(listContractsSchema, 'query'),
  list
);

router.post(
  '/',
  requirePermission('contracts:manage'),
  validate(createContractSchema),
  create
);

router.get(
  '/:id',
  requirePermission('contracts:read'),
  validate(contractIdSchema, 'params'),
  get
);

router.patch(
  '/:id',
  requirePermission('contracts:manage'),
  validate(contractIdSchema, 'params'),
  validate(updateContractSchema),
  update
);

router.post(
  '/:id/status',
  requirePermission('contracts:manage'),
  validate(contractIdSchema, 'params'),
  validate(contractStatusSchema),
  changeStatus
);

router.delete(
  '/:id',
  requirePermission('contracts:manage'),
  validate(contractIdSchema, 'params'),
  remove
);
