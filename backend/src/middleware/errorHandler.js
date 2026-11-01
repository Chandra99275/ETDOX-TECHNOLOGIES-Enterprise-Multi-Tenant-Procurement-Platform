import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

function getStatusCode(error) {
  if (Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) {
    return error.status;
  }

  if (
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }

  if (error instanceof ZodError) {
    return 400;
  }

  switch (error.code) {
    case "23505":
      return 409; // Unique constraint violation.

    case "23503":
      return 409; // Foreign key violation.

    case "23502":
      return 400; // Not-null constraint violation.

    case "22P02":
      return 400; // Invalid PostgreSQL input syntax.

    case "40001":
      return 409; // Transaction serialization failure.

    case "ECONNREFUSED":
    case "ECONNRESET":
      return 503;

    default:
      return 500;
  }
}

function getErrorCode(error, status) {
  if (error.code && typeof error.code === "string" && !/^\d{5}$/.test(error.code)) {
    return error.code;
  }

  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMIT_EXCEEDED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const status = getStatusCode(error);
  const code = getErrorCode(error, status);

  let message =
    status >= 500
      ? "An unexpected server error occurred."
      : error.message || "The request could not be completed.";

  let details;

  if (error instanceof ZodError || error.code === "VALIDATION_ERROR") {
    message = "Request validation failed.";

    const issues =
      error instanceof ZodError
        ? error.issues
        : error.details;

    if (Array.isArray(issues)) {
      details = issues.map((issue) => ({
        path: Array.isArray(issue.path)
          ? issue.path.join(".")
          : issue.path,
        message: issue.message,
      }));
    }
  } else if (error.code === "23505") {
    message = "A record with the same unique value already exists.";
  } else if (error.code === "23503") {
    message = "The operation references a record that does not exist.";
  } else if (error.code === "23502") {
    message = "A required database field is missing.";
  } else if (error.code === "22P02") {
    message = "One or more supplied values have an invalid format.";
  } else if (error.code === "40001") {
    message = "The operation conflicted with another transaction. Please retry.";
  }

  const logData = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl?.split("?")[0],
    statusCode: status,
    code,
    userId: req.user?.id,
    tenantId: req.tenantId,
    errorMessage: error.message,
    stack: env.isDevelopment ? error.stack : undefined,
  };

  if (status >= 500) {
    logger.error(logData, "Unhandled API error");
  } else {
    logger.warn(logData, "API request rejected");
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      requestId: req.id,
    },
  };

  if (details) {
    response.error.details = details;
  }

  if (env.isDevelopment && status >= 500) {
    response.error.debugMessage = error.message;
  }

  res.status(status).json(response);
}

export default errorHandler;