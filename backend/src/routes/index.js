import { Router } from "express";

import healthRoutes from "./health.routes.js";
import apiRoutes from "./api.routes.js";

const router = Router();

/**
 * Health and readiness endpoints.
 *
 * GET /api/health
 * GET /api/health/ready
 */
router.use("/api/health", healthRoutes);

/**
 * Versioned application API.
 *
 * GET /api/v1
 */
router.use("/api/v1", apiRoutes);

export default router;