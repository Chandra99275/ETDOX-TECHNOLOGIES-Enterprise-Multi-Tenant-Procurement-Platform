import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import { getAnalyticsSummary } from './analytics.repository';
import { AnalyticsOptions } from './analytics.schema';

export const summary: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getAnalyticsSummary(
      getRequestContext(req).tenantId, req.query as unknown as AnalyticsOptions,
    ) });
  } catch (error) { next(error); }
};
