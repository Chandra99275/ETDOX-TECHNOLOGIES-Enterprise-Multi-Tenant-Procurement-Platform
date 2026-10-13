import { createDecipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseWebhookEncryptionKey } from '../src/config/env';
import { encryptWebhookSecret } from '../src/modules/webhooks/webhooks.crypto';

describe('webhook secret encryption', () => {
  it('accepts exactly 32-byte hexadecimal keys', () => {
    const value = '0123456789abcdef'.repeat(4);
    expect(parseWebhookEncryptionKey(value)).toHaveLength(32);
    expect(parseWebhookEncryptionKey(value.toUpperCase())).toHaveLength(32);
    expect(() => parseWebhookEncryptionKey(undefined)).toThrow(/64 hexadecimal characters/);
    expect(() => parseWebhookEncryptionKey('ab'.repeat(31))).toThrow(/64 hexadecimal characters/);
    expect(() => parseWebhookEncryptionKey('g'.repeat(64))).toThrow(/64 hexadecimal characters/);
  });

  it('encrypts with AES-256-GCM and rejects modified ciphertext', () => {
    const key = parseWebhookEncryptionKey('0123456789abcdef'.repeat(4));
    const secret = 'webhook-secret-with-sufficient-entropy';
    const encrypted = encryptWebhookSecret(secret, key);
    const [version, iv, tag, ciphertext] = encrypted.split(':');
    expect(version).toBe('v1');
    expect(encrypted).not.toContain(secret);

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    expect(decrypted).toBe(secret);

    const tampered = Buffer.from(tag, 'base64url');
    tampered[0] ^= 0xff;
    const invalid = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    invalid.setAuthTag(tampered);
    invalid.update(Buffer.from(ciphertext, 'base64url'));
    expect(() => invalid.final()).toThrow();
  });
});
