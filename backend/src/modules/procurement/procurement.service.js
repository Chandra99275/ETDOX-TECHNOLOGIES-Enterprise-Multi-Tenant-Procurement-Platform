
import * as procurementRepository from "./procurement.repository.js";

// ============================================================
// CONSTANTS
// ============================================================

const PROCUREMENT_ROLES = new Set([
  "admin",
  "organization_admin",
  "employee",
  "requester",
  "manager",
  "department_manager",
  "procurement_manager",
  "procurement_specialist",
  "finance",
  "finance_manager",
  "auditor",
  "approver",
]);

const MANAGER_ROLES = new Set([
  "admin",
  "organization_admin",
  "manager",
  "department_manager",
  "procurement_manager",
  "approver",
]);

const FINANCE_ROLES = new Set([
  "admin",
  "organization_admin",
  "finance",
  "finance_manager",
]);

const VIEW_ALL_ROLES = new Set([
  ...MANAGER_ROLES,
  ...FINANCE_ROLES,
  "procurement_specialist",
  "auditor",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================================
// ERROR HELPERS
// ============================================================

function appError(
  statusCode,
  message,
  code = "PROCUREMENT_ERROR"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  return error;
}

// ============================================================
// ROLE NORMALIZATION
// ============================================================

function normalizeRole(role) {
  if (typeof role === "string") {
    return role
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  if (role && typeof role === "object") {
    return normalizeRole(
      role.name ??
      role.role ??
      role.role_name ??
      ""
    );
  }

  return "";
}

function normalizeRoles(actor) {
  const roles = [];

  if (actor?.role) {
    roles.push(actor.role);
  }

  if (actor?.roles) {
    roles.push(
      ...(Array.isArray(actor.roles)
        ? actor.roles
        : [actor.roles])
    );
  }

  if (actor?.user?.role) {
    roles.push(actor.user.role);
  }

  if (actor?.user?.roles) {
    roles.push(
      ...(Array.isArray(actor.user.roles)
        ? actor.user.roles
        : [actor.user.roles])
    );
  }

  return [
    ...new Set(
      roles.map(normalizeRole).filter(Boolean)
    ),
  ];
}

function normalizeActor(actor) {
  const id =
    actor?.id ??
    actor?.userId ??
    actor?.user_id ??
    actor?.sub ??
    actor?.user?.id ??
    actor?.user?.userId ??
    actor?.user?.user_id;

  const tenantId =
    actor?.tenantId ??
    actor?.tenant_id ??
    actor?.user?.tenantId ??
    actor?.user?.tenant_id ??
    actor?.user?.tenant?.id;

  const roles = normalizeRoles(actor);

  return {
    id: id == null ? "" : String(id),
    tenantId: tenantId == null ? "" : String(tenantId),
    roles,
    role: roles[0] || "",
  };
}

function requireContext(tenantId, userId) {
  if (!tenantId || !userId) {
    throw appError(
      401,
      "Authenticated user and tenant context are required.",
      "TENANT_CONTEXT_REQUIRED"
    );
  }

  if (
    !UUID_REGEX.test(String(userId)) ||
    !UUID_REGEX.test(String(tenantId))
  ) {
    throw appError(
      401,
      "Invalid authenticated user or tenant context.",
      "INVALID_TENANT_CONTEXT"
    );
  }
}

function requireActor(actor) {
  const user = normalizeActor(actor);

  requireContext(user.tenantId, user.id);

  if (
    !user.roles.some((role) =>
      PROCUREMENT_ROLES.has(role)
    )
  ) {
    throw appError(
      403,
      "Your account does not have procurement access.",
      "PROCUREMENT_ACCESS_DENIED"
    );
  }

  return user;
}

function hasAnyRole(roles, allowedRoles) {
  return roles.some((role) =>
    allowedRoles.has(role)
  );
}

function canViewAllRequests(roles = []) {
  return hasAnyRole(roles, VIEW_ALL_ROLES);
}

function isManagerOrAdmin(roles = []) {
  return hasAnyRole(roles, MANAGER_ROLES);
}

function isFinanceOrAdmin(roles = []) {
  return hasAnyRole(roles, FINANCE_ROLES);
}

function isAdmin(roles = []) {
  return roles.some((role) =>
    ["admin", "organization_admin"].includes(role)
  );
}

// ============================================================
// VALIDATION
// ============================================================

function validateId(id) {
  if (
    typeof id !== "string" ||
    !UUID_REGEX.test(id)
  ) {
    throw appError(
      400,
      "Invalid purchase request ID.",
      "INVALID_ID"
    );
  }

  return id;
}

function cleanText(
  value,
  field,
  maxLength = 2000
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw appError(
      400,
      `${field} is required.`,
      "VALIDATION_ERROR"
    );
  }

  const cleaned = value.trim();

  if (cleaned.length > maxLength) {
    throw appError(
      400,
      `${field} exceeds ${maxLength} characters.`,
      "VALIDATION_ERROR"
    );
  }

  return cleaned;
}

function optionalText(
  value,
  field,
  maxLength = 2000
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return cleanText(value, field, maxLength);
}

function validateAmount(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    throw appError(
      400,
      "Amount must be a positive valid number.",
      "INVALID_AMOUNT"
    );
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000_000
  ) {
    throw appError(
      400,
      "Amount must be a positive valid number.",
      "INVALID_AMOUNT"
    );
  }

  return amount;
}

function validateCurrency(value = "INR") {
  if (typeof value !== "string") {
    throw appError(
      400,
      "Currency must be a valid three-letter code.",
      "INVALID_CURRENCY"
    );
  }

  const currency = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw appError(
      400,
      "Currency must be a valid three-letter code.",
      "INVALID_CURRENCY"
    );
  }

  return currency;
}

