
import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// --------------------------------------------------
// Environment file loading
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env, then load the default .env if present.
// Existing process environment variables take precedence.
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

// --------------------------------------------------
// Environment validation
// --------------------------------------------------

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5000),

  HOST: z.string().default("0.0.0.0"),

  FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:5173"),

  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  DB_POOL_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),

  DB_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters")
    .refine(
      (value) =>
        !/change[-_ ]?me|replace[-_ ]?with|your[-_ ]?secret|placeholder/i.test(
          value
        ),
      "JWT_SECRET must not be a placeholder"
    ),

  JWT_EXPIRES_IN: z.string().default("1h"),

  JWT_ISSUER: z.string().default("etdox-procurement-api"),

  JWT_AUDIENCE: z.string().default("etdox-client"),

  ETDOX_DEMO_TENANT_ID: z
    .string()
    .uuid()
    .default("b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e"),

  ETDOX_DEMO_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  REDIS_URL: z.string().default(""),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  HTTP_LOGGING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  TRUST_PROXY: z
    .enum(["0", "1"])
    .default("0"),

  AUTH_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .default(100),

  // SMTP configuration
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true"
    ),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM_EMAIL: z.string().default(""),
  SMTP_FROM_NAME: z.string().default("ETDOX"),

  // Backward-compatible email environment variables
  EMAIL: z.string().default(""),
  SECRET: z.string().default(""),

  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .default(1440),

  PASSWORD_RESET_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .default(30),

  // Webhook encryption key must be a 64-character hex string.
  WEBHOOK_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, {
      message: "WEBHOOK_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters",
    })
    .optional(),

  DEFAULT_CURRENCY: z.string().default("INR"),

  API_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:5000"),
});

// --------------------------------------------------
// Parse environment
// --------------------------------------------------

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid backend environment configuration:");

  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }

  throw new Error("Backend environment validation failed.");
}

const config = parsed.data;

// --------------------------------------------------
// Derived configuration
// --------------------------------------------------

const corsOrigins = config.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOrigin = corsOrigins[0] || config.FRONTEND_URL;

const redisUrl = config.REDIS_URL.trim();
const redisEnabled = /^rediss?:\/\//i.test(redisUrl);

const rawEmail = (
  config.SMTP_USER ||
  config.EMAIL
).trim().replace(/["']/g, "");

const rawSecret = config.SMTP_PASS || config.SECRET;

const smtpUser = rawEmail;
const smtpPass = rawSecret.trim().replace(/["'\s]/g, "");

const isGmail = smtpUser.toLowerCase().endsWith("@gmail.com");

const smtpHost =
  config.SMTP_HOST.trim() ||
  (isGmail ? "smtp.gmail.com" : "");

const smtpPort =
  config.SMTP_PORT ||
  (isGmail ? 465 : 587);

const smtpSecure =
  config.SMTP_SECURE ??
  (smtpPort === 465);

const smtpFromEmail = (
  config.SMTP_FROM_EMAIL ||
  smtpUser
).trim().replace(/["']/g, "");

const smtpFromName = config.SMTP_FROM_NAME
  .trim()
  .replace(/["']/g, "");

const webhookEncryptionKey = config.WEBHOOK_ENCRYPTION_KEY
  ? Buffer.from(config.WEBHOOK_ENCRYPTION_KEY, "hex")
  : null;

// Demo authentication is disabled by default.
// Enable it only through explicit configuration and only in development.
const demoLoginEnabled =
  config.NODE_ENV === "development" &&
  config.ETDOX_DEMO_AUTH === true;

// --------------------------------------------------
// Export normalized configuration
// --------------------------------------------------

export const env = Object.freeze({
  nodeEnv: config.NODE_ENV,
  isDevelopment: config.NODE_ENV === "development",
  isProduction: config.NODE_ENV === "production",
  isTest: config.NODE_ENV === "test",

  host: config.HOST,
  port: config.PORT,

  frontendUrl: config.FRONTEND_URL,
  apiBaseUrl: config.API_BASE_URL,

  corsOrigin,
  corsOrigins: Object.freeze(corsOrigins),

  databaseUrl: config.DATABASE_URL,
  dbPoolMax: config.DB_POOL_MAX,
  dbSsl: config.DB_SSL,

  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
  jwtIssuer: config.JWT_ISSUER,
  jwtAudience: config.JWT_AUDIENCE,

  demoLoginEnabled,
  demoAuthEnabled: demoLoginEnabled,
  demoTenantId: config.ETDOX_DEMO_TENANT_ID,

  redisUrl,
  redisEnabled,

  logLevel: config.LOG_LEVEL,
  httpLogging: config.HTTP_LOGGING,
  trustProxy: config.TRUST_PROXY === "1",
  authRateLimitMax: config.AUTH_RATE_LIMIT_MAX,

  webhookEncryptionKey,

  defaultCurrency: config.DEFAULT_CURRENCY,

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

  emailVerificationTtlMinutes:
    config.EMAIL_VERIFICATION_TTL_MINUTES,

  passwordResetTtlMinutes:
    config.PASSWORD_RESET_TTL_MINUTES,
});

export default env;
