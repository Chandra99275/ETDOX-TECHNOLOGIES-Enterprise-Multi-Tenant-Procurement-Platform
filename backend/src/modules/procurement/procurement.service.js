import * as procurementRepository from "./procurement.repository.js";

const PROCUREMENT_ROLES = new Set([
  "admin",
  "employee",
  "manager",
  "finance",
]);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

<<<<<<< HEAD
function requireContext(tenantId, userId) {
  if (!tenantId || !userId) {
    throw appError(
      403,
      'Authenticated user and tenant context are required.',
      'TENANT_CONTEXT_REQUIRED'
    );
  }
}

function isFinanceOrAdmin(roles = []) {
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

function isManagerOrAdmin(roles = []) {
  const normalized = roles.map((role) =>
    String(typeof role === 'string' ? role : role?.name ?? '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );

  return normalized.some((role) =>
    [
      'admin',
      'organization_admin',
      'manager',
      'department_manager',
      'procurement_manager',
      'approver',
    ].includes(role)
  );
}

function canViewAllRequests(roles = []) {
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
      'manager',
      'department_manager',
      'procurement_manager',
      'procurement_specialist',
      'approver',
      'auditor',
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
    canViewAll: canViewAllRequests(roles),
  });

=======
function normalizeActor(actor) {
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
  return {
    id: actor?.id ?? actor?.userId,
    tenantId: actor?.tenantId ?? actor?.tenant_id,
    role: String(actor?.role ?? "").toLowerCase(),
  };
}

function requireActor(actor) {
  const normalized = normalizeActor(actor);

<<<<<<< HEAD
  const request = await procurementRepository.findById({
    tenantId,
    requestId,
    userId,
    canViewAll: canViewAllRequests(roles),
  });
=======
  if (!normalized.id || !normalized.tenantId) {
    throw httpError(
      "Authenticated user and tenant information are required",
      401
    );
  }

  if (!PROCUREMENT_ROLES.has(normalized.role)) {
    throw httpError(
      "Your account does not have procurement access",
      403
    );
  }

  return normalized;
}

export async function listRequests(actor, query) {
  const user = requireActor(actor);

  return procurementRepository.listRequests(
    user.tenantId,
    query
  );
}

export async function getRequest(actor, requestId) {
  const user = requireActor(actor);

  const request = await procurementRepository.findRequestById(
    user.tenantId,
    requestId
  );
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

  if (!request) {
    throw httpError("Procurement request not found", 404);
  }

  // Managers, finance users, and administrators can view requests
  // within their own tenant. Employees can view only their own.
  if (
    user.role === "employee" &&
    String(request.requesterId) !== String(user.id)
  ) {
    throw httpError("You cannot access this procurement request", 403);
  }

  return request;
}

export async function createRequest(actor, input) {
  const user = requireActor(actor);

<<<<<<< HEAD
  const rawTitle = input.title || input.productName || 'Purchase Request';
  const title = cleanText(rawTitle, 'Title', 200);

  const rawDescription = input.description || input.justification || title;
  const description = cleanText(rawDescription, 'Description', 5000);

  const rawAmount = input.amount !== undefined ? input.amount : input.total;
  const amount = validateAmount(rawAmount);

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
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    department: input.department,
    budgetId: input.budgetId,
    supplier: input.supplier,
  });
=======
  return procurementRepository.createRequest(
    user.tenantId,
    user.id,
    input
  );
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
}

export async function updateRequest(actor, requestId, input) {
  const user = requireActor(actor);

  if (user.role === "finance") {
    throw httpError(
      "Finance users cannot edit procurement request details",
      403
    );
  }

  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    const existing = await procurementRepository.findRequestById(
      user.tenantId,
      requestId
    );

    if (!existing) {
      throw httpError("Procurement request not found", 404);
    }

    if (String(existing.requesterId) !== String(user.id)) {
      throw httpError(
        "You can only edit your own procurement requests",
        403
      );
    }

    if (!["draft", "pending"].includes(existing.status)) {
      throw httpError(
        "Only draft or pending requests can be edited",
        409
      );
    }
  }

  return procurementRepository.updateRequest(
    user.tenantId,
    requestId,
    user.id,
    isAdmin,
    input
  );
}

export async function submitRequest(actor, requestId) {
  const user = requireActor(actor);

  if (user.role === "finance") {
    throw httpError(
      "Finance users cannot submit procurement requests",
      403
    );
  }

  const existing = await procurementRepository.findRequestById(
    user.tenantId,
    requestId
  );

  if (!existing) {
    throw httpError("Procurement request not found", 404);
  }

  if (
    user.role !== "admin" &&
    String(existing.requesterId) !== String(user.id)
  ) {
    throw httpError(
      "You can only submit your own procurement requests",
      403
    );
  }

  if (!["draft", "pending"].includes(existing.status)) {
    throw httpError(
      "This request cannot be submitted in its current status",
      409
    );
  }

  return procurementRepository.submitRequest(
    user.tenantId,
    requestId,
<<<<<<< HEAD
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

export async function managerDecision({
  tenantId,
  userId,
  roles = [],
  requestId,
  decision,
  comment,
}) {
  requireContext(tenantId, userId);
  validateId(requestId);

  if (!isManagerOrAdmin(roles)) {
    throw appError(
      403,
      'Only managers or authorized administrators can decide requests.',
      'MANAGER_PERMISSION_REQUIRED'
    );
  }

  const normalizedDecision =
    typeof decision === 'string' ? decision.trim().toLowerCase() : '';

  if (!['accept', 'approve', 'decline', 'reject'].includes(normalizedDecision)) {
    throw appError(
      400,
      'Decision must be approve or reject.',
      'INVALID_MANAGER_DECISION'
    );
  }

  const normalizedComment = comment?.trim() || null;

  if (normalizedComment && normalizedComment.length > 2000) {
    throw appError(
      400,
      'Comment must not exceed 2000 characters.',
      'INVALID_COMMENT'
    );
  }

  const result = await procurementRepository.recordManagerDecision({
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
      'Request not found or not eligible for a manager decision.',
      'MANAGER_DECISION_CONFLICT'
    );
  }

  return result;
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
=======
    user.id,
    user.role === "admin"
  );
}
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
