import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

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
// Application
// --------------------------------------------------

const app = express();

app.disable("x-powered-by");

// Configure trust proxy explicitly when deploying behind a known proxy.
// Example: set TRUST_PROXY=1 when there is exactly one trusted proxy.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// --------------------------------------------------
// CORS
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
    // Requests without an Origin header can include server-to-server calls.
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
// Security and request middleware
// --------------------------------------------------

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(cors(corsOptions));

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

app.use(cookieParser());

// Morgan logging can be disabled with HTTP_LOGGING=false.
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
// Request ID
// --------------------------------------------------

app.use((req, res, next) => {
  const suppliedId = req.get("x-request-id");

  // Do not blindly trust an arbitrarily long client-supplied value.
  const requestId =
    suppliedId && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId)
      ? suppliedId
      : cryptoRandomId();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
});

function cryptoRandomId() {
  return globalThis.crypto.randomUUID();
}

// --------------------------------------------------
// Rate limiting
// --------------------------------------------------

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(
    process.env.AUTH_RATE_LIMIT_MAX || "100",
    10
  ),
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many authentication requests. Please try again later.",
  },

  // Avoid returning rate-limit internals in responses.
  handler(req, res) {
    res.status(429).json({
      success: false,
      message: "Too many authentication requests. Please try again later.",
      requestId: req.requestId,
    });
  },
});

// --------------------------------------------------
// Health endpoints
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "etdox-procurement-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "etdox-procurement-api",
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// API routes
// --------------------------------------------------

const API_PREFIX = "/api/v1";

// Authentication
app.use(
  `${API_PREFIX}/auth`,
  authRateLimiter,
  authRoutes
);

// Procurement and approvals
app.use(
  `${API_PREFIX}/procurement`,
  procurementRoutes
);

app.use(
  `${API_PREFIX}/approvals`,
  approvalsRoutes
);

// Suppliers and purchasing
app.use(
  `${API_PREFIX}/suppliers`,
  suppliersRoutes
);

app.use(
  `${API_PREFIX}/purchase-orders`,
  purchaseOrdersRoutes
);

app.use(
  `${API_PREFIX}/receipts`,
  receiptsRoutes
);

// Finance
app.use(
  `${API_PREFIX}/budgets`,
  budgetsRoutes
);

app.use(
  `${API_PREFIX}/invoices`,
  invoicesRoutes
);

// Employees
app.use(
  `${API_PREFIX}/employees`,
  employeesRoutes
);

// Compatibility alias for clients using /users.
// Both paths use the same employee router and its existing authorization.
app.use(
  `${API_PREFIX}/users`,
  employeesRoutes
);

// Notifications and analytics
app.use(
  `${API_PREFIX}/notifications`,
  notificationsRoutes
);

app.use(
  `${API_PREFIX}/analytics`,
  analyticsRoutes
);

// --------------------------------------------------
<<<<<<< HEAD
// OPTIONAL ROUTE LOADING
// --------------------------------------------------

async function loadFirstRouter(relativePaths) {
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(__dirname, relativePath);

    if (!existsSync(absolutePath)) {
      continue;
    }

    const imported = await import(
      pathToFileURL(absolutePath).href
    );

    const router =
      imported.default ??
      imported.router ??
      imported.routes ??
      imported.authRoutes ??
      imported.usersRoutes ??
      imported.procurementRoutes ??
      imported.approvalsRoutes;

    if (typeof router !== 'function') {
      throw new TypeError(
        `Route file "${relativePath}" must export an Express router as its default export or a supported named export.`
      );
    }

    console.info(`[Routes] Loaded ${relativePath}`);

    return router;
  }

  return null;
}

async function mountOptional(paths, candidates) {
  const router = await loadFirstRouter(candidates);

  if (!router) {
    console.warn(
      `[Routes] Not mounted; no matching route file found: ${paths.join(', ')}`
    );

    return;
  }

  for (const routePath of paths) {
    app.use(routePath, router);
    console.info(`[Routes] Mounted ${routePath}`);
  }
}

// --------------------------------------------------
// ROUTE DEFINITIONS
// --------------------------------------------------

