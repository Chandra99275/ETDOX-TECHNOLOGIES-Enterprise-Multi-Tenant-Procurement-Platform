import * as approvalsService from './approvals.service.js';

function getContext(req) {
  return {
    tenantId: req.tenantId ?? req.user?.tenantId,
    userId: req.user?.id,
    roles: req.user?.roles ?? [],
  };
}

export async function listApprovals(req, res, next) {
  try {
    const result = await approvalsService.listApprovals({
      ...getContext(req),
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });

    res.status(200).json({
      success: true,
      data: result.approvals,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getApproval(req, res, next) {
  try {
    const approval = await approvalsService.getApproval({
      ...getContext(req),
      approvalId: req.params.id,
    });

    res.status(200).json({
      success: true,
      data: approval,
    });
  } catch (error) {
    next(error);
  }
}

export async function decideApproval(req, res, next) {
  try {
    const approval = await approvalsService.decideApproval({
      ...getContext(req),
      approvalId: req.params.id,
      decision: req.body?.decision ?? req.body?.action,
      comment: req.body?.comment,
    });

    res.status(200).json({
      success: true,
      message: 'Approval decision recorded successfully.',
      data: approval,
    });
  } catch (error) {
    next(error);
  }
}