import { isIP } from 'node:net';
import { z } from 'zod';

function isBlockedIpv4(host: string): boolean {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b, c, d] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 255 && b === 255 && c === 255 && d === 255);
}

function isBlockedIpv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isBlockedIpv4(mapped);
    const mappedWords = mapped.split(':');
    let high: number;
    let low: number;
    if (mappedWords.length === 2 && mappedWords.every(word => /^[\da-f]{1,4}$/i.test(word))) {
      high = parseInt(mappedWords[0], 16);
      low = parseInt(mappedWords[1], 16);
    } else {
      const groups = expandIpv6(mapped);
      if (!groups) return true;
      high = parseInt(groups[6], 16);
      low = parseInt(groups[7], 16);
    }
    return isBlockedIpv4([high >> 8, high & 255, low >> 8, low & 255].join('.'));
  }
  const groups = expandIpv6(normalized);
  if (!groups) return true;
  const first = parseInt(groups[0], 16);
  const second = parseInt(groups[1], 16);
  const firstSixZero = groups.slice(0, 6).every(group => group === '0');
  return firstSixZero ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    first < 0x2000 || first > 0x3fff ||
    (first === 0x2001 && second <= 0x01ff) ||
    (first === 0x2001 && second === 0x0db8) ||
    first === 0x2002 ||
    (first === 0x3fff && second <= 0x0fff) ||
    (first === 0x0064 && second === 0xff9b);
}

function expandIpv6(host: string): string[] | null {
  if (!host.includes(':')) return null;
  const halves = host.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  if (groups.length !== 8 || groups.some(group => !/^[\da-f]{1,4}$/i.test(group))) return null;
  return groups.map(group => parseInt(group, 16).toString(16));
}

// DNS hostnames must be resolved and every resulting address revalidated by the delivery worker to prevent DNS rebinding.
function isSafeEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return !isBlockedIpv4(hostname);
  if (ipVersion === 6) return !isBlockedIpv6(hostname);
  return true;
}

const endpointUrl = z.string().trim().url().max(2048).refine(isSafeEndpoint, {
  message: 'Endpoint must use HTTP or HTTPS, contain no credentials, and not target a local or private address',
});
const events = z.array(z.string().trim().min(1).max(150).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/))
  .min(1).max(100).refine(value => new Set(value).size === value.length, 'Event names must be unique');

export const createWebhookSchema = z.object({
  name: z.string().trim().min(1).max(160),
  endpointUrl,
  secret: z.string().min(32).max(4096),
  subscribedEvents: events,
}).strict();

export const updateWebhookSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  endpointUrl: endpointUrl.optional(),
  secret: z.string().min(32).max(4096).optional(),
  subscribedEvents: events.optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const listWebhooksSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export const listDeliveriesSchema = z.object({
  status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'ABANDONED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export const listDeliveryAttemptsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export const webhookIdSchema = z.object({ id: z.string().uuid() }).strict();
export const deliveryIdSchema = z.object({ deliveryId: z.string().uuid() }).strict();
export const webhookDeliveryParamsSchema = z.object({
  id: z.string().uuid(),
  deliveryId: z.string().uuid(),
}).strict();

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