const routeGroups = [
  {
    paths: ['/api/auth', '/api/v1/auth'],
    candidates: [
      'modules/auth/auth.routes.js',
    ],
  },
  {
    paths: ['/api/users', '/api/v1/users', '/api/v1/employees'],
    candidates: [
      'modules/users/users.routes.js',
    ],
  },
  {
    paths: ['/api/procurement', '/api/v1/procurement'],
    candidates: [
      'modules/procurement/procurement.routes.js',
    ],
  },
  {
    paths: ['/api/approvals', '/api/v1/approvals'],
    candidates: [
      'modules/approvals/approvals.routes.js',
    ],
  },
  {
    paths: ['/api/finance', '/api/v1/finance'],
    candidates: [
      'modules/finance/finance.routes.js',
    ],
  },
  {
    paths: ['/api/v1/purchase-requests'],
    candidates: [
      'modules/purchase-requests/purchase-requests.routes.js',
    ],
  },
  {
    paths: ['/api/v1/suppliers'],
    candidates: [
      'modules/suppliers/suppliers.routes.js',
    ],
  },
  {
    paths: ['/api/v1/clients'],
    candidates: [
      'modules/clients/clients.routes.js',
    ],
  },
  {
    paths: ['/api/v1/issues'],
    candidates: [
      'modules/issues/issues.routes.js',
    ],
  },
  {
    paths: ['/api/v1/purchase-orders'],
    candidates: [
      'modules/purchase-orders/purchase-orders.routes.js',
    ],
  },
  {
    paths: ['/api/v1/receipts'],
    candidates: [
      'modules/receipts/receipts.routes.js',
    ],
  },
  {
    paths: ['/api/v1/invoices'],
    candidates: [
      'modules/invoices/invoices.routes.js',
    ],
  },
  {
    paths: ['/api/v1/budgets', '/api/budgets', '/api/procurement/budgets', '/api/v1/procurement/budgets'],
    candidates: [
      'modules/budgets/budgets.routes.js',
    ],
  },
  {
    paths: ['/api/v1/transactions'],
    candidates: [
      'modules/transactions/transactions.routes.js',
    ],
  },
  {
    paths: ['/api/v1/analytics', '/api/analytics'],
    candidates: [
      'modules/analytics/analytics.routes.js',
    ],
  },
  {
    paths: ['/api/v1/audit-events', '/api/v1/audit'],
    candidates: [
      'modules/audit/audit.routes.js',
    ],
  },
  {
    paths: ['/api/v1/webhooks'],
    candidates: [
      'modules/webhooks/webhooks.routes.js',
    ],
  },
  {
    paths: ['/api/v1/tenants', '/api/v1'],
    candidates: [
      'modules/tenants/tenants.routes.js',
    ],
  },
  {
    paths: ['/api/v1/attachments'],
    candidates: [
      'modules/attachments/attachments.routes.js',
    ],
  },
  {
    paths: ['/api/v1/contracts'],
    candidates: [
      'modules/contracts/contracts.routes.js',
    ],
  },
  {
    paths: ['/api/v1/billing'],
    candidates: [
      'modules/billing/billing.routes.js',
    ],
  },
  {
    paths: ['/api/v1/notifications'],
    candidates: [
      'modules/notifications/notifications.routes.js',
    ],
  },
  {
    paths: ['/api/v1/workflows'],
    candidates: [
      'modules/workflows/workflows.routes.js',
    ],
  },
];

for (const group of routeGroups) {
  await mountOptional(group.paths, group.candidates);
}

// --------------------------------------------------
// 404 HANDLER
=======
// 404 handler
// Must be after all route registrations.
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
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
// Global error handler
// Must be the last middleware.
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number(error.statusCode || error.status) || 500;

  if (statusCode >= 500) {
    console.error("[API Error]", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      code: error.code,
    });
  } else if (statusCode >= 400) {
    console.warn("[API Client Error]", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: error.message,
    });
  }

  const safeStatusCode =
    statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;

  res.status(safeStatusCode).json({
    success: false,

    message:
      safeStatusCode >= 500
        ? "An internal server error occurred."
        : error.message || "The request could not be processed.",

    requestId: req.requestId,
  });
});

export default app;