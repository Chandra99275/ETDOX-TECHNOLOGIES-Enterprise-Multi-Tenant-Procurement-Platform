import "dotenv/config";

import app from "./app.js";
import { closeDatabase } from "./config/database.js";

// ==================================================
// 1. SERVER CONFIGURATION
// ==================================================

const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.CORS_ORIGIN ||
  "http://localhost:5173";

// Demo login is permitted ONLY in local development.
const DEMO_LOGIN_ENABLED =
  NODE_ENV === "development" &&
  (
    process.env.DEMO_LOGIN_ENABLED === "true" ||
    process.env.ETDOX_DEMO_AUTH === "true"
  );

// Validate configuration.
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(
    "PORT must be a valid TCP port between 1 and 65535."
  );
}

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32
) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters."
  );
}

// ==================================================
// 2. LOGGING UTILITIES
// ==================================================

function timestamp() {
  return new Date().toISOString();
}

function logInfo(message, ...details) {
  console.info(`[${timestamp()}] [INFO] ${message}`, ...details);
}

function logWarn(message, ...details) {
  console.warn(`[${timestamp()}] [WARN] ${message}`, ...details);
}

function logError(message, error) {
  console.error(`[${timestamp()}] [ERROR] ${message}`);

  if (error) {
    console.error(error.stack || error.message || error);
  }
}

// ==================================================
// 3. PROCESS-LEVEL ERROR HANDLING
// ==================================================

process.on("unhandledRejection", (reason) => {
  logError("Unhandled Promise Rejection", reason);
});

process.on("uncaughtException", (error) => {
  logError("Uncaught Exception", error);
  process.exit(1);
});

// ==================================================
// 4. START HTTP SERVER
// ==================================================

const server = app.listen(PORT, HOST, () => {
  console.info("");
  console.info("==================================================");
  console.info("           ETDOX PROCUREMENT API");
  console.info("==================================================");

  logInfo(`Environment       : ${NODE_ENV}`);
  logInfo(`Host              : ${HOST}`);
  logInfo(`Port              : ${PORT}`);
  logInfo(`Health            : http://localhost:${PORT}/api/health`);
  logInfo("API prefix        : /api/v1");
  logInfo(`Frontend          : ${FRONTEND_URL}`);
  logInfo(
    `Local demo login  : ${
      DEMO_LOGIN_ENABLED ? "enabled" : "disabled"
    }`
  );

  if (
    (
      process.env.DEMO_LOGIN_ENABLED === "true" ||
      process.env.ETDOX_DEMO_AUTH === "true"
    ) &&
    NODE_ENV !== "development"
  ) {
    logWarn(
      "Demo login was requested, but is disabled outside development."
    );
  }

  console.info("==================================================");

  logInfo("Server started successfully.");
  logInfo("Waiting for incoming HTTP requests...");
  console.info("");
});

// ==================================================
// 5. SERVER ERROR HANDLING
// ==================================================

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logError(
      `Port ${PORT} is already in use. Stop the other server before restarting.`
    );
  } else if (error.code === "EACCES") {
    logError(`Permission denied on ${HOST}:${PORT}.`);
  } else {
    logError("HTTP server error", error);
  }

  process.exit(1);
});

// ==================================================
// 6. GRACEFUL SHUTDOWN
// ==================================================

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logWarn(`Received ${signal}. Shutting down ETDOX API...`);

  const forceExitTimer = setTimeout(() => {
    logError("Shutdown timed out. Forcing process exit.");
    process.exit(1);
  }, 15000);

  forceExitTimer.unref();

  try {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      logInfo("HTTP server closed.");
    }

    await closeDatabase();

    logInfo("Database connection pool closed.");
    logInfo("ETDOX API shutdown completed.");

    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    logError("Failed during shutdown", error);

    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});