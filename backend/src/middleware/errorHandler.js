
export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusFromError = Number(error.statusCode || error.status);
  const status =
    Number.isInteger(statusFromError) &&
    statusFromError >= 400 &&
    statusFromError <= 599
      ? statusFromError
      : 500;

  if (status >= 500) {
    console.error({
      message: error.message,
      requestId: req.requestId ?? null,
      stack: error.stack,
    });
  }

  const response = {
    success: false,
    message:
      status >= 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected server error occurred.'
        : error.message || 'Request failed.',
    requestId: req.requestId ?? null,
  };

  if (status === 400 && error.code === '22P02') {
    response.message = 'Invalid identifier or data format.';
  }

  if (error.code === '23505') {
    response.message = 'A record with these details already exists.';
    response.status = 409;
    return res.status(409).json(response);
  }

  if (error.code === '23503') {
    response.message = 'The requested operation references a related record that does not exist.';
    response.status = 409;
    return res.status(409).json(response);
  }

  if (error.code === '23514') {
    response.message = 'The supplied data violates a database constraint.';
    response.status = 400;
    return res.status(400).json(response);
  }

  return res.status(status).json(response);
}

export default errorHandler;
