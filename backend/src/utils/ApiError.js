export class ApiError extends Error {
  constructor(
    statusCode = 500,
    message = "An unexpected error occurred.",
    options = {}
  ) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = options.code || "INTERNAL_SERVER_ERROR";
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = "Bad request.", details) {
    return new ApiError(400, message, {
      code: "BAD_REQUEST",
      details,
    });
  }

  static unauthorized(message = "Authentication required.") {
    return new ApiError(401, message, {
      code: "UNAUTHORIZED",
    });
  }

  static forbidden(message = "You do not have permission to perform this action.") {
    return new ApiError(403, message, {
      code: "FORBIDDEN",
    });
  }

  static notFound(message = "Resource not found.") {
    return new ApiError(404, message, {
      code: "NOT_FOUND",
    });
  }

  static conflict(message = "The request conflicts with the current resource state.") {
    return new ApiError(409, message, {
      code: "CONFLICT",
    });
  }

  static validation(message = "Request validation failed.", details) {
    return new ApiError(422, message, {
      code: "VALIDATION_ERROR",
      details,
    });
  }

  static tooManyRequests(message = "Too many requests.") {
    return new ApiError(429, message, {
      code: "RATE_LIMIT_EXCEEDED",
    });
  }

  static internal(message = "An unexpected server error occurred.") {
    return new ApiError(500, message, {
      code: "INTERNAL_SERVER_ERROR",
      isOperational: false,
    });
  }

  static serviceUnavailable(message = "Service temporarily unavailable.") {
    return new ApiError(503, message, {
      code: "SERVICE_UNAVAILABLE",
    });
  }
}

export default ApiError;