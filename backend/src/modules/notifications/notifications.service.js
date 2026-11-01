// backend/src/modules/notifications/notifications.service.js

import {
  listNotifications,
  getNotificationById,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "./notifications.repository.js";

const ALLOWED_TYPES = new Set([
  "info",
  "success",
  "warning",
  "error",
  "approval",
  "purchase_order",
  "invoice",
  "system",
]);

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

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "1";
}

function normalizeNotification(body = {}) {
  const input = {};

  for (const field of [
    "recipientId",
    "title",
    "message",
    "type",
    "link",
    "metadata",
  ]) {
    if (body[field] !== undefined) {
      input[field] =
        typeof body[field] === "string"
          ? body[field].trim()
          : body[field];
    }
  }

  return input;
}

function validateNotification(input, { partial = false } = {}) {
  if (!partial) {
    if (!input.title) {
      const error = new Error("Notification title is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!input.message) {
      const error = new Error("Notification message is required.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (input.title !== undefined && input.title.length > 200) {
    const error = new Error("Notification title cannot exceed 200 characters.");
    error.statusCode = 400;
    throw error;
  }

  if (input.message !== undefined && input.message.length > 5000) {
    const error = new Error(
      "Notification message cannot exceed 5000 characters.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    input.type !== undefined &&
    !ALLOWED_TYPES.has(input.type)
  ) {
    const error = new Error(
      `Invalid notification type. Allowed types: ${[
        ...ALLOWED_TYPES,
      ].join(", ")}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    input.link !== undefined &&
    input.link !== "" &&
    (
      typeof input.link !== "string" ||
      !input.link.startsWith("/") ||
      input.link.startsWith("//")
    )
  ) {
    const error = new Error(
      "Notification link must be a relative application path.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    input.metadata !== undefined &&
    (
      input.metadata === null ||
      typeof input.metadata !== "object" ||
      Array.isArray(input.metadata)
    )
  ) {
    const error = new Error("metadata must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  return input;
}

export async function listNotificationsService(user, query = {}) {
  assertAuthenticated(user);

  return listNotifications(
    getTenantId(user),
    user.id,
    {
      page: query.page,
      limit: query.limit,
      unreadOnly: normalizeBoolean(query.unreadOnly),
    },
  );
}

export async function getNotificationService(user, notificationId) {
  assertAuthenticated(user);

  const notification = await getNotificationById(
    getTenantId(user),
    user.id,
    notificationId,
  );

  if (!notification) {
    const error = new Error("Notification not found.");
    error.statusCode = 404;
    throw error;
  }

  return notification;
}

export async function createNotificationService(user, body = {}) {
  assertAuthenticated(user);

  const input = validateNotification(normalizeNotification(body));
  const role = getRole(user);

  // Ordinary users can create only their own notifications.
  // Admins and managers may target another user in the same tenant.
  if (
    input.recipientId &&
    String(input.recipientId) !== String(user.id) &&
    !["admin", "manager"].includes(role)
  ) {
    const error = new Error(
      "You cannot create notifications for another user.",
    );
    error.statusCode = 403;
    throw error;
  }

  input.recipientId = input.recipientId ?? user.id;
  input.type = input.type ?? "info";

  return createNotification(getTenantId(user), input);
}

export async function markNotificationReadService(user, notificationId) {
  assertAuthenticated(user);

  const notification = await markNotificationRead(
    getTenantId(user),
    user.id,
    notificationId,
  );

  if (!notification) {
    const error = new Error("Notification not found.");
    error.statusCode = 404;
    throw error;
  }

  return notification;
}

export async function markAllNotificationsReadService(user) {
  assertAuthenticated(user);

  return markAllNotificationsRead(getTenantId(user), user.id);
}

export async function deleteNotificationService(user, notificationId) {
  assertAuthenticated(user);

  const deleted = await deleteNotification(
    getTenantId(user),
    user.id,
    notificationId,
  );

  if (!deleted) {
    const error = new Error("Notification not found.");
    error.statusCode = 404;
    throw error;
  }

  return { message: "Notification deleted successfully." };
}