function validatePagination(
  page = 1,
  limit = 20
) {
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
      "Page must be positive and limit must be between 1 and 100.",
      "INVALID_PAGINATION"
    );
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
}

function normalizeDecision(decision) {
  if (typeof decision !== "string") {
    throw appError(
      400,
      "Decision must be approve or reject.",
      "INVALID_DECISION"
    );
  }

  const normalized = decision
    .trim()
    .toLowerCase();

  if (
    ![
      "accept",
      "approve",
      "approved",
      "decline",
      "reject",
      "rejected",
    ].includes(normalized)
  ) {
    throw appError(
      400,
      "Decision must be approve or reject.",
      "INVALID_DECISION"
    );
  }

  return [
    "accept",
    "approve",
    "approved",
  ].includes(normalized)
    ? "approved"
    : "rejected";
}

function normalizeComment(comment) {
  if (
    comment === undefined ||
    comment === null ||
    comment === ""
  ) {
    return null;
  }

  if (typeof comment !== "string") {
    throw appError(
      400,
      "Comment must be a string.",
      "INVALID_COMMENT"
    );
  }

  const normalized = comment.trim();

  if (normalized.length > 2000) {
    throw appError(
      400,
      "Comment must not exceed 2000 characters.",
      "INVALID_COMMENT"
    );
  }

  return normalized || null;
}

function getRequesterId(request) {
  return (
    request?.requesterId ??
    request?.requester_id ??
    request?.userId ??
    request?.user_id ??
    request?.createdBy ??
    request?.created_by
  );
}

function assertRequestAccess(user, request, action) {
  if (!request) {
    throw appError(
      404,
      "Procurement request not found.",
      "REQUEST_NOT_FOUND"
    );
  }

  if (
    !canViewAllRequests(user.roles) &&
    String(getRequesterId(request)) !== user.id
  ) {
    throw appError(
      403,
      `You cannot ${action} this procurement request.`,
      "REQUEST_ACCESS_DENIED"
    );
  }
}

// ============================================================
// LIST PROCUREMENT REQUESTS
// ============================================================

export async function listRequests(
  actor,
  query = {}
) {
  const user = requireActor(actor);

  const { page, limit } = validatePagination(
    query.page ?? 1,
    query.limit ?? 20
  );

  if (
    query.status !== undefined &&
    typeof query.status !== "string"
  ) {
    throw appError(
      400,
      "Invalid status filter.",
      "VALIDATION_ERROR"
    );
  }

  if (
    query.search !== undefined &&
    typeof query.search !== "string"
  ) {
    throw appError(
      400,
      "Invalid search filter.",
      "VALIDATION_ERROR"
    );
  }

  return procurementRepository.listRequests({
    tenantId: user.tenantId,
    userId: user.id,
    page,
    limit,
    status: query.status?.trim() || null,
    search: (query.search || "")
      .trim()
      .slice(0, 100),
    canViewAll: canViewAllRequests(user.roles),
  });
}

// ============================================================
// GET SINGLE REQUEST
// ============================================================

