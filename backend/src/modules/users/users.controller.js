import * as usersService from "./users.service.js";

function getActor(req) {
  const user = req.user;

  if (!user) {
    const error = new Error("Authentication is required");
    error.statusCode = 401;
    throw error;
  }

  return {
    id: user.id ?? user.userId,
    tenantId: user.tenantId ?? user.tenant_id,
    role: user.role,
  };
}

/**
 * GET /api/v1/users
 */
export async function listUsers(req, res, next) {
  try {
    const result = await usersService.listUsers(
      getActor(req),
      req.validatedQuery
    );

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/users/:id
 */
export async function getUser(req, res, next) {
  try {
    const user = await usersService.getUser(
      getActor(req),
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/users
 */
export async function createUser(req, res, next) {
  try {
    const user = await usersService.createUser(
      getActor(req),
      req.validatedBody
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id
 */
export async function updateUser(req, res, next) {
  try {
    const user = await usersService.updateUser(
      getActor(req),
      req.params.id,
      req.validatedBody
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id/deactivate
 */
export async function deactivateUser(req, res, next) {
  try {
    const result = await usersService.deactivateUser(
      getActor(req),
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}