
import { getRequestContext } from '../../middleware/auth.js';

import {
  createCostCenter,
  createDepartment,
  getTenant,
  listCostCenters,
  listDepartments,
  updateTenant,
} from './tenants.repository.js';

import {
  assignUserRoles,
  createUser,
  getUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from './users.repository.js';

import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from './roles.repository.js';

export const getOrganization = async (req, res, next) => {
  try {
    res.json({
      data: await getTenant(getRequestContext(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrganization = async (req, res, next) => {
  try {
    res.json({
      data: await updateTenant(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartments = async (req, res, next) => {
  try {
    res.json({
      data: await listDepartments(getRequestContext(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const addDepartment = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createDepartment(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const getCostCenters = async (req, res, next) => {
  try {
    res.json({
      data: await listCostCenters(getRequestContext(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const addCostCenter = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createCostCenter(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const query = {
      active:
        req.query.active === 'true'
          ? 'true'
          : req.query.active === 'false'
            ? 'false'
            : undefined,
      search:
        typeof req.query.search === 'string'
          ? req.query.search
          : undefined,
      limit: Number(req.query.limit),
      offset: Number(req.query.offset),
    };

    res.json(
      await listUsers(getRequestContext(req), query)
    );
  } catch (error) {
    next(error);
  }
};

export const addUser = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createUser(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    res.json({
      data: await getUser(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserById = async (req, res, next) => {
  try {
    res.json({
      data: await updateUser(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRoles = async (req, res, next) => {
  try {
    res.json({
      data: await assignUserRoles(
        getRequestContext(req),
        req.params.id,
        req.body.roleIds
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const changeUserPassword = async (req, res, next) => {
  try {
    await resetUserPassword(
      getRequestContext(req),
      req.params.id,
      req.body.password
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getRoles = async (req, res, next) => {
  try {
    res.json({
      data: await listRoles(getRequestContext(req)),
    });
  } catch (error) {
    next(error);
  }
};

export const addRole = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createRole(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const updateRoleById = async (req, res, next) => {
  try {
    res.json({
      data: await updateRole(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const removeRole = async (req, res, next) => {
  try {
    await deleteRole(
      getRequestContext(req),
      req.params.id
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
