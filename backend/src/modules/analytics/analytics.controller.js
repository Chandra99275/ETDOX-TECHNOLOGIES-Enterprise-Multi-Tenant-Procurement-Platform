
import { getRequestContext } from '../../middleware/auth.js';
import { getAnalyticsSummary } from './analytics.repository.js';

export const summary = async (req, res, next) => {
  try {
    const tenantId = getRequestContext(req).tenantId;

    const data = await getAnalyticsSummary(
      tenantId,
      req.query
    );

    res.json({ data });
  } catch (error) {
    next(error);
  }
};
