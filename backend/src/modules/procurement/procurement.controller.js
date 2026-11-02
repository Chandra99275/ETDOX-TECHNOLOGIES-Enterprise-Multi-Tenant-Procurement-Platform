import * as procurementService from "./procurement.service.js";

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
 * GET /api/v1/procurement
 */
export async function listRequests(req, res, next) {
  try {
    const result = await procurementService.listRequests(
      getActor(req),
      req.validatedQuery ?? req.query
    );

    return res.status(200).json({
      success: true,
      message: "Procurement requests retrieved successfully",
      data: result.requests,
      requests: result.requests, // compatibility
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/procurement/:id
 */
export async function getRequest(req, res, next) {
  try {
    const request = await procurementService.getRequest(
      getActor(req),
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Procurement request retrieved successfully",
      data: request,
      request,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/procurement
 */
export async function createRequest(req, res, next) {
  try {
    const request = await procurementService.createRequest(
      getActor(req),
      req.validatedBody
    );

    return res.status(201).json({
      success: true,
      message: "Procurement request created successfully",
      data: request,
      request,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/v1/procurement/:id
 */
export async function updateRequest(req, res, next) {
  try {
    const request = await procurementService.updateRequest(
      getActor(req),
      req.params.id,
      req.validatedBody
    );

    return res.status(200).json({
      success: true,
      message: "Procurement request updated successfully",
      data: request,
      request,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/procurement/:id/submit
 */
export async function submitRequest(req, res, next) {
  try {
    const request = await procurementService.submitRequest(
      getActor(req),
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Procurement request submitted successfully",
      data: request,
      request,
    });
  } catch (error) {
    next(error);
  }
}

export async function managerDecision(req, res, next) {
  try {
    const request = await procurementService.managerDecision({
      ...getContext(req),
      requestId: req.params.id,
      decision: req.body?.decision,
      comment: req.body?.comment,
    });

    res.status(200).json({
      success: true,
      message: 'Manager decision recorded successfully.',
      data: request,
      request,
    });
  } catch (error) {

    next(error);
  }
}

export async function financeDecision(req, res, next) {
  try {
    const request = await procurementService.financeDecision({
      ...getContext(req),
      requestId: req.params.id,
      decision: req.body?.decision,
      comment: req.body?.comment,
    });

    res.status(200).json({
      success: true,
      message: 'Finance decision recorded successfully.',
      data: request,
      request,
    });
  } catch (error) {
    next(error);

    return next(error);

  }
}
