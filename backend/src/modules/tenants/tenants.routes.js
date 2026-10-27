
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';

import {
  addCostCenter,
  addDepartment,
  getCostCenters,
  getDepartments,
  getOrganization,
  getRoles,
  getUserById,
  getUsers,
  updateOrganization,
  addRole,
  addUser,
  removeRole,
  changeUserPassword,
  updateRoleById,
  updateUserById,
  updateUserRoles,
} from './tenants.controller.js';

import {
  costCenterSchema,
  departmentSchema,
  updateTenantSchema,
} from './tenants.schema.js';

import {
  assignRolesSchema,
  createUserSchema,
  listUsersSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdSchema,
} from './users.schema.js';

import {
  createRoleSchema,
  roleIdSchema,
  updateRoleSchema,
} from './roles.schema.js';

export const router = Router();

// Organization
router.get(
  '/organization',
  authenticate,
  requirePermission('organization:read'),
  getOrganization
);

router.patch(
  '/organization',
  authenticate,
  requirePermission('organization:manage'),
  validate(updateTenantSchema),
  updateOrganization
);

// Departments
router.get(
  '/departments',
  authenticate,
  requirePermission('organization:read'),
  getDepartments
);

router.post(
  '/departments',
  authenticate,
  requirePermission('organization:manage'),
  validate(departmentSchema),
  addDepartment
);

// Cost centers
router.get(
  '/cost-centers',
  authenticate,
  requirePermission('organization:read'),
  getCostCenters
);

router.post(
  '/cost-centers',
  authenticate,
  requirePermission('organization:manage'),
  validate(costCenterSchema),
  addCostCenter
);

// Users
router.get(
  '/users',
  authenticate,
  requirePermission('users:read'),
  validate(listUsersSchema, 'query'),
  getUsers
);

router.post(
  '/users',
  authenticate,
  requirePermission('users:manage'),
  validate(createUserSchema),
  addUser
);

router.get(
  '/users/:id',
  authenticate,
  requirePermission('users:read'),
  validate(userIdSchema, 'params'),
  getUserById
);

router.patch(
  '/users/:id',
  authenticate,
  requirePermission('users:manage'),
  validate(userIdSchema, 'params'),
  validate(updateUserSchema),
  updateUserById
);

router.put(
  '/users/:id/roles',
  authenticate,
  requirePermission('roles:manage'),
  validate(userIdSchema, 'params'),
  validate(assignRolesSchema),
  updateUserRoles
);

router.put(
  '/users/:id/password',
  authenticate,
  requirePermission('users:manage'),
  validate(userIdSchema, 'params'),
  validate(resetPasswordSchema),
  changeUserPassword
);

// Roles
router.get(
  '/roles',
  authenticate,
  requirePermission('roles:manage'),
  getRoles
);

router.post(
  '/roles',
  authenticate,
  requirePermission('roles:manage'),
  validate(createRoleSchema),
  addRole
);

router.patch(
  '/roles/:id',
  authenticate,
  requirePermission('roles:manage'),
  validate(roleIdSchema, 'params'),
  validate(updateRoleSchema),
  updateRoleById
);

router.delete(
  '/roles/:id',
  authenticate,
  requirePermission('roles:manage'),
  validate(roleIdSchema, 'params'),
  removeRole
);

export default router;
