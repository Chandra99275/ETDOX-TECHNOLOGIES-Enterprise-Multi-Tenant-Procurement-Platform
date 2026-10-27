
export function asyncHandler(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncHandler expects a function');
  }

  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
