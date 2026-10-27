import * as approvalsRepository from './approvals.repository.js';

function appError(statusCode, message, code) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function requireContext(tenantId, userId) {
  if (!tenantId || !userId) {
    throw appError(
      403,
      'Authenticated user and tenant context are required.',
      'TENANT_CONTEXT_REQUIRED'
    );
  }
}

function normalizeRoles(roles = []) {
  return roles.map((role) =>
    String(typeof role === 'string' ? role : role?.name ?? '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );
}

function canManageAllApprovals(roles) {
  return normalizeRoles(roles).some((role) =>
    [
      'admin',
      'organization_admin',
      'organization_owner',
      'manager',
      'department_manager',
      'procurement_manager',
    ].includes(role)
  );
}

function validateId(id) {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw appError(400, 'Invalid approval ID.', 'INVALID_APPROVAL_ID');
  }
}

export async function listApprovals({
  tenantId,
  userId,
  roles = [],
  page = 1,
  limit = 20,
  status,
}) {
  requireContext(tenantId, userId);

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1 ||
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 100
  ) {
    throw appError(
      400,
      'Page must be positive and limit must be between 1 and 100.',
      'INVALID_PAGINATION'
    );
  }

  if (status !== undefined && typeof status !== 'string') {
    throw appError(400, 'Invalid status filter.', 'INVALID_STATUS');
  }

  const result = await approvalsRepository.listByTenant({
    tenantId,
    userId,
    canViewAll: canManageAllApprovals(roles),
    page: parsedPage,
    limit: parsedLimit,
    status: status?.trim() || null,
  });

  return {
    approvals: result.approvals,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: result.total,
      totalPages: Math.ceil(result.total / parsedLimit),
    },
  };
}

export async function getApproval({
  tenantId,
  userId,
  roles = [],
  approvalId,
}) {
  requireContext(tenantId, userId);
  validateId(approvalId);

  const approval = await approvalsRepository.findById({
    tenantId,
    userId,
    approvalId,
    canViewAll: canManageAllApprovals(roles),
  });

  if (!approval) {
    throw appError(404, 'Approval not found.', 'APPROVAL_NOT_FOUND');
  }

  return approval;
}

export async function decideApproval({
  tenantId,
  userId,
  approvalId,
  decision,
  comment,
}) {
  requireContext(tenantId, userId);
  validateId(approvalId);

  const normalizedDecision =
    typeof decision === 'string' ? decision.trim().toLowerCase() : '';

  const decisionMap = {
    approve: 'approved',
    approved: 'approved',
    reject: 'rejected',
    rejected: 'rejected',
    request_changes: 'changes_requested',
    'request changes': 'changes_requested',
  };

  const normalizedStatus = decisionMap[normalizedDecision];

  if (!normalizedStatus) {
    throw appError(
      400,
      'Decision must be approve, reject, or request_changes.',
      'INVALID_DECISION'
    );
  }

  if (comment !== undefined && typeof comment !== 'string') {
    throw appError(400, 'Comment must be text.', 'INVALID_COMMENT');
  }

  const cleanComment = comment?.trim() || null;

  if (cleanComment && cleanComment.length > 2000) {
    throw appError(
      400,
      'Comment cannot exceed 2000 characters.',
      'INVALID_COMMENT'
    );
  }

  if (normalizedStatus !== 'approved' && !cleanComment) {
    throw appError(
      400,
      'A comment is required when rejecting or requesting changes.',
      'COMMENT_REQUIRED'
    );
  }

  const approval = await approvalsRepository.recordDecision({
    tenantId,
    userId,
    approvalId,
    decision: normalizedStatus,
    comment: cleanComment,
  });

  if (!approval) {
    throw appError(
      409,
      'Approval not found, not assigned to you, or already decided.',
      'APPROVAL_NOT_PENDING'
    );
  }

  return approval;
}