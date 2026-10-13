import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
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
} from './tenants.controller';
import { costCenterSchema, departmentSchema, updateTenantSchema } from './tenants.schema';
import { assignRolesSchema, createUserSchema, listUsersSchema, resetPasswordSchema, updateUserSchema, userIdSchema } from './users.schema';
import { createRoleSchema, roleIdSchema, updateRoleSchema } from './roles.schema';

export const router = Router();
router.get('/organization', authenticate, requirePermission('organization:read'), getOrganization);
router.patch('/organization', authenticate, requirePermission('organization:manage'), validate(updateTenantSchema), updateOrganization);
router.get('/departments', authenticate, requirePermission('organization:read'), getDepartments);
router.post('/departments', authenticate, requirePermission('organization:manage'), validate(departmentSchema), addDepartment);
router.get('/cost-centers', authenticate, requirePermission('organization:read'), getCostCenters);
router.post('/cost-centers', authenticate, requirePermission('organization:manage'), validate(costCenterSchema), addCostCenter);
router.get('/users', authenticate, requirePermission('users:read'), validate(listUsersSchema, 'query'), getUsers);
router.post('/users', authenticate, requirePermission('users:manage'), validate(createUserSchema), addUser);
router.get('/users/:id', authenticate, requirePermission('users:read'), validate(userIdSchema, 'params'), getUserById);
router.patch('/users/:id', authenticate, requirePermission('users:manage'), validate(userIdSchema, 'params'), validate(updateUserSchema), updateUserById);
router.put('/users/:id/roles', authenticate, requirePermission('roles:manage'), validate(userIdSchema, 'params'), validate(assignRolesSchema), updateUserRoles);
router.put('/users/:id/password', authenticate, requirePermission('users:manage'), validate(userIdSchema, 'params'), validate(resetPasswordSchema), changeUserPassword);
router.get('/roles', authenticate, requirePermission('roles:manage'), getRoles);
router.post('/roles', authenticate, requirePermission('roles:manage'), validate(createRoleSchema), addRole);
router.patch('/roles/:id', authenticate, requirePermission('roles:manage'), validate(roleIdSchema, 'params'), validate(updateRoleSchema), updateRoleById);
router.delete('/roles/:id', authenticate, requirePermission('roles:manage'), validate(roleIdSchema, 'params'), removeRole);
