import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import { createCostCenter, createDepartment, getTenant, listCostCenters, listDepartments, updateTenant } from './tenants.repository';
import { assignUserRoles, createUser, getUser, listUsers, resetUserPassword, updateUser } from './users.repository';
import { createRole, deleteRole, listRoles, updateRole } from './roles.repository';

export const getOrganization: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getTenant(getRequestContext(req)) });
  } catch (error) {
    next(error);
  }
};

export const updateOrganization: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateTenant(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const getDepartments: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await listDepartments(getRequestContext(req)) });
  } catch (error) {
    next(error);
  }
};

export const addDepartment: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createDepartment(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const getCostCenters: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await listCostCenters(getRequestContext(req)) });
  } catch (error) {
    next(error);
  }
};

export const addCostCenter: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createCostCenter(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { active?: 'true' | 'false'; search?: string; limit: number; offset: number };
    res.json(await listUsers(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const addUser: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createUser(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const getUserById: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getUser(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const updateUserById: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateUser(getRequestContext(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
};

export const updateUserRoles: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await assignUserRoles(getRequestContext(req), req.params.id, req.body.roleIds) });
  } catch (error) {
    next(error);
  }
};

export const changeUserPassword: RequestHandler = async (req, res, next) => {
  try {
    await resetUserPassword(getRequestContext(req), req.params.id, req.body.password);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getRoles: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await listRoles(getRequestContext(req)) });
  } catch (error) {
    next(error);
  }
};

export const addRole: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createRole(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const updateRoleById: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateRole(getRequestContext(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
};

export const removeRole: RequestHandler = async (req, res, next) => {
  try {
    await deleteRole(getRequestContext(req), req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
