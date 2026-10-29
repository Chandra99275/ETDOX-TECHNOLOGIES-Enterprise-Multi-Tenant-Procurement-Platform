import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

app.set(
  'trust proxy',
  process.env.TRUST_PROXY === 'true' ? 1 : false
);

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const configuredOrigins = [
  process.env.CORS_ORIGINS,
  process.env.CORS_ORIGIN,
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  ...configuredOrigins,
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = origin.trim().replace(/\/+$/, '');

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (!isProduction) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      normalizedOrigin
    );
  }

  return false;
}

// Handle CORS before Helmet, rate limiting, and routes.
// This explicitly responds to browser OPTIONS preflight requests.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) {
      console.warn(`[CORS] Rejected origin: ${origin}`);
      return res.status(403).end();
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    const requestedHeaders =
      req.headers['access-control-request-headers'];

    const allowedHeaders = new Set([
      'content-type',
      'authorization',
      'x-request-id',
      'accept',
    ]);

    const headersToAllow = requestedHeaders
      ? requestedHeaders
          .split(',')
          .map((header) => header.trim().toLowerCase())
      : ['content-type', 'authorization', 'x-request-id', 'accept'];

    const invalidHeader = headersToAllow.find(
      (header) => !allowedHeaders.has(header)
    );

    if (invalidHeader) {
      return res.status(403).json({
        success: false,
        message: `CORS request header not allowed: ${invalidHeader}`,
        error: {
          code: 'CORS_HEADER_NOT_ALLOWED',
        },
      });
    }

    res.setHeader(
      'Access-Control-Allow-Headers',
      headersToAllow.join(', ')
    );

    res.setHeader('Access-Control-Max-Age', '86400');

    return res.status(204).end();
  }

  next();
});

// --------------------------------------------------
// SECURITY AND REQUEST PARSING
// --------------------------------------------------

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(express.json({ limit: '1mb' }));

app.use(
  express.urlencoded({
    extended: false,
    limit: '1mb',
  })
);

app.use(cookieParser());

// --------------------------------------------------
// REQUEST ID AND LOGGING
// --------------------------------------------------

app.use((req, res, next) => {
  const suppliedId = req.get('x-request-id');

  req.id =
    suppliedId && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId)
      ? suppliedId
      : `req_${randomUUID().replace(/-/g, '')}`;

  res.setHeader('X-Request-ID', req.id);

  next();
});

app.use(
  morgan(isProduction ? 'combined' : 'dev', {
    skip: (req) => req.path === '/api/health',
  })
);

// --------------------------------------------------
// RATE LIMITING
// --------------------------------------------------

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },

  handler(req, res) {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
      },
      requestId: req.id,
    });
  },
});

// --------------------------------------------------
// HEALTH ENDPOINTS
// --------------------------------------------------

function healthHandler(req, res) {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'etdox-procurement-api',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
}

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// --------------------------------------------------
// ROOT INFORMATION ENDPOINT
// --------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'ETDOX Procurement API',
    version: '1.0.0',
    health: '/api/health',
    requestId: req.id,
  });
});

// --------------------------------------------------
// API RATE LIMITING
// --------------------------------------------------

app.use('/api', (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/v1/health'
  ) {
    return next();
  }

  return apiLimiter(req, res, next);
});

// --------------------------------------------------
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
      'routes/authRoutes.js',
      'routes/auth.routes.js',
    ],
  },
  {
    paths: ['/api/users', '/api/v1/users'],
    candidates: [
      'modules/users/users.routes.js',
      'routes/users.routes.js',
      'routes/userRoutes.js',
    ],
  },
  {
    paths: ['/api/procurement', '/api/v1/procurement'],
    candidates: [
      'modules/procurement/procurement.routes.js',
      'routes/procurementRoutes.js',
      'routes/procurement.routes.js',
    ],
  },
  {
    paths: ['/api/approvals', '/api/v1/approvals'],
    candidates: [
      'modules/approvals/approvals.routes.js',
      'routes/approvals.routes.js',
      'routes/approvalRoutes.js',
    ],
  },
  {
    paths: ['/api/finance', '/api/v1/finance'],
    candidates: [
      'modules/finance/finance.routes.js',
      'routes/finance.routes.js',
      'routes/financeRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/purchase-requests'],
    candidates: [
      'routes/purchaseRequestRoutes.js',
      'routes/purchase-requests.routes.js',
    ],
  },
  {
    paths: ['/api/v1/suppliers'],
    candidates: [
      'modules/suppliers/suppliers.routes.js',
      'routes/suppliers.routes.js',
      'routes/supplierRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/purchase-orders'],
    candidates: [
      'modules/purchase-orders/purchase-orders.routes.js',
      'routes/purchaseOrders.routes.js',
      'routes/purchaseOrderRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/receipts'],
    candidates: [
      'modules/receipts/receipts.routes.js',
      'routes/receipts.routes.js',
      'routes/receiptRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/invoices'],
    candidates: [
      'modules/invoices/invoices.routes.js',
      'routes/invoices.routes.js',
      'routes/invoiceRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/budgets'],
    candidates: [
      'modules/budgets/budgets.routes.js',
      'routes/budgets.routes.js',
      'routes/budgetRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/transactions'],
    candidates: [
      'modules/transactions/transactions.routes.js',
      'routes/transactions.routes.js',
      'routes/transactionRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/analytics'],
    candidates: [
      'modules/analytics/analytics.routes.js',
      'routes/analytics.routes.js',
      'routes/analyticsRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/audit-events'],
    candidates: [
      'modules/audit/audit.routes.js',
      'routes/auditEvents.routes.js',
      'routes/auditRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/webhooks'],
    candidates: [
      'modules/webhooks/webhooks.routes.js',
      'routes/webhooks.routes.js',
      'routes/webhookRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/tenants', '/api/v1'],
    candidates: [
      'modules/tenants/tenants.routes.js',
      'routes/tenants.routes.js',
      'routes/tenantRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/attachments', '/api/v1'],
    candidates: [
      'modules/attachments/attachments.routes.js',
      'routes/attachments.routes.js',
      'routes/attachmentRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/contracts'],
    candidates: [
      'modules/contracts/contracts.routes.js',
      'routes/contracts.routes.js',
      'routes/contractRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/billing'],
    candidates: [
      'modules/billing/billing.routes.js',
      'routes/billing.routes.js',
      'routes/billingRoutes.js',
    ],
  },
  {
    paths: ['/api/v1/notifications'],
    candidates: [
      'modules/notifications/notifications.routes.js',
      'routes/notifications.routes.js',
      'routes/notificationRoutes.js',
    ],
  },
];

for (const group of routeGroups) {
  await mountOptional(group.paths, group.candidates);
}

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: {
      code: 'ROUTE_NOT_FOUND',
    },
    requestId: req.id,
  });
});

// --------------------------------------------------
// CENTRALIZED ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body.',
      error: {
        code: 'INVALID_JSON',
      },
      requestId: req.id,
    });
  }

  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : Number.isInteger(err.status) &&
          err.status >= 400 &&
          err.status <= 599
        ? err.status
        : 500;

  const code =
    typeof err.code === 'string'
      ? err.code
      : 'INTERNAL_SERVER_ERROR';

  const message =
    statusCode >= 500 && isProduction
      ? 'An unexpected server error occurred.'
      : err.message || 'An unexpected server error occurred.';

  if (statusCode >= 500) {
    console.error('[API Error]', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: err.message,
      stack: isProduction ? undefined : err.stack,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      ...(!isProduction && err.details !== undefined
        ? { details: err.details }
        : {}),
    },
    requestId: req.id,
  });
});

export { app };
export default app;