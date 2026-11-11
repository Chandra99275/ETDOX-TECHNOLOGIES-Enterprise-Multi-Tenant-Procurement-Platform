
import * as procurementService from "./procurement.service.js";

// ============================================================
// AUTHENTICATED USER
// ============================================================

function getActor(req) {
  const user = req.user;

  if (!user) {
    const error = new Error("Authentication is required");
    error.statusCode = 401;
    throw error;
  }

  const id =
    user.id ??
    user.userId ??
    user.user_id ??
    user.sub;

  const tenantId =
    user.tenantId ??
    user.tenant_id ??
    user.tenant?.id ??
    req.tenantId ??
    req.tenant_id;

  if (!id || !tenantId) {
    const error = new Error(
      "Authenticated user is missing user ID or tenant ID"
    );
    error.statusCode = 403;
    throw error;
  }

  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(user.role ? [user.role] : []),
    ...(user.roleName ? [user.roleName] : []),
    ...(user.role_name ? [user.role_name] : []),
  ];

  return {
    id: String(id),
    userId: String(id),
    sub: String(id),
    tenantId: String(tenantId),
    role: user.role ?? user.roleName ?? user.role_name ?? null,
    roles,
    permissions: Array.isArray(user.permissions)
      ? user.permissions
      : [],
  };
}

// ============================================================
// REQUEST CONTEXT
// ============================================================

function getContext(req) {
  const actor = getActor(req);

  return {
    actor,
    user: actor,
    id: actor.id,
    userId: actor.userId,
    tenantId: actor.tenantId,
    role: actor.role,
    roles: actor.roles,
    permissions: actor.permissions,
  };
}

// ============================================================
// GET ALL PROCUREMENT REQUESTS
// GET /api/v1/procurement
// GET /api/v1/procurement/requests
// ============================================================

export async function listRequests(req, res, next) {
  try {
    const result = await procurementService.listRequests(
      getActor(req),
      req.validatedQuery ?? req.query
    );

    const requests = Array.isArray(result?.items)
      ? result.items
      : [];

    const pagination = {
      total: Number(result?.total ?? requests.length),
      page: Number(result?.page ?? 1),
      limit: Number(result?.limit ?? 20),
      totalPages: Number(result?.totalPages ?? 1),
    };

    return res.status(200).json({
      success: true,
      message: "Procurement requests retrieved successfully",
      data: requests,
      requests,
      pagination,
    });
  } catch (error) {
    return next(error);
  }
}

// ============================================================
// GET SINGLE PROCUREMENT REQUEST
// GET /api/v1/procurement/:id
// ============================================================

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

// ============================================================
// CREATE PROCUREMENT REQUEST
// POST /api/v1/procurement
// ============================================================

export async function createRequest(req, res, next) {
  try {
    const request = await procurementService.createRequest(
      getActor(req),
      req.validatedBody ?? req.body
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

// ============================================================
// UPDATE PROCUREMENT REQUEST
// PATCH /api/v1/procurement/:id
// ============================================================

export async function updateRequest(req, res, next) {
  try {
    const request = await procurementService.updateRequest(
      getActor(req),
      req.params.id,
      req.validatedBody ?? req.body
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

// ============================================================
// SUBMIT PROCUREMENT REQUEST
// POST /api/v1/procurement/:id/submit
// ============================================================

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
    return next(error);
  }
}

// ============================================================
// RECOVER SUBMITTED REQUEST
// POST /api/v1/procurement/requests/:id/recover
// Admin-only service operation.
// Starts the approval workflow for a SUBMITTED request that
// does not yet have a workflow_run_id.
// ============================================================

export async function recoverSubmittedRequest(req, res, next) {
  try {
    const request =
      await procurementService.recoverSubmittedRequest(
        getActor(req),
        req.params.id
      );

    return res.status(200).json({
      success: true,
      message:
        "Submitted procurement request recovered and approval workflow started successfully",
      data: request,
      request,
    });
  } catch (error) {
    return next(error);
  }
}

// ============================================================
// MANAGER APPROVAL / REJECTION
// PATCH /api/v1/procurement/requests/:id/manager-decision
// ============================================================

export async function managerDecision(req, res, next) {
  try {
    const request = await procurementService.managerDecision({
      ...getContext(req),
      requestId: req.params.id,
      decision: req.body?.decision,
      comment: req.body?.comment,
    });

    return res.status(200).json({
      success: true,
      message: "Manager decision recorded successfully",
      data: request,
      request,
    });
  } catch (error) {
    return next(error);
  }
}

// ============================================================
// FINANCE APPROVAL / REJECTION
// PATCH /api/v1/procurement/requests/:id/finance-decision
// ============================================================

export async function financeDecision(req, res, next) {
  try {
    const request = await procurementService.financeDecision({
      ...getContext(req),
      requestId: req.params.id,
      decision: req.body?.decision,
      comment: req.body?.comment,
    });

    return res.status(200).json({
      success: true,
      message: "Finance decision recorded successfully",
      data: request,
      request,
    });
  } catch (error) {
    return next(error);
  }
}
