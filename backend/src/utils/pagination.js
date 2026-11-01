import ApiError from "./ApiError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function parsePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw ApiError.badRequest(
      `"${fieldName}" must be a positive integer.`
    );
  }

  return parsed;
}

/**
 * Read and normalize page and limit from query parameters.
 *
 * Example:
 * GET /api/v1/procurement/requests?page=2&limit=20
 */
export function getPagination(query = {}) {
  const page = parsePositiveInteger(
    query.page,
    DEFAULT_PAGE,
    "page"
  );

  const requestedLimit = parsePositiveInteger(
    query.limit,
    DEFAULT_LIMIT,
    "limit"
  );

  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    throw ApiError.badRequest("Pagination offset is too large.");
  }

  return {
    page,
    limit,
    offset,
  };
}

/**
 * Create pagination metadata for an API response.
 */
export function getPaginationMetadata({ page, limit, total }) {
  const normalizedPage = parsePositiveInteger(page, DEFAULT_PAGE, "page");
  const normalizedLimit = parsePositiveInteger(limit, DEFAULT_LIMIT, "limit");

  if (!Number.isSafeInteger(total) || total < 0) {
    throw ApiError.badRequest(
      '"total" must be a non-negative safe integer.'
    );
  }

  const totalPages = Math.ceil(total / normalizedLimit);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    total,
    totalPages,
    hasNextPage: normalizedPage < totalPages,
    hasPreviousPage: normalizedPage > 1,
  };
}

/**
 * Create pagination metadata using a database result.
 */
export function createPagination(page, limit, total) {
  return getPaginationMetadata({
    page,
    limit,
    total,
  });
}

export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT };

export default {
  getPagination,
  getPaginationMetadata,
  createPagination,
};