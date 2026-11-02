
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

// --------------------------------------------------
// Application configuration
// --------------------------------------------------

const app = express();
const API_PREFIX = "/api/v1";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

app.disable("x-powered-by");

// Only enable this when the deployment topology is known.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// --------------------------------------------------
// Route imports
// --------------------------------------------------

import authRoutes from "./modules/auth/auth.routes.js";
import procurementRoutes from "./modules/procurement/procurement.routes.js";
import approvalsRoutes from "./modules/approvals/approvals.routes.js";
import budgetsRoutes from "./modules/budgets/budgets.routes.js";
import invoicesRoutes from "./modules/invoices/invoices.routes.js";
import suppliersRoutes from "./modules/suppliers/suppliers.routes.js";
import purchaseOrdersRoutes from "./modules/purchase-orders/purchase-orders.routes.js";
import receiptsRoutes from "./modules/receipts/receipts.routes.js";
import employeesRoutes from "./modules/employees/employees.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

// --------------------------------------------------
// CORS configuration
// --------------------------------------------------

const configuredOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header, such as server-to-server calls.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");

    if (configuredOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    const error = new Error("Origin is not allowed by CORS.");
    error.statusCode = 403;

    return callback(error);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
  ],

  exposedHeaders: ["X-Request-ID"],

  optionsSuccessStatus: 204,
};

// --------------------------------------------------
// Security middleware
// --------------------------------------------------

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(cors(corsOptions));

// --------------------------------------------------
// Request body parsing
// --------------------------------------------------

app.use(
  express.json({
    limit: "2mb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "2mb",
  })
);

// Parse cookies before authentication routes.
app.use(cookieParser());

// --------------------------------------------------
// HTTP request logging
// --------------------------------------------------

if (process.env.HTTP_LOGGING !== "false") {
  app.use(
    morgan(
      process.env.NODE_ENV === "production"
        ? "combined"
        : "dev"
    )
  );
}

// --------------------------------------------------
// Request ID middleware
// --------------------------------------------------

app.use((req, res, next) => {
  const suppliedId = req.get("X-Request-ID");

  const requestId =
    suppliedId &&
    /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId)
      ? suppliedId
      : randomUUID();

  req.requestId = requestId;

  res.setHeader("X-Request-ID", requestId);

  next();
});

// --------------------------------------------------
// Authentication rate limiting
// --------------------------------------------------

const configuredAuthLimit = Number.parseInt(
  process.env.AUTH_RATE_LIMIT_MAX || "100",
  10
);

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit:
    Number.isFinite(configuredAuthLimit) &&
    configuredAuthLimit > 0
      ? configuredAuthLimit
      : 100,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many authentication requests. Please try again later.",
  },

  handler(req, res) {
    res.status(429).json({
      success: false,
      message:
        "Too many authentication requests. Please try again later.",
      requestId: req.requestId,
    });
  },
});

// --------------------------------------------------
// Health endpoints
// --------------------------------------------------

function healthHandler(req, res) {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "etdox-procurement-api",
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
}

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// --------------------------------------------------
// API ROUTES
//
// Each primary API endpoint is mounted exactly once.
// --------------------------------------------------

// Authentication
app.use(
  `${API_PREFIX}/auth`,
  authRateLimiter,
  authRoutes
);

// Procurement
app.use(
  `${API_PREFIX}/procurement`,
  procurementRoutes
);

// Approvals
app.use(
  `${API_PREFIX}/approvals`,
  approvalsRoutes
);

// Suppliers
app.use(
  `${API_PREFIX}/suppliers`,
  suppliersRoutes
);

// Purchase orders
app.use(
  `${API_PREFIX}/purchase-orders`,
  purchaseOrdersRoutes
);

// Goods receipts
app.use(
  `${API_PREFIX}/receipts`,
  receiptsRoutes
);

// Budgets
app.use(
  `${API_PREFIX}/budgets`,
  budgetsRoutes
);

// Invoices
app.use(
  `${API_PREFIX}/invoices`,
  invoicesRoutes
);

// Employees
app.use(
  `${API_PREFIX}/employees`,
  employeesRoutes
);

// Compatibility alias for clients using /api/v1/users.
// This intentionally reuses the existing employee router.
app.use(
  `${API_PREFIX}/users`,
  employeesRoutes
);

// Notifications
app.use(
  `${API_PREFIX}/notifications`,
  notificationsRoutes
);

// Analytics
app.use(
  `${API_PREFIX}/analytics`,
  analyticsRoutes
);

