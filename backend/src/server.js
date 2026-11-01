import "dotenv/config";

import app from "./app.js";
import { closeDatabase } from "./config/database.js";

// --------------------------------------------------
// Server configuration
// --------------------------------------------------

const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid TCP port between 1 and 65535.");
}

let isShuttingDown = false;
let shutdownTimeout;

// --------------------------------------------------
// Start HTTP server
// --------------------------------------------------

const server = app.listen(PORT, HOST, () => {
  console.info("--------------------------------------------");
  console.info("ETDOX PROCUREMENT API");
  console.info("--------------------------------------------");
  console.info(`Environment : ${NODE_ENV}`);
  console.info(`Host        : ${HOST}`);
  console.info(`Port        : ${PORT}`);
  console.info(`API         : http://localhost:${PORT}/api/v1`);
  console.info(`Health      : http://localhost:${PORT}/api/health`);
  console.info(`Started     : ${new Date().toISOString()}`);
  console.info("--------------------------------------------");
});

// --------------------------------------------------
// Server error handling
// --------------------------------------------------

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `[Server] Port ${PORT} is already in use. ` +
      "Stop the other process or configure a different PORT."
    );
  } else if (error.code === "EACCES") {
    console.error(
      `[Server] Permission denied when attempting to listen on port ${PORT}.`
    );
  } else {
    console.error("[Server] Failed to start:", error);
  }

  process.exitCode = 1;
});

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

async function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    console.warn("[Server] Shutdown already in progress.");
    return;
  }

  isShuttingDown = true;
  process.exitCode = exitCode;

  console.info(`[Server] Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections and give active requests time to finish.
  const closeHttpServer = new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        console.error("[Server] HTTP shutdown error:", error.message);
      } else {
        console.info("[Server] HTTP server closed.");
      }

      resolve();
    });
  });

  // Prevent the process from hanging indefinitely during shutdown.
  shutdownTimeout = setTimeout(() => {
    console.error(
      "[Server] Graceful shutdown timed out. Forcing remaining connections closed."
    );

    server.closeAllConnections?.();
  }, 10000);

  shutdownTimeout.unref();

  try {
    await closeHttpServer;
  } finally {
    try {
      await closeDatabase();
      console.info("[Server] Database connections closed.");
    } catch (error) {
      process.exitCode = 1;
      console.error(
        "[Server] Failed to close database connections:",
        error.message
      );
    }

    clearTimeout(shutdownTimeout);

    console.info("[Server] Shutdown complete.");
  }
}

// --------------------------------------------------
// Operating system signals
// --------------------------------------------------

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// --------------------------------------------------
// Unexpected application errors
// --------------------------------------------------

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled promise rejection:", reason);

  void shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught exception:", error);

  void shutdown("uncaughtException", 1);
});

export default server;