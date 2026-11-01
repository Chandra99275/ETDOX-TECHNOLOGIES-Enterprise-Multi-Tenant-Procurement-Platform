// backend/src/modules/notifications/notifications.controller.js

import {
  listNotificationsService,
  getNotificationService,
  createNotificationService,
  markNotificationReadService,
  markAllNotificationsReadService,
  deleteNotificationService,
} from "./notifications.service.js";

function handleError(res, error) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  if (statusCode >= 500) {
    console.error("[Notifications]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An error occurred while processing notifications."
        : error.message,
  });
}

export async function listNotificationsController(req, res) {
  try {
    const result = await listNotificationsService(req.user, req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getNotificationController(req, res) {
  try {
    const notification = await getNotificationService(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createNotificationController(req, res) {
  try {
    const notification = await createNotificationService(
      req.user,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Notification created successfully.",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function markNotificationReadController(req, res) {
  try {
    const notification = await markNotificationReadService(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function markAllNotificationsReadController(req, res) {
  try {
    const result = await markAllNotificationsReadService(req.user);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function deleteNotificationController(req, res) {
  try {
    const result = await deleteNotificationService(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}