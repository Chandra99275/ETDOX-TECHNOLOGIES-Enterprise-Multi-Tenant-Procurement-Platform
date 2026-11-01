/**
 * Wrap an asynchronous Express route handler.
 *
 * Compatible with Express 4 and Express 5.
 */
export function asyncHandler(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("asyncHandler requires a function.");
  }

  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

export default asyncHandler;