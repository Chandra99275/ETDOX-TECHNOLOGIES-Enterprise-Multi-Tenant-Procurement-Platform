// backend/src/modules/purchase-orders/purchase-orders.service.js

import {
  listPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "./purchase-orders.repository.js";

const WRITE_ROLES = new Set(["admin", "manager", "finance"]);

function normalizeRole(user) {
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

function assertCanWrite(user) {
  assertAuthenticated(user);

  if (!WRITE_ROLES.has(normalizeRole(user))) {
    const error = new Error(
      "You do not have permission to modify purchase orders.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function getTenantId(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    const error = new Error(
      "Your authenticated account does not have a tenant ID.",
    );
    error.statusCode = 403;
    throw error;
  }

  return tenantId;
}

function cleanString(value) {
  if (typeof value !== "string") return value;
  const cleaned = value.trim();
  return cleaned === "" ? undefined : cleaned;
}

function normalizeInput(input = {}) {
  const allowedFields = [
    "poNumber",
    "title",
    "description",
    "supplierId",
    "requestId",
    "status",
    "currency",
    "subtotal",
    "taxAmount",
    "totalAmount",
    "deliveryDate",
    "paymentTerms",
    "notes",
  ];

  const output = {};

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      output[field] =
        typeof input[field] === "string"
          ? cleanString(input[field])
          : input[field];
    }
  }

  return output;
}

function validatePurchaseOrder(input, { partial = false } = {}) {
  if (!partial && !input.supplierId) {
    const error = new Error("supplierId is required.");
    error.statusCode = 400;
    throw error;
  }

  if (input.poNumber !== undefined && input.poNumber.length > 100) {
    const error = new Error("poNumber must be 100 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }

  if (input.title !== undefined && input.title.length > 200) {
    const error = new Error("title must be 200 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }

  for (const field of ["subtotal", "taxAmount", "totalAmount"]) {
    if (input[field] === undefined) continue;

    const amount = Number(input[field]);

    if (!Number.isFinite(amount) || amount < 0) {
      const error = new Error(`${field} must be a non-negative number.`);
      error.statusCode = 400;
      throw error;
    }

    input[field] = amount;
  }

  if (input.deliveryDate !== undefined) {
    const date = new Date(input.deliveryDate);

    if (Number.isNaN(date.getTime())) {
      const error = new Error("deliveryDate must be a valid date.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    input.status !== undefined &&
    ![
      "draft",
      "pending",
      "submitted",
      "approved",
      "rejected",
      "cancelled",
      "ordered",
      "partially_received",
      "received",
      "closed",
    ].includes(input.status)
  ) {
    const error = new Error("Invalid purchase-order status.");
    error.statusCode = 400;
    throw error;
  }

  return input;
}

export async function listOrders(user, query = {}) {
  assertAuthenticated(user);

  const tenantId = getTenantId(user);

  return listPurchaseOrders(tenantId, {
    status: query.status,
    supplierId: query.supplierId,
    search: typeof query.search === "string" ? query.search.trim() : undefined,
    page: query.page,
    limit: query.limit,
  });
}

export async function getOrder(user, id) {
  assertAuthenticated(user);

  const order = await getPurchaseOrderById(getTenantId(user), id);

  if (!order) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  return order;
}

export async function createOrder(user, body = {}) {
  assertCanWrite(user);

  const input = validatePurchaseOrder(normalizeInput(body));

  if (!input.status) input.status = "draft";
  if (!input.currency) input.currency = "INR";

  return createPurchaseOrder(getTenantId(user), input, user.id);
}

export async function updateOrder(user, id, body = {}) {
  assertCanWrite(user);

  const input = validatePurchaseOrder(normalizeInput(body), {
    partial: true,
  });

  if (Object.keys(input).length === 0) {
    const error = new Error("Provide at least one field to update.");
    error.statusCode = 400;
    throw error;
  }

  const order = await updatePurchaseOrder(getTenantId(user), id, input);

  if (!order) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  return order;
}

export async function removeOrder(user, id) {
  assertCanWrite(user);

  const deleted = await deletePurchaseOrder(getTenantId(user), id);

  if (!deleted) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  return { message: "Purchase order deleted successfully." };
}