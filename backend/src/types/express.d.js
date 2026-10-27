
export function initializeRequestContext(req, res, next) {
  req.context = undefined;
  req.requestId = undefined;
  next();
}
