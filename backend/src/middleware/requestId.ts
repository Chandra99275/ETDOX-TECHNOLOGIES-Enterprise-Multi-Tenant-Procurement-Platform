import { RequestHandler } from 'express';
import { v4 as uuid } from 'uuid';
export const requestId: RequestHandler = (req, res, next) => {
  const id = `req_${uuid()}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
