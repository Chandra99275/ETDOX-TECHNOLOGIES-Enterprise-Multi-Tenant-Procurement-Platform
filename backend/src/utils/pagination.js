
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return parsed;
}

export function getPagination(query = {}) {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);

  const requestedLimit = parsePositiveInteger(
    query.limit,
    DEFAULT_LIMIT
  );

  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    return {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      offset: 0,
    };
  }

  return {
    page,
    limit,
    offset,
  };
}

export function getPaginationMeta(totalItems, page, limit) {
  const total = Math.max(0, Number(totalItems) || 0);
  const safePage = Math.max(1, Number(page) || DEFAULT_PAGE);
  const safeLimit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    totalItems: total,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
}

export function paginatedResponse(items, totalItems, pagination) {
  const { page, limit } = pagination;

  return {
    items,
    pagination: getPaginationMeta(totalItems, page, limit),
  };
}
