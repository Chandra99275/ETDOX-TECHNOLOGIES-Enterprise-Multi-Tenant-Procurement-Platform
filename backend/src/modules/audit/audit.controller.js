
import { getRequestContext } from "../../middleware/auth.js";

import {
  searchAuditEvents,
} from "./audit.repository.js";

/**
 * GET /api/v1/audit-events
 *
 * Search audit events belonging to the authenticated tenant.
 */
export async function search(req, res, next) {
  try {
    const requestContext = getRequestContext(req);

    if (
      !requestContext ||
      requestContext.tenantId === undefined ||
      requestContext.tenantId === null
    ) {
      return res.status(403).json({
        success: false,
        message: "A valid tenant context is required.",
        requestId: req.requestId,
      });
    }

    const options = {
      action: req.query.action,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      actorId: req.query.actorId,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await searchAuditEvents(
      requestContext.tenantId,
      options
    );

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
}
