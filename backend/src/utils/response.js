function sendResponse(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

/**
 * Standard successful response.
 */
export function successResponse(
  res,
  data = null,
  message = "Request completed successfully.",
  statusCode = 200
) {
  return sendResponse(res, statusCode, {
    success: true,
    message,
    data,
  });
}

/**
 * Response for successfully creating a resource.
 */
export function createdResponse(
  res,
  data = null,
  message = "Resource created successfully."
) {
  return successResponse(res, data, message, 201);
}

/**
 * Response for successful operations with no response body.
 */
export function noContentResponse(res) {
  return res.status(204).end();
}

/**
 * Standard paginated response.
 */
export function paginatedResponse(
  res,
  {
    data,
    page,
    limit,
    total,
    message = "Records retrieved successfully.",
  }
) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.max(1, Number(limit) || 10);
  const normalizedTotal = Math.max(0, Number(total) || 0);

  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total: normalizedTotal,
      totalPages: Math.ceil(normalizedTotal / normalizedLimit),
      hasNextPage: normalizedPage * normalizedLimit < normalizedTotal,
      hasPreviousPage: normalizedPage > 1,
    },
  });
}

export default {
  successResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse,
};