export async function getRequest(
  actor,
  requestId
) {
  const user = requireActor(actor);

  validateId(requestId);

  const request =
    await procurementRepository.findRequestById(
      user.tenantId,
      requestId
    );

  assertRequestAccess(
    user,
    request,
    "access"
  );

  return request;
}

// ============================================================
// CREATE REQUEST
// ============================================================

export async function createRequest(
  actor,
  input = {}
) {
  const user = requireActor(actor);

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw appError(
      400,
      "A valid request body is required.",
      "VALIDATION_ERROR"
    );
  }

  if (
    isFinanceOrAdmin(user.roles) &&
    !isAdmin(user.roles)
  ) {
    throw appError(
      403,
      "Finance users cannot create procurement requests.",
      "FINANCE_CREATE_DENIED"
    );
  }

  const title = cleanText(
    input.title ||
    input.productName ||
    "Purchase Request",
    "Title",
    200
  );

  const description = cleanText(
    input.description ||
    input.justification ||
    title,
    "Description",
    5000
  );

  const amount = validateAmount(
    input.amount !== undefined
      ? input.amount
      : input.total
  );

  const currency = validateCurrency(
    input.currency ?? "INR"
  );

  let quantity = null;

  if (
    input.quantity !== undefined &&
    input.quantity !== null
  ) {
    quantity = Number(input.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000000
    ) {
      throw appError(
        400,
        "Quantity must be a positive whole number.",
        "INVALID_QUANTITY"
      );
    }
  }

  const unitPrice =
    input.unitPrice !== undefined &&
    input.unitPrice !== null
      ? validateAmount(input.unitPrice)
      : null;

  return procurementRepository.createRequest({
    tenantId: user.tenantId,
    requesterId: user.id,
    title,
    description,
    amount,
    currency,
    quantity,
    unitPrice,
    department: optionalText(
      input.department,
      "Department",
      200
    ),
    budgetId: input.budgetId || null,
    supplier: optionalText(
      input.supplier,
      "Supplier",
      300
    ),
  });
}

// ============================================================
// UPDATE REQUEST
// ============================================================

export async function updateRequest(
  actor,
  requestId,
  input = {}
) {
  const user = requireActor(actor);

  validateId(requestId);

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw appError(
      400,
      "A valid request body is required.",
      "VALIDATION_ERROR"
    );
  }

  if (
    isFinanceOrAdmin(user.roles) &&
    !isAdmin(user.roles)
  ) {
    throw appError(
      403,
      "Finance users cannot edit procurement request details.",
      "FINANCE_EDIT_DENIED"
    );
  }

  const existing =
    await procurementRepository.findRequestById(
      user.tenantId,
      requestId
    );

  assertRequestAccess(
    user,
    existing,
    "edit"
  );

  if (
    String(existing.status || "").toUpperCase() !==
    "DRAFT"
  ) {
    throw appError(
      409,
      "Only draft procurement requests can be edited.",
      "REQUEST_EDIT_CONFLICT"
    );
  }

  const changes = {};

  if (
    input.title !== undefined ||
    input.productName !== undefined
  ) {
    changes.title = cleanText(
      input.title ?? input.productName,
      "Title",
      200
    );
  }

  if (
    input.description !== undefined ||
    input.justification !== undefined
  ) {
    changes.description = cleanText(
      input.description ?? input.justification,
      "Description",
      5000
    );
  }

  if (
    input.amount !== undefined ||
    input.total !== undefined
  ) {
    changes.amount = validateAmount(
      input.amount !== undefined
        ? input.amount
        : input.total
    );
  }

  if (input.currency !== undefined) {
    changes.currency = validateCurrency(
      input.currency
    );
  }

  if (input.department !== undefined) {
    changes.department = optionalText(
      input.department,
      "Department",
      200
    );
  }

  if (input.budgetId !== undefined) {
    changes.budgetId = input.budgetId || null;
  }

  if (input.supplier !== undefined) {
    changes.supplier = optionalText(
      input.supplier,
      "Supplier",
      300
    );
  }

  if (input.requiredByDate !== undefined) {
    changes.requiredByDate =
      input.requiredByDate || null;
  }

  return procurementRepository.updateRequest(
    user.tenantId,
    requestId,
    user.id,
    isAdmin(user.roles),
    changes
  );
}

// ============================================================
// SUBMIT REQUEST
// ============================================================

