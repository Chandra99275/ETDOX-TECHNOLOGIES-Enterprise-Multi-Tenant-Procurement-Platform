
export class ApiError extends Error {
  constructor(
    statusCode,
    message,
    {
      code = 'API_ERROR',
      details = null,
      isOperational = true,
    } = {}
  ) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(400, message, {
      code: 'BAD_REQUEST',
      details,
    });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, {
      code: 'UNAUTHORIZED',
    });
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, {
      code: 'FORBIDDEN',
    });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, {
      code: 'NOT_FOUND',
    });
  }

  static conflict(message = 'Resource conflict', details = null) {
    return new ApiError(409, message, {
      code: 'CONFLICT',
      details,
    });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, {
      code: 'TOO_MANY_REQUESTS',
    });
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, {
      code: 'INTERNAL_SERVER_ERROR',
      isOperational: false,
    });
  }
}
