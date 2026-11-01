import {
  createAuditEvent,
  listAuditEvents,
  getAuditEventById,
} from "./audit.repository.js";

const ALLOWED_ACTIONS = new Set([
  "create",
  "read",
  "update",
  "delete",
  "submit",
  "approve",
  "reject",
  "cancel",
  "login",
  "logout",
  "export",
  "assign",
  "restore",
  "payment",
  "other",
]);

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_ENTITY_TYPE_LENGTH = 100;
const MAX_ACTION_LENGTH = 50;

function getTenantId(user) {
  return (
    user?.tenantId ??
    user?.tenant_id ??
    user?.tenant?.id ??
    null
  );
}

function getUserId(user) {
  return user?.id ?? user?.userId ?? user?.user_id ?? null;
}

function normalizeString(value, maxLength) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  if (!normalized) return null;

  return normalized.slice(0, maxLength);
}

function validateJsonValue(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error("Value cannot be serialized.");
    }

    if (serialized.length > 100_000) {
      const error = new Error(
        `${fieldName} exceeds the maximum supported size.`
      );
      error.statusCode = 400;
      throw error;
    }

    return JSON.parse(serialized);
  } catch (error) {
    if (error.statusCode) throw error;

    const validationError = new Error(
      `${fieldName} must contain valid JSON-compatible data.`
    );

    validationError.statusCode = 400;
    throw validationError;
  }
}

function requireUser(user) {
  if (!user) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  const tenantId = getTenantId(user);

  if (!tenantId) {
    const error = new Error(
      "The authenticated user does not have a tenant assigned."
    );
    error.statusCode = 403;
    throw error;
  }

  return {
    tenantId,
    userId: getUserId(user),
  };
}

function getRoles(user) {
  const values = [
    user?.role,
    user?.roles,
    user?.permissions?.role,
  ].flat();

  return values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
}

function requireAuditAccess(user) {
  const identity = requireUser(user);
  const roles = getRoles(user);

  if (!roles.some((role) => ["admin", "manager"].includes(role))) {
    const error = new Error(
      "You do not have permission to view audit history."
    );
    error.statusCode = 403;
    throw error;
  }

  return identity;
}

function validateDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    const error = new Error(`${fieldName} must be a valid date.`);
    error.statusCode = 400;
    throw error;
  }

  return new Date(value).toISOString();
}

/**
 * Record an audit event.
 *
 * Example:
 * await logAuditEvent({
 *   user: req.user,
 *   action: "update",
 *   entityType: "purchase_request",
 *   entityId: requestId,
 *   description: "Purchase request updated",
 *   oldValues: { status: "pending" },
 *   newValues: { status: "approved" },
 *   request: req
 * });
 */
export async function logAuditEvent({
  user,
  action,
  entityType,
  entityId = null,
  description = null,
  oldValues = null,
  newValues = null,
  metadata = null,
  request = null,
}) {
  const identity = requireUser(user);

  const normalizedAction = normalizeString(action, MAX_ACTION_LENGTH);
  const normalizedEntityType = normalizeString(
    entityType,
    MAX_ENTITY_TYPE_LENGTH
  );

  if (!normalizedAction || !ALLOWED_ACTIONS.has(normalizedAction)) {
    const error = new Error(
      `Invalid audit action. Allowed actions: ${[
        ...ALLOWED_ACTIONS,
      ].join(", ")}.`
    );

    error.statusCode = 400;
    throw error;
  }

  if (!normalizedEntityType) {
    const error = new Error("entityType is required.");
    error.statusCode = 400;
    throw error;
  }

  if (entityId !== null && entityId !== undefined) {
    if (!["string", "number"].includes(typeof entityId)) {
      const error = new Error("entityId must be a string or number.");
      error.statusCode = 400;
      throw error;
    }
  }

  const normalizedDescription =
    description === null
      ? null
      : normalizeString(description, MAX_DESCRIPTION_LENGTH);

  const safeOldValues = validateJsonValue(oldValues, "oldValues");
  const safeNewValues = validateJsonValue(newValues, "newValues");
  const safeMetadata = validateJsonValue(metadata, "metadata");

  // Record only request metadata, never authentication tokens or cookies.
  const ipAddress =
    request?.ip ??
    request?.socket?.remoteAddress ??
    null;

  const userAgent = normalizeString(
    request?.get?.("user-agent") ?? "",
    500
  );

  return createAuditEvent({
    tenantId: identity.tenantId,
    actorId: identity.userId,
    action: normalizedAction,
    entityType: normalizedEntityType,
    entityId: entityId === null ? null : String(entityId),
    description: normalizedDescription,
    oldValues: safeOldValues,
    newValues: safeNewValues,
    metadata: safeMetadata,
    ipAddress,
    userAgent,
  });
}

/**
 * List audit events for the authenticated user's tenant.
 * Viewing the audit trail is restricted to admins and managers.
 */
export async function getAuditTrail(user, filters = {}) {
  const identity = requireAuditAccess(user);

  const normalizedFilters = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
  };

  if (filters.action !== undefined && filters.action !== "") {
    const action = normalizeString(filters.action, MAX_ACTION_LENGTH);

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      const error = new Error("Invalid audit action filter.");
      error.statusCode = 400;
      throw error;
    }

    normalizedFilters.action = action;
  }

  if (filters.entityType !== undefined && filters.entityType !== "") {
    const entityType = normalizeString(
      filters.entityType,
      MAX_ENTITY_TYPE_LENGTH
    );

    if (!entityType) {
      const error = new Error("Invalid entityType filter.");
      error.statusCode = 400;
      throw error;
    }

    normalizedFilters.entityType = entityType;
  }

  if (filters.entityId !== undefined && filters.entityId !== "") {
    normalizedFilters.entityId = String(filters.entityId);
  }

  if (filters.actorId !== undefined && filters.actorId !== "") {
    normalizedFilters.actorId = String(filters.actorId);
  }

  normalizedFilters.from = validateDate(filters.from, "from");
  normalizedFilters.to = validateDate(filters.to, "to");

  if (
    normalizedFilters.from &&
    normalizedFilters.to &&
    new Date(normalizedFilters.from) > new Date(normalizedFilters.to)
  ) {
    const error = new Error(
      "The from date must be earlier than or equal to the to date."
    );
    error.statusCode = 400;
    throw error;
  }

  return listAuditEvents(identity.tenantId, normalizedFilters);
}

/**
 * Retrieve one audit event, scoped to the user's tenant.
 */
export async function getAuditEvent(user, auditId) {
  const identity = requireAuditAccess(user);

  if (
    auditId === undefined ||
    auditId === null ||
    String(auditId).trim() === ""
  ) {
    const error = new Error("A valid audit event ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const event = await getAuditEventById(identity.tenantId, auditId);

  if (!event) {
    const error = new Error("Audit event not found.");
    error.statusCode = 404;
    throw error;
  }

  return event;
}