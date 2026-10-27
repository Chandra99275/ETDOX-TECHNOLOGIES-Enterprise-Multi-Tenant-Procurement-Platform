
// TODO: Read Idempotency-Key and look up/store it in idempotency_keys

export const idempotency = (_req, _res, next) => {
  next();
};
