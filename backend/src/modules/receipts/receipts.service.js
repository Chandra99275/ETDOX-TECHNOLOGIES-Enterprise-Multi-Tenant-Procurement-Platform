// backend/src/modules/receipts/receipts.service.js

import {
  listReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  deleteReceipt,
} from "./receipts.repository.js";

const RECEIPT_STATUSES = new Set([
  "pending",
  "partially_received",
  "received",
  "accepted",
  "rejected",
  "cancelled",
]);

const RECEIPT_FIELDS = [
  "purchaseOrderId",
  "purchaseOrderItemId",
  "productId",
  "description",
  "orderedQuantity",
  "receivedQuantity",
  "acceptedQuantity",
  "rejectedQuantity",
  "unit",
  "status",
  "receivedAt",
  "notes",
];

function getRole(user) {
  const role = user?.role ?? user?.roles?.[0]?.name ?? user?.roles?.[0];
  return String(role ?? "").toLowerCase();
}

function assertAuthenticated(user) {
  if (!user?.id) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }
}

function getTenantId(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    const error = new Error("Your account does not have a tenant ID.");
    error.statusCode = 403;
    throw error;
  }

  return tenantId;
}

function assertCanCreateOrUpdate(user) {
  assertAuthenticated(user);

  if (!["admin", "manager", "employee"].includes(getRole(user))) {
    const error = new Error(
      "You do not have permission to record or update goods receipts.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function assertCanDelete(user) {
  assertAuthenticated(user);

  if (!["admin", "manager"].includes(getRole(user))) {
    const error = new Error(
      "Only administrators or managers can delete goods receipts.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function normalizeInput(body = {}) {
  const input = {};

  for (const field of RECEIPT_FIELDS) {
    if (body[field] === undefined) continue;

    const value = body[field];

    input[field] =
      typeof value === "string" ? value.trim() : value;
  }

  return input;
}

function validateReceipt(input, { partial = false } = {}) {
  if (!partial && !input.purchaseOrderId) {
    const error = new Error("purchaseOrderId is required.");
    error.statusCode = 400;
    throw error;
  }

  const quantityFields = [
    "orderedQuantity",
    "receivedQuantity",
    "acceptedQuantity",
    "rejectedQuantity",
  ];

  for (const field of quantityFields) {
    if (input[field] === undefined) continue;

    const quantity = Number(input[field]);

    if (!Number.isFinite(quantity) || quantity < 0) {
      const error = new Error(
        `${field} must be a non-negative number.`,
      );
      error.statusCode = 400;
      throw error;
    }

    input[field] = quantity;
  }

  if (
    input.acceptedQuantity !== undefined &&
    input.receivedQuantity !== undefined &&
    input.acceptedQuantity > input.receivedQuantity
  ) {
    const error = new Error(
      "acceptedQuantity cannot exceed receivedQuantity.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    input.rejectedQuantity !== undefined &&
    input.receivedQuantity !== undefined &&
    input.rejectedQuantity > input.receivedQuantity
  ) {
    const error = new Error(
      "rejectedQuantity cannot exceed receivedQuantity.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    input.acceptedQuantity !== undefined &&
    input.rejectedQuantity !== undefined &&
    input.receivedQuantity !== undefined &&
    input.acceptedQuantity + input.rejectedQuantity >
      input.receivedQuantity
  ) {
    const error = new Error(
      "Accepted and rejected quantities cannot total more than receivedQuantity.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    input.status !== undefined &&
    !RECEIPT_STATUSES.has(input.status)
  ) {
    const error = new Error(
      `Invalid receipt status. Allowed values: ${[
        ...RECEIPT_STATUSES,
      ].join(", ")}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (input.receivedAt !== undefined) {
    const date = new Date(input.receivedAt);

    if (Number.isNaN(date.getTime())) {
      const error = new Error("receivedAt must be a valid date.");
      error.statusCode = 400;
      throw error;
    }
  }

  for (const field of ["description", "unit", "notes"]) {
    if (
      input[field] !== undefined &&
      typeof input[field] === "string" &&
      input[field].length > 2000
    ) {
      const error = new Error(`${field} is too long.`);
      error.statusCode = 400;
      throw error;
    }
  }

  return input;
}

export async function listGoodsReceipts(user, query = {}) {
  assertAuthenticated(user);

  return listReceipts(getTenantId(user), {
    purchaseOrderId: query.purchaseOrderId,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });
}

export async function getGoodsReceipt(user, id) {
  assertAuthenticated(user);

  const receipt = await getReceiptById(getTenantId(user), id);

  if (!receipt) {
    const error = new Error("Goods receipt item not found.");
    error.statusCode = 404;
    throw error;
  }

  return receipt;
}

export async function createGoodsReceipt(user, body = {}) {
  assertCanCreateOrUpdate(user);

  const input = validateReceipt(normalizeInput(body));

  if (input.status === undefined) {
    input.status = "pending";
  }

  if (input.receivedAt === undefined) {
    input.receivedAt = new Date().toISOString();
  }

  return createReceipt(getTenantId(user), input, user.id);
}

export async function updateGoodsReceipt(user, id, body = {}) {
  assertCanCreateOrUpdate(user);

  const input = validateReceipt(normalizeInput(body), {
    partial: true,
  });

  if (Object.keys(input).length === 0) {
    const error = new Error("Provide at least one field to update.");
    error.statusCode = 400;
    throw error;
  }

  const receipt = await updateReceipt(getTenantId(user), id, input);

  if (!receipt) {
    const error = new Error("Goods receipt item not found.");
    error.statusCode = 404;
    throw error;
  }

  return receipt;
}

export async function removeGoodsReceipt(user, id) {
  assertCanDelete(user);

  const deleted = await deleteReceipt(getTenantId(user), id);

  if (!deleted) {
    const error = new Error("Goods receipt item not found.");
    error.statusCode = 404;
    throw error;
  }

  return {
    message: "Goods receipt item deleted successfully.",
  };
}