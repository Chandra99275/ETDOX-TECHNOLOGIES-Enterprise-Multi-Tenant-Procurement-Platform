
import { getRequestContext } from "../../middleware/auth.js";

import {
  searchAuditEvents,
} from "./audit.repository.js";

// ============================================================
// SEARCH AUDIT EVENTS
// GET /api/v1/audit
// ============================================================

export async function search(req, res, next) {
  try {
    // --------------------------------------------------------
    // 1. Get authenticated request context
    // --------------------------------------------------------

    const requestContext = getRequestContext(req);

    if (
      !requestContext ||
      requestContext.tenantId === undefined ||
      requestContext.tenantId === null ||
      String(requestContext.tenantId).trim() === ""
    ) {
      return res.status(403).json({
        success: false,
        message: "A valid tenant context is required.",
        requestId: req.requestId,
      });
    }

    // --------------------------------------------------------
    // 2. Read validated query parameters
    // --------------------------------------------------------

    const options = {
      action: req.query.action,

      resourceType: req.query.resourceType,

      resourceId: req.query.resourceId,

      actorId: req.query.actorId,

      from: req.query.from,

      to: req.query.to,

      limit: req.query.limit,

      offset: req.query.offset,
    };

    // --------------------------------------------------------
    // 3. Search tenant-scoped audit events
    // --------------------------------------------------------

    const result = await searchAuditEvents(
      requestContext.tenantId,
      options
    );

    // --------------------------------------------------------
    // 4. Return standardized response
    // --------------------------------------------------------

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
