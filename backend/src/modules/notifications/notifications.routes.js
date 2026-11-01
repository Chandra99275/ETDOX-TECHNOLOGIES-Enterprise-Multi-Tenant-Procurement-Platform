// backend/src/modules/notifications/notifications.routes.js

import { Router } from "express";

import {
  listNotificationsController,
  getNotificationController,
  createNotificationController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
} from "./notifications.controller.js";

import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// All notification endpoints require authentication.
router.use(authenticate);

// GET /api/v1/notifications
router.get("/", listNotificationsController);

// POST /api/v1/notifications
router.post("/", createNotificationController);

// POST /api/v1/notifications/read-all
// Keep this route before /:id.
router.post("/read-all", markAllNotificationsReadController);

// PATCH /api/v1/notifications/:id/read
router.patch("/:id/read", markNotificationReadController);

// GET /api/v1/notifications/:id
router.get("/:id", getNotificationController);

// DELETE /api/v1/notifications/:id
router.delete("/:id", deleteNotificationController);

export default router;