
import { createCipheriv, randomBytes } from 'node:crypto';

export function encryptWebhookSecret(secret, key) {
  if (key.length !== 32) {
    throw new Error(
      'Webhook encryption key must be exactly 32 bytes'
    );
  }

  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}
