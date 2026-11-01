import "dotenv/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

// --------------------------------------------------
// Redis configuration
// --------------------------------------------------

const REDIS_URL = process.env.REDIS_URL;

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

function createRedisConnection() {
  if (REDIS_URL) {
    return new IORedis(REDIS_URL, redisOptions);
  }

  return new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || "0", 10),
    ...redisOptions,
  });
}

// Queue producer connection
const redisConnection = createRedisConnection();

// --------------------------------------------------
// Queue definitions
// --------------------------------------------------

export const QUEUE_NAMES = Object.freeze({
  NOTIFICATIONS: "etdox-notifications",
});

export const notificationQueue = new Queue(
  QUEUE_NAMES.NOTIFICATIONS,
  {
    connection: redisConnection,

    defaultJobOptions: {
      // Retry temporary failures.
      attempts: 5,

      backoff: {
        type: "exponential",
        delay: 2000,
      },

      // Keep a limited history of processed jobs.
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },

      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 5000,
      },
    },
  }
);

// --------------------------------------------------
// Enqueue notification
// --------------------------------------------------

/**
 * Add a notification to the background queue.
 *
 * Required:
 * {
 *   tenantId: string,
 *   recipientId: string,
 *   title: string,
 *   message: string
 * }
 *
 * Optional:
 * {
 *   type: string,
 *   link: string,
 *   metadata: object,
 *   idempotencyKey: string
 * }
 */
export async function enqueueNotification(notification) {
  if (!notification || typeof notification !== "object") {
    throw new TypeError("A notification object is required.");
  }

  const {
    tenantId,
    recipientId,
    title,
    message,
    type = "info",
    link = null,
    metadata = null,
    idempotencyKey,
  } = notification;

  if (!tenantId) {
    throw new Error("tenantId is required.");
  }

  if (!recipientId) {
    throw new Error("recipientId is required.");
  }

  if (typeof title !== "string" || !title.trim()) {
    throw new Error("A notification title is required.");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("A notification message is required.");
  }

  const payload = {
    tenantId: String(tenantId),
    recipientId: String(recipientId),
    title: title.trim(),
    message: message.trim(),
    type,
    link,
    metadata,
    queuedAt: new Date().toISOString(),
  };

  const options = {};

  if (idempotencyKey) {
    // BullMQ job IDs should not contain ":".
    const safeId = String(idempotencyKey).replaceAll(":", "-");

    options.jobId = `notification-${safeId}`;
  }

  const job = await notificationQueue.add(
    "create-notification",
    payload,
    options
  );

  return {
    jobId: job.id,
    queue: QUEUE_NAMES.NOTIFICATIONS,
    status: "queued",
  };
}

// --------------------------------------------------
// Queue health information
// --------------------------------------------------

export async function getNotificationQueueStatus() {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
  ] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount(),
  ]);

  return {
    queue: QUEUE_NAMES.NOTIFICATIONS,
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

export async function closeQueues() {
  try {
    await notificationQueue.close();
  } finally {
    await redisConnection.quit();
  }
}

notificationQueue.on("error", (error) => {
  console.error("[Notification Queue] Redis/queue error:", error.message);
});