import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isDevelopment = !isProduction;

const port = Number.parseInt(process.env.PORT || process.env.BACKEND_PORT || "5000", 10);
const host = process.env.HOST || "0.0.0.0";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://etdox_user:postgre99@localhost:5432/etdox_dev";

const jwtSecret =
  process.env.JWT_SECRET ||
  "e63da7e3016cdc9bcfcfc30779917328e9339a24cac9ad4dcb042ed50efaf7901eaa22dacc3560b6990f94d8316f9846";

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "8h";
const jwtIssuer = process.env.JWT_ISSUER || "etdox-api";
const jwtAudience = process.env.JWT_AUDIENCE || "etdox-app";

const webhookEncryptionKeyHex =
  process.env.WEBHOOK_ENCRYPTION_KEY ||
  "89d13a8203e2064eb669a3b9100cf2debfd90c7c6b518f26a897ce62623cf8c8";

const defaultCurrency = process.env.DEFAULT_CURRENCY || "USD";

const frontendUrl =
  process.env.FRONTEND_URL ||
  process.env.CORS_ORIGIN ||
  "http://localhost:5173";

const apiBaseUrl =
  process.env.API_BASE_URL ||
  `http://localhost:${port}/api/v1`;

const configuredOrigins = [
  process.env.CORS_ORIGINS,
  process.env.CORS_ORIGIN,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOrigins = Array.from(
  new Set([
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    ...configuredOrigins,
  ])
);

const corsOrigin = corsOrigins[0];

const demoLoginEnabled = false;

const demoTenantId =
  process.env.ETDOX_DEMO_TENANT_ID ||
  "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";

const redisUrl = process.env.REDIS_URL || "";
const redisEnabled = Boolean(redisUrl && redisUrl.startsWith("redis://"));

// --------------------------------------------------
// SMTP Email Configuration
// --------------------------------------------------

const rawEmail = (process.env.SMTP_USER || process.env.EMAIL || "").trim().replace(/["']/g, "");
const rawSecret = (process.env.SMTP_PASS || process.env.SECRET || "").trim();
const cleanSecret = rawSecret.replace(/["'\s]/g, "");

const isGmail = rawEmail.toLowerCase().endsWith("@gmail.com");

const smtpHost =
  process.env.SMTP_HOST ||
  (isGmail ? "smtp.gmail.com" : "");

const smtpPort = Number.parseInt(
  process.env.SMTP_PORT || (isGmail ? "465" : "587"),
  10
);

const smtpSecure =
  process.env.SMTP_SECURE === "true" ||
  (process.env.SMTP_SECURE === undefined && (smtpPort === 465 || isGmail));

const smtpUser = rawEmail;
const smtpPass = cleanSecret;

const smtpFromEmail =
  (process.env.SMTP_FROM_EMAIL || smtpUser || "etdox3300@gmail.com").trim().replace(/["']/g, "");

const smtpFromName =
  (process.env.SMTP_FROM_NAME || "ETDOX").trim().replace(/["']/g, "");

const emailVerificationTtlMinutes = Number.parseInt(
  process.env.EMAIL_VERIFICATION_TTL_MINUTES || "1440",
  10
);

const passwordResetTtlMinutes = Number.parseInt(
  process.env.PASSWORD_RESET_TTL_MINUTES || "30",
  10
);

let webhookEncryptionKey;
try {
  webhookEncryptionKey = Buffer.from(
    webhookEncryptionKeyHex.padEnd(64, "0").slice(0, 64),
    "hex"
  );
} catch {
  webhookEncryptionKey = Buffer.alloc(32);
}

const env = Object.freeze({
  nodeEnv,
  isProduction,
  isDevelopment,
  host,
  port,

  databaseUrl,

  redisUrl,
  redisEnabled,

  jwtSecret,
  jwtExpiresIn,
  jwtIssuer,
  jwtAudience,

  demoLoginEnabled,
  demoTenantId,

  webhookEncryptionKey,

  defaultCurrency,
  frontendUrl,
  apiBaseUrl,
  corsOrigin,
  corsOrigins,

  smtp: Object.freeze({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
    pass: smtpPass,
    fromEmail: smtpFromEmail,
    fromName: smtpFromName,
    isConfigured: Boolean(smtpHost && smtpUser && smtpPass),
  }),

  emailVerificationTtlMinutes,
  passwordResetTtlMinutes,
});

export function parseWebhookEncryptionKey(raw) {
  if (typeof raw !== 'string' || !/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
  }
  return Buffer.from(raw.trim(), 'hex');
}

export { env };
export default env;
