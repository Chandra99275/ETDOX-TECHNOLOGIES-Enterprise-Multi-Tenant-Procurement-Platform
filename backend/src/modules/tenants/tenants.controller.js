import * as tenantsService from "./tenants.service.js";

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
 * GET /api/v1/tenants
 */
export async function listTenants(req, res, next) {
  try {
    const result = await tenantsService.listTenants(
      getActor(req),
      req.validatedQuery ?? req.query
    );

    return res.status(200).json({
      success: true,
      message: "Tenants retrieved successfully",
      data: result.tenants,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/tenants/me
 */
export async function getMyTenant(req, res, next) {
  try {
    const tenant = await tenantsService.getMyTenant(getActor(req));

    return res.status(200).json({
      success: true,
      message: "Your tenant was retrieved successfully",
      data: tenant,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/tenants/:id
 */
export async function getTenant(req, res, next) {
  try {
    const tenant = await tenantsService.getTenant(
      getActor(req),
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Tenant retrieved successfully",
      data: tenant,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/tenants
 */
export async function createTenant(req, res, next) {
  try {
    const tenant = await tenantsService.createTenant(
      getActor(req),
      req.validatedBody
    );

    return res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      data: tenant,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/v1/tenants/:id
 */
export async function updateTenant(req, res, next) {
  try {
    const tenant = await tenantsService.updateTenant(
      getActor(req),
      req.params.id,
      req.validatedBody
    );

    return res.status(200).json({
      success: true,
      message: "Tenant updated successfully",
      data: tenant,
    });
  } catch (error) {
    return next(error);
  }
}