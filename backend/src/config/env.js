// src/config/env.js
// Local development configuration — does not read from .env.

const nodeEnv = "development";
const port = 5000;
const host = "0.0.0.0";

// Replace YOUR_POSTGRES_PASSWORD with your actual PostgreSQL password.
// Keep the database name and username consistent with your PostgreSQL setup.
const databaseUrl =
  "postgresql://etdox_user:YOUR_POSTGRES_PASSWORD@localhost:5432/etdox";

// Replace this with your existing JWT secret (at least 32 characters).
const jwtSecret = "REPLACE_WITH_YOUR_EXISTING_JWT_SECRET";

// Replace this with your existing 64-character hexadecimal key.
const webhookEncryptionKeyHex =
  "REPLACE_WITH_YOUR_EXISTING_64_CHARACTER_HEX_KEY";

const jwtExpiresIn = "8h";
const defaultCurrency = "USD";

// Local frontend addresses.
const corsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

const corsOrigin = corsOrigins[0];

// Local development settings.
const demoLoginEnabled = true;
const demoTenantId = "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";

// Redis is disabled in this configuration.
const redisUrl = "";
const redisEnabled = false;

// --------------------------------------------------
// Validate configuration
// --------------------------------------------------

if (
  databaseUrl.includes("YOUR_POSTGRES_PASSWORD") ||
  !databaseUrl.startsWith("postgresql://")
) {
  throw new Error(
    "Set your actual PostgreSQL credentials in src/config/env.js."
  );
}

if (
  jwtSecret.startsWith("REPLACE_") ||
  jwtSecret.length < 32
) {
  throw new Error(
    "Set a valid JWT secret of at least 32 characters in src/config/env.js."
  );
}

if (
  webhookEncryptionKeyHex.startsWith("REPLACE_") ||
  !/^[0-9a-fA-F]{64}$/.test(webhookEncryptionKeyHex)
) {
  throw new Error(
    "Set a valid 64-character hexadecimal webhook key in src/config/env.js."
  );
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid backend port in src/config/env.js.");
}

const webhookEncryptionKey = Buffer.from(
  webhookEncryptionKeyHex,
  "hex"
);

const env = Object.freeze({
  nodeEnv,
  isProduction: false,
  isDevelopment: true,
  host,
  port,

  databaseUrl,

  redisUrl,
  redisEnabled,

  jwtSecret,
  jwtExpiresIn,

  demoLoginEnabled,
  demoTenantId,

  webhookEncryptionKey,

  defaultCurrency,
  corsOrigin,
  corsOrigins,
});

export { env };
export default env;