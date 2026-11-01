export function notFound(req, _res, next) {
  const error = new Error(
    `Route not found: ${req.method} ${req.originalUrl}`
  );

  error.status = 404;
  error.code = "ROUTE_NOT_FOUND";

  next(error);
}

export default notFound;