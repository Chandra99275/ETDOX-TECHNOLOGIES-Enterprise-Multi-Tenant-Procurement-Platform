
import { createClient } from "redis";
import { env } from "./env.js";

export const redis = createClient({
  url: env.redisUrl,
  socket: {
    connectTimeout: 5_000,
    reconnectStrategy(retries) {
      if (retries > 10) {
        return new Error("Redis reconnection limit reached");
      }

      return Math.min(retries * 500, 5_000);
    },
  },
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

redis.on("ready", () => {
  console.log("Redis connection ready");
});

redis.on("reconnecting", () => {
  console.log("Reconnecting to Redis...");
});

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }

  await redis.ping();
  return true;
}

export async function checkRedis() {
  if (!redis.isReady) {
    throw new Error("Redis is not ready");
  }

  return redis.ping();
}

export async function closeRedis() {
  if (redis.isOpen) {
    await redis.quit();
  }
}
