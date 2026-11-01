import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { pathToFileURL } from "node:url";

import { QUEUE_NAMES } from "./queue.js";
import { createNotification } from "../modules/notifications/notifications.repository.js";

// --------------------------------------------------
// Redis connection
// --------------------------------------------------

function createWorkerRedisConnection() {
  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };

  if (process.env.REDIS_URL) {
    return new IORedis(process.env.REDIS_URL, options);
  }

  return new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || "0", 10),
    ...options,
  });
}

const connection = createWorkerRedisConnection();

// --------------------------------------------------
// Notification job validation
// --------------------------------------------------

function validateNotificationJob(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Notification job data is missing.");
  }

  const requiredFields = [
    "tenantId",
    "recipientId",
    "title",
    "message",
  ];

  for (const field of requiredFields) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      String(data[field]).trim() === ""
    ) {
      throw new Error(
        `Invalid notification job: ${field} is required.`
      );
    }
  }

  if (typeof data.title !== "string" || typeof data.message !== "string") {
    throw new Error("Notification title and message must be strings.");
  }

  if (data.title.length > 200) {
    throw new Error("Notification title exceeds 200 characters.");
  }

  if (data.message.length > 10000) {
    throw new Error("Notification message exceeds 10000 characters.");
  }

  return {
    tenantId: String(data.tenantId),
    recipientId: String(data.recipientId),
    title: data.title.trim(),
    message: data.message.trim(),
    type: data.type || "info",
    link: data.link ?? null,
    metadata: data.metadata ?? null,
  };
}

// --------------------------------------------------
// Process a notification
// --------------------------------------------------

async function processNotification(job) {
  const notification = validateNotificationJob(job.data);

  console.info("[Notification Worker] Processing job", {
    jobId: job.id,
    tenantId: notification.tenantId,
    recipientId: notification.recipientId,
    type: notification.type,
  });

  /*
   * IMPORTANT:
   * This call assumes your existing repository exports:
   *
   * createNotification(tenantId, notificationData)
   *
   * If your notifications.repository.js uses a different signature,
   * align this call with that existing function.
   */
  const savedNotification = await createNotification(
    notification.tenantId,
    {
      recipientId: notification.recipientId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link,
      metadata: notification.metadata,
    }
  );

  console.info("[Notification Worker] Notification created", {
    jobId: job.id,
    notificationId: savedNotification?.id ?? null,
  });

  return {
    success: true,
    jobId: job.id,
    notificationId: savedNotification?.id ?? null,
  };
}

// --------------------------------------------------
// Start worker
// --------------------------------------------------

export const notificationWorker = new Worker(
  QUEUE_NAMES.NOTIFICATIONS,
  processNotification,
  {
    connection,
    concurrency: Number.parseInt(
      process.env.NOTIFICATION_WORKER_CONCURRENCY || "5",
      10
    ),
  }
);

// --------------------------------------------------
// Worker events
// --------------------------------------------------

notificationWorker.on("ready", () => {
  console.info(
    `[Notification Worker] Listening on queue "${QUEUE_NAMES.NOTIFICATIONS}".`
  );
});

notificationWorker.on("active", (job) => {
  console.info("[Notification Worker] Job started:", job.id);
});

notificationWorker.on("completed", (job, result) => {
  console.info("[Notification Worker] Job completed:", {
    jobId: job.id,
    notificationId: result?.notificationId ?? null,
  });
});

notificationWorker.on("failed", (job, error) => {
  console.error("[Notification Worker] Job failed:", {
    jobId: job?.id ?? null,
    attemptsMade: job?.attemptsMade ?? null,
    error: error.message,
  });
});

notificationWorker.on("error", (error) => {
  console.error("[Notification Worker] Worker error:", error.message);
});

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

let shuttingDown = false;

async function shutdown(signal = "shutdown") {
  if (shuttingDown) return;

  shuttingDown = true;

  console.info(`[Notification Worker] Received ${signal}; shutting down.`);

  try {
    await notificationWorker.close();
    await connection.quit();

    console.info("[Notification Worker] Shutdown complete.");
  } catch (error) {
    console.error(
      "[Notification Worker] Shutdown error:",
      error.message
    );

    process.exitCode = 1;
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// --------------------------------------------------
// Handle direct execution
// --------------------------------------------------

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  console.info("[Notification Worker] Starting...");
}