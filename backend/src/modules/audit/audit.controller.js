
import { getRequestContext } from '../../middleware/auth.js';
import { searchAuditEvents } from './audit.repository.js';

export const search = async (req, res, next) => {
  try {
    const options = req.query;

    res.json(
      await searchAuditEvents(
        getRequestContext(req).tenantId,
        options
      )
    );
  } catch (error) {
    next(error);
  }
};
