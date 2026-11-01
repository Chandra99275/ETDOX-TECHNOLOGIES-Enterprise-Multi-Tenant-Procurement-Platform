import { Router } from "express";
import { checkDatabase } from "../config/database.js";

const router = Router();

/**
 * GET /api/health
 * Basic API health check.
 */
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "etdox-procurement-api",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ready
 * Readiness check, including PostgreSQL connectivity.
 */
router.get("/ready", async (_req, res, next) => {
  try {
    const database = await checkDatabase();

    const isReady = database?.healthy === true;

    return res.status(isReady ? 200 : 503).json({
      success: isReady,
      status: isReady ? "ready" : "not_ready",
      service: "etdox-procurement-api",
      checks: {
        database: isReady ? "connected" : "unavailable",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;