export async function submitRequest(
  actor,
  requestId
) {
  const user = requireActor(actor);

  validateId(requestId);

  if (
    isFinanceOrAdmin(user.roles) &&
    !isAdmin(user.roles)
  ) {
    throw appError(
      403,
      "Finance users cannot submit procurement requests.",
      "FINANCE_SUBMIT_DENIED"
    );
  }

  const existing =
    await procurementRepository.findRequestById(
      user.tenantId,
      requestId
    );

  assertRequestAccess(
    user,
    existing,
    "submit"
  );

  if (
    String(existing.status || "").toUpperCase() !==
    "DRAFT"
  ) {
    throw appError(
      409,
      "Only draft procurement requests can be submitted.",
      "REQUEST_NOT_SUBMITTABLE"
    );
  }

  const result =
    await procurementRepository.submitRequest(
      user.tenantId,
      requestId,
      user.id,
      isAdmin(user.roles)
    );

  if (!result) {
    throw appError(
      409,
      "Request was not found or is no longer eligible for submission.",
      "REQUEST_SUBMIT_CONFLICT"
    );
  }

  return result;
}

// ============================================================
// RECOVER EXISTING SUBMITTED REQUEST
// Admin-only recovery operation.
// ============================================================

export async function recoverSubmittedRequest(
  actor,
  requestId
) {
  const user = requireActor(actor);

  validateId(requestId);

  if (!isAdmin(user.roles)) {
    throw appError(
      403,
      "Only an organization administrator can recover a submitted request.",
      "REQUEST_RECOVERY_ADMIN_REQUIRED"
    );
  }

  const existing =
    await procurementRepository.findRequestById(
      user.tenantId,
      requestId
    );

  if (!existing) {
    throw appError(
      404,
      "Procurement request not found.",
      "REQUEST_NOT_FOUND"
    );
  }

  if (existing.workflowRunId) {
    throw appError(
      409,
      "This request already has an approval workflow.",
      "REQUEST_ALREADY_HAS_WORKFLOW"
    );
  }

  if (
    String(existing.status || "").toUpperCase() !==
    "SUBMITTED"
  ) {
    throw appError(
      409,
      "Only submitted requests without a workflow can be recovered.",
      "REQUEST_NOT_RECOVERABLE"
    );
  }

  const result =
    await procurementRepository.recoverSubmittedRequest(
      user.tenantId,
      requestId,
      user.id,
      true
    );

  if (!result) {
    throw appError(
      409,
      "The submitted request could not be recovered.",
      "REQUEST_RECOVERY_CONFLICT"
    );
  }

  return result;
}

// ============================================================
// MANAGER DECISION
// ============================================================

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

  const normalizedRoles = [
    ...new Set(
      (Array.isArray(roles) ? roles : [roles])
        .map(normalizeRole)
        .filter(Boolean)
    ),
  ];

  if (!isManagerOrAdmin(normalizedRoles)) {
    throw appError(
      403,
      "Only managers or authorized administrators can decide requests.",
      "MANAGER_PERMISSION_REQUIRED"
    );
  }

  const normalizedDecision =
    normalizeDecision(decision);

  const normalizedComment =
    normalizeComment(comment);

  const result =
    await procurementRepository.recordManagerDecision({
      tenantId,
      requestId,
      actorId: userId,
      decision: normalizedDecision,
      comment: normalizedComment,
    });

  if (!result) {
    throw appError(
      409,
      "Request not found or not eligible for a manager decision.",
      "MANAGER_DECISION_CONFLICT"
    );
  }

  return result;
}

// ============================================================
// FINANCE DECISION
// ============================================================

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

  const normalizedRoles = [
    ...new Set(
      (Array.isArray(roles) ? roles : [roles])
        .map(normalizeRole)
        .filter(Boolean)
    ),
  ];

  if (!isFinanceOrAdmin(normalizedRoles)) {
    throw appError(
      403,
      "Only finance users or authorized administrators can decide requests.",
      "FINANCE_PERMISSION_REQUIRED"
    );
  }

  const normalizedDecision =
    normalizeDecision(decision);

  const normalizedComment =
    normalizeComment(comment);

  const result =
    await procurementRepository.recordFinanceDecision({
      tenantId,
      requestId,
      actorId: userId,
      decision: normalizedDecision,
      comment: normalizedComment,
    });

  if (!result) {
    throw appError(
      409,
      "Request not found or not eligible for a finance decision.",
      "FINANCE_DECISION_CONFLICT"
    );
  }

  return result;
}
