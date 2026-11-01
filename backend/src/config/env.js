<<<<<<< HEAD
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();
=======
import "dotenv/config";
import { z } from "zod";
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

<<<<<<< HEAD
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://etdox_user:postgre99@localhost:5432/etdox_dev";
=======
  HOST: z.string().default("0.0.0.0"),
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

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

  ETDOX_DEMO_TENANT_ID: z
    .string()
    .uuid()
    .default("b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e"),

  ETDOX_DEMO_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

<<<<<<< HEAD
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
=======
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid backend environment configuration:");

  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }

  throw new Error("Backend environment validation failed.");
}

<<<<<<< HEAD
export { env };
export default env;
=======
export const env = Object.freeze({
  nodeEnv: parsed.data.NODE_ENV,
  isDevelopment: parsed.data.NODE_ENV === "development",
  isProduction: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",

  port: parsed.data.PORT,
  host: parsed.data.HOST,
  frontendUrl: parsed.data.FRONTEND_URL,

  databaseUrl: parsed.data.DATABASE_URL,
  dbPoolMax: parsed.data.DB_POOL_MAX,
  dbSsl: parsed.data.DB_SSL,

  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,

  demoTenantId: parsed.data.ETDOX_DEMO_TENANT_ID,
  demoAuthEnabled: parsed.data.ETDOX_DEMO_AUTH,

  logLevel: parsed.data.LOG_LEVEL,
});
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