// --------------------------------------------------
// OPTIONAL MODULE LOADER
//
// Optional modules are mounted only if their files exist.
// Do not register the primary routes above a second time.
// --------------------------------------------------

function resolveRouter(moduleExports, relativePath) {
  const possibleRouters = [
    moduleExports.default,
    moduleExports.router,
    moduleExports.routes,
    moduleExports.authRoutes,
    moduleExports.usersRoutes,
    moduleExports.procurementRoutes,
    moduleExports.approvalsRoutes,
    moduleExports.financeRoutes,
    moduleExports.transactionsRoutes,
    moduleExports.auditRoutes,
    moduleExports.webhooksRoutes,
    moduleExports.tenantsRoutes,
    moduleExports.attachmentsRoutes,
    moduleExports.contractsRoutes,
    moduleExports.billingRoutes,
    moduleExports.workflowsRoutes,
    moduleExports.purchaseRequestsRoutes,
    moduleExports.clientsRoutes,
    moduleExports.issuesRoutes,
  ];

  const router = possibleRouters.find(
    (candidate) => typeof candidate === "function"
  );

  if (!router) {
    throw new TypeError(
      `Route file "${relativePath}" does not export an Express router.`
    );
  }

  return router;
}

async function loadOptionalRouter(relativePath) {
  const absolutePath = path.resolve(
    currentDirectory,
    relativePath
  );

  if (!existsSync(absolutePath)) {
    console.info(
      `[Routes] Optional module not found; skipping: ${relativePath}`
    );

    return null;
  }

  try {
    const importedModule = await import(
      pathToFileURL(absolutePath).href
    );

    const router = resolveRouter(
      importedModule,
      relativePath
    );

    console.info(
      `[Routes] Optional module loaded: ${relativePath}`
    );

    return router;
  } catch (error) {
    console.error(
      `[Routes] Failed to load ${relativePath}:`,
      error.message
    );

    throw error;
  }
}

async function mountOptionalRoutes(routeGroups) {
  for (const group of routeGroups) {
    const router = await loadOptionalRouter(
      group.module
    );

    if (!router) {
      continue;
    }

    for (const routePath of group.paths) {
      app.use(routePath, router);

      console.info(
        `[Routes] Mounted ${routePath}`
      );
    }
  }
}

// --------------------------------------------------
// OPTIONAL API MODULES
//
// These modules are not mounted above.
// Add a module here only when the corresponding
// route file exists and is required by your project.
// --------------------------------------------------

const optionalRouteGroups = [
  {
    paths: [
      `${API_PREFIX}/finance`,
      "/api/finance",
    ],
    module: "modules/finance/finance.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/purchase-requests`,
    ],
    module:
      "modules/purchase-requests/purchase-requests.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/clients`,
    ],
    module: "modules/clients/clients.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/issues`,
    ],
    module: "modules/issues/issues.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/transactions`,
    ],
    module:
      "modules/transactions/transactions.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/audit-events`,
      `${API_PREFIX}/audit`,
    ],
    module: "modules/audit/audit.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/webhooks`,
    ],
    module: "modules/webhooks/webhooks.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/tenants`,
    ],
    module: "modules/tenants/tenants.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/attachments`,
    ],
    module: "modules/attachments/attachments.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/contracts`,
    ],
    module: "modules/contracts/contracts.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/billing`,
    ],
    module: "modules/billing/billing.routes.js",
  },

  {
    paths: [
      `${API_PREFIX}/workflows`,
    ],
    module: "modules/workflows/workflows.routes.js",
  },
];

// --------------------------------------------------
// Register optional routes before the 404 handler.
// --------------------------------------------------

await mountOptionalRoutes(optionalRouteGroups);

// --------------------------------------------------
// 404 HANDLER
//
// Must come after every API route.
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
    path: req.originalUrl,
    requestId: req.requestId,
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
//
// Must be the final middleware.
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const requestedStatus = Number(
    error.statusCode || error.status
  );

  const statusCode =
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus <= 599
      ? requestedStatus
      : 500;

  if (statusCode >= 500) {
    console.error("[API Error]", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      code: error.code,
    });
  } else {
    console.warn("[API Client Error]", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: error.message,
    });
  }

  res.status(statusCode).json({
    success: false,

    message:
      statusCode >= 500
        ? "An internal server error occurred."
        : error.message ||
          "The request could not be processed.",

    requestId: req.requestId,
  });
});

// --------------------------------------------------
// EXPORT APPLICATION
// --------------------------------------------------

export default app;
