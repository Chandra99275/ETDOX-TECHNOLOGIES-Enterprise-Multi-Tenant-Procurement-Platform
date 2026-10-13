import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import { searchAuditEvents } from './audit.repository';
import { AuditSearchOptions } from './audit.schema';

export const search: RequestHandler = async (req, res, next) => {
  try {
    const options = req.query as unknown as AuditSearchOptions;
    res.json(await searchAuditEvents(getRequestContext(req).tenantId, options));
  } catch (error) { next(error); }
};
