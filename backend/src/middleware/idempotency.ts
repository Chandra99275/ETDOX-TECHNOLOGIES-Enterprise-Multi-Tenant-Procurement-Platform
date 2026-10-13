import { RequestHandler } from 'express';
// TODO: read Idempotency-Key, look up/store in idempotency_keys
export const idempotency: RequestHandler = (_req, _res, next) => next();
