
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { create, list, update } from './budgets.controller.js';
import {
  budgetIdSchema,
  createBudgetSchema,
  listBudgetsSchema,
  updateBudgetSchema,
} from './budgets.schema.js';

export const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('budgets:read'),
  validate(listBudgetsSchema, 'query'),
  list
);

router.post(
  '/',
  requirePermission('budgets:manage'),
  validate(createBudgetSchema),
  create
);

router.patch(
  '/:id',
  requirePermission('budgets:manage'),
  validate(budgetIdSchema, 'params'),
  validate(updateBudgetSchema),
  update
);
