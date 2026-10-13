import dotenv from 'dotenv';
import { SignOptions } from 'jsonwebtoken';
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const webhookEncryptionKey = parseWebhookEncryptionKey(process.env.WEBHOOK_ENCRYPTION_KEY);

if (!databaseUrl) throw new Error('DATABASE_URL must be configured');
if (
  !jwtSecret ||
  jwtSecret.length < 32 ||
  jwtSecret.startsWith('REPLACE_WITH_') ||
  jwtSecret === 'super-secret-jwt-signing-key-minimum-32-chars'
) {
  throw new Error('JWT_SECRET must be replaced with a unique secret containing at least 32 characters');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl,
  redisUrl: process.env.REDIS_URL ?? '',
  jwtSecret,
  webhookEncryptionKey,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as NonNullable<SignOptions['expiresIn']>,
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};

export function parseWebhookEncryptionKey(value: string | undefined): Buffer {
  if (!value || !/^[\da-fA-F]{64}$/.test(value)) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY must be configured as exactly 64 hexadecimal characters (32 bytes)');
  }
  return Buffer.from(value, 'hex');
}
