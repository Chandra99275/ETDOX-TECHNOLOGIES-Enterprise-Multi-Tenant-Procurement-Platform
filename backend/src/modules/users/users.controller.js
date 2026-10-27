import * as usersService from './users.service.js';

function getTenantId(req) {
  return req.tenantId ?? req.user?.tenantId;
}

export async function listUsers(req, res, next) {
  try {
    const result = await usersService.listUsers({
      tenantId: getTenantId(req),
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await usersService.getUser({
      tenantId: getTenantId(req),
      userId: req.params.id,
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const user = await usersService.createUser({
      tenantId: getTenantId(req),
      input: req.body,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await usersService.updateUser({
      tenantId: getTenantId(req),
      userId: req.params.id,
      input: req.body,
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateUser(req, res, next) {
  try {
    const currentUserId = req.user?.id;

    if (currentUserId === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
    }

    const user = await usersService.deactivateUser({
      tenantId: getTenantId(req),
      userId: req.params.id,
    });

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}