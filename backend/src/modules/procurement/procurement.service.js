import * as procurementRepository from './procurement.repository.js';

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

function isFinanceOrAdmin(roles) {
  const normalized = roles.map((role) =>
    String(typeof role === 'string' ? role : role?.name ?? '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );

  return normalized.some((role) =>
    [
      'admin',
      'organization_admin',
      'finance',
      'finance_manager',
    ].includes(role)
  );
}

function validateId(id) {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw appError(400, 'Invalid purchase request ID.', 'INVALID_ID');
  }
}

function cleanText(value, field, maxLength = 2000) {
  if (typeof value !== 'string' || !value.trim()) {
    throw appError(400, `${field} is required.`, 'VALIDATION_ERROR');
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw appError(
      400,
      `${field} exceeds the maximum length of ${maxLength}.`,
      'VALIDATION_ERROR'
    );
  }

  return text;
}

function validateAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    throw appError(
      400,
      'Amount must be a positive valid number.',
      'INVALID_AMOUNT'
    );
  }

  return amount;
}

export async function listRequests({
  tenantId,
  userId,
  roles = [],
  page = 1,
  limit = 20,
  status,
  search = '',
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
    throw appError(400, 'Invalid status filter.', 'VALIDATION_ERROR');
  }

  if (typeof search !== 'string') {
    throw appError(400, 'Invalid search filter.', 'VALIDATION_ERROR');
  }

  const result = await procurementRepository.listRequests({
    tenantId,
    page: parsedPage,
    limit: parsedLimit,
    status: status?.trim() || null,
    search: search.trim().slice(0, 100),
    userId,
    canViewAll: isFinanceOrAdmin(roles),
  });

  return {
    requests: result.requests,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: result.total,
      totalPages: Math.ceil(result.total / parsedLimit),
    },
  };
}

export async function getRequest({
  tenantId,
  userId,
  roles = [],
  requestId,
}) {
  requireContext(tenantId, userId);
  validateId(requestId);

  const request = await procurementRepository.findById({
    tenantId,
    requestId,
    userId,
    canViewAll: isFinanceOrAdmin(roles),
  });

  if (!request) {
    throw appError(404, 'Purchase request not found.', 'REQUEST_NOT_FOUND');
  }

  return request;
}

export async function createRequest({
  tenantId,
  userId,
  input = {},
}) {
  requireContext(tenantId, userId);

  const title = cleanText(input.title, 'Title', 200);
  const description = cleanText(
    input.description,
    'Description',
    5000
  );
  const amount = validateAmount(input.amount);

  const currency = String(input.currency ?? 'INR').trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw appError(
      400,
      'Currency must be a valid three-letter currency code.',
      'INVALID_CURRENCY'
    );
  }

  return procurementRepository.createRequest({
    tenantId,
    requesterId: userId,
    title,
    description,
    amount,
    currency,
  });
}

export async function updateRequest({
  tenantId,
  userId,
  roles = [],
  requestId,
  input = {},
}) {
  requireContext(tenantId, userId);
  validateId(requestId);

  const updates = {};

  if (input.title !== undefined) {
    updates.title = cleanText(input.title, 'Title', 200);
  }

  if (input.description !== undefined) {
    updates.description = cleanText(
      input.description,
      'Description',
      5000
    );
  }

  if (input.amount !== undefined) {
    updates.amount = validateAmount(input.amount);
  }

  if (input.currency !== undefined) {
    const currency = String(input.currency).trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw appError(400, 'Invalid currency code.', 'INVALID_CURRENCY');
    }

    updates.currency = currency;
  }

  if (Object.keys(updates).length === 0) {
    throw appError(
      400,
      'Provide at least one supported field to update.',
      'NO_UPDATE_FIELDS'
    );
  }

  const request = await procurementRepository.updateDraft({
    tenantId,
    requestId,
    userId,
    canManageAll: isFinanceOrAdmin(roles),
    updates,
  });

  if (!request) {
    throw appError(
      404,
      'Draft purchase request not found or cannot be edited.',
      'REQUEST_NOT_EDITABLE'
    );
  }

  return request;
}

export async function submitRequest({
  tenantId,
  userId,
  requestId,
}) {
  requireContext(tenantId, userId);
  validateId(requestId);

  const request = await procurementRepository.submitDraft({
    tenantId,
    requestId,
    userId,
  });

  if (!request) {
    throw appError(
      409,
      'Request was not found, is not yours, or is not a draft.',
      'REQUEST_NOT_SUBMITTABLE'
    );
  }

  return request;
}

export async function financeDecision({
  tenantId,
  userId,
  roles = [],
  requestId,
  decision,
  comment,
}) {
  requireContext(tenantId, userId);
  validateId(requestId);

  if (!isFinanceOrAdmin(roles)) {
    throw appError(
      403,
      'Only finance users or authorized administrators can decide requests.',
      'FINANCE_PERMISSION_REQUIRED'
    );
  }

  const normalizedDecision =
    typeof decision === 'string' ? decision.trim().toLowerCase() : '';

  if (!['accept', 'approve', 'decline', 'reject'].includes(normalizedDecision)) {
    throw appError(
      400,
      'Decision must be accept or decline.',
      'INVALID_FINANCE_DECISION'
    );
  }

  if (comment !== undefined && typeof comment !== 'string') {
    throw appError(400, 'Comment must be text.', 'INVALID_COMMENT');
  }

  const normalizedComment = comment?.trim() || null;

  if (normalizedComment && normalizedComment.length > 2000) {
    throw appError(
      400,
      'Comment must not exceed 2000 characters.',
      'INVALID_COMMENT'
    );
  }

  const result = await procurementRepository.recordFinanceDecision({
    tenantId,
    requestId,
    actorId: userId,
    decision: ['accept', 'approve'].includes(normalizedDecision)
      ? 'approved'
      : 'rejected',
    comment: normalizedComment,
  });

  if (!result) {
    throw appError(
      409,
      'Request not found or not eligible for a finance decision.',
      'FINANCE_DECISION_CONFLICT'
    );
  }

  return result;
}