import { Router } from "express";

const router = Router();

/**
 * GET /api/v1
 * API information and basic availability check.
 */
router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ETDOX Procurement API is running.",
    service: "etdox-procurement-api",
    version: "v1",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Register feature routes here when their route modules are available.
 *
 * Examples:
 *
 * import authRoutes from "../modules/auth/auth.routes.js";
 * import procurementRoutes from "../modules/procurement/procurement.routes.js";
 * import budgetRoutes from "../modules/budgets/budgets.routes.js";
 * import invoiceRoutes from "../modules/invoices/invoices.routes.js";
 *
 * router.use("/auth", authRoutes);
 * router.use("/procurement", procurementRoutes);
 * router.use("/budgets", budgetRoutes);
 * router.use("/invoices", invoiceRoutes);
 *
 * Only uncomment these imports and registrations after verifying that
 * the corresponding files exist and export Express routers.
 */

export default router;