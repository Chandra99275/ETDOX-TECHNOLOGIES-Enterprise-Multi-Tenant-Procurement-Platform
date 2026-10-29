import * as procurementService from './procurement.service.js';

function getContext(req) {
  return {
    tenantId: req.tenantId ?? req.user?.tenantId,
    userId: req.user?.id,
    roles: req.user?.roles ?? [],
  };
}

export async function listRequests(req, res, next) {
  try {
    const result = await procurementService.listRequests({
      ...getContext(req),
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      search: req.query.search,
    });

    res.status(200).json({
      success: true,
      data: result.requests,
      requests: result.requests, // compatibility
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRequest(req, res, next) {
  try {
    const request = await procurementService.getRequest({
      ...getContext(req),
      requestId: req.params.id,
    });

    res.status(200).json({
      success: true,
      data: request,
      request,
    });
  } catch (error) {
    next(error);
  }
}

export async function createRequest(req, res, next) {
  try {
    const request = await procurementService.createRequest({
      ...getContext(req),
      input: req.body,
    });

    res.status(201).json({
      success: true,
      message: 'Purchase request created successfully.',
      data: request,
      request,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRequest(req, res, next) {
  try {
    const request = await procurementService.updateRequest({
      ...getContext(req),
      requestId: req.params.id,
      input: req.body,
    });

    res.status(200).json({
      success: true,
      message: 'Purchase request updated successfully.',
      data: request,
      request,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitRequest(req, res, next) {
  try {
    const request = await procurementService.submitRequest({
      ...getContext(req),
      requestId: req.params.id,
    });

    res.status(200).json({
      success: true,
      message: 'Purchase request submitted successfully.',
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
  }
}
