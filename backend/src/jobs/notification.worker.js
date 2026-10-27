
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';

const QUEUE_NAME = 'notifications';

async function processNotification(job) {
  const { type, recipient, subject, message, metadata } = job.data ?? {};

  if (!type || !recipient || !message) {
    throw new Error(
      'Invalid notification job: type, recipient, and message are required.'
    );
  }

  switch (type) {
    case 'email': {
      // TODO: Connect your configured email provider here.
      // Do not mark this as delivered until the provider confirms success.
      console.info('[Notification Worker] Email job received', {
        jobId: job.id,
        recipient,
        subject: subject ?? '(no subject)',
      });

      throw new Error(
        'Email delivery is not configured. Connect an email provider before enabling email jobs.'
      );
    }

    case 'in_app': {
      // TODO: Persist the notification in your existing notifications table.
      // The database schema has not yet been verified.
      console.info('[Notification Worker] In-app notification received', {
        jobId: job.id,
        recipient,
        message,
        metadata: metadata ?? {},
      });

      throw new Error(
        'In-app notification persistence is not configured yet.'
      );
    }

    default:
      throw new Error(`Unsupported notification type: ${type}`);
  }
}

export const notificationWorker = new Worker(
  QUEUE_NAME,
  processNotification,
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

notificationWorker.on('completed', (job) => {
  console.info(`[Notification Worker] Job ${job.id} completed`);
});

notificationWorker.on('failed', (job, error) => {
  console.error('[Notification Worker] Job failed', {
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    error: error.message,
  });
});

notificationWorker.on('error', (error) => {
  console.error('[Notification Worker] Worker error:', error.message);
});

export async function closeNotificationWorker() {
  await notificationWorker.close();
}
