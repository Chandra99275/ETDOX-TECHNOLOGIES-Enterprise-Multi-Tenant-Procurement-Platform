
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 500,
  },
  removeOnFail: {
    count: 1000,
  },
};

export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions,
});

export async function closeQueues() {
  await notificationQueue.close();
}
