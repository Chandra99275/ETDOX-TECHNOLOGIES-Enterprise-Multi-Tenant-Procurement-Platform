import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.logLevel,

  base: {
    service: "etdox-procurement-api",
    environment: env.nodeEnv,
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "password_hash",
      "token",
      "accessToken",
      "refreshToken",
      "jwt",
      "DATABASE_URL",
      "JWT_SECRET",
    ],

    censor: "[REDACTED]",
  },

  ...(env.isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

export default logger;