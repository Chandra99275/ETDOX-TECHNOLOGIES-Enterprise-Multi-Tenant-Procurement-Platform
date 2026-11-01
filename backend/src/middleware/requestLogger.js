import { randomUUID } from "node:crypto";
import { logger } from "../config/logger.js";

export function requestLogger(req, res, next) {
  const suppliedRequestId = req.headers["x-request-id"];

  const requestId =
    typeof suppliedRequestId === "string" &&
    /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  const startedAt = process.hrtime.bigint();

  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const logData = {
      requestId,
      method: req.method,
      path: req.originalUrl?.split("?")[0],
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.user?.id,
      tenantId: req.tenantId,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, "HTTP request failed");
    } else if (res.statusCode >= 400) {
      logger.warn(logData, "HTTP request returned a client error");
    } else {
      logger.info(logData, "HTTP request completed");
    }
  });

  next();
}

export default requestLogger;