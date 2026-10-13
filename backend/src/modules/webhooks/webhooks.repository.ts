import { withTenantTransaction } from '../../database/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { encryptWebhookSecret } from './webhooks.crypto';
import {
  CreateWebhookInput,
  UpdateWebhookInput,
} from './webhooks.schema';
import { PageOptions, WebhookContext } from './webhooks.types';

const webhookColumns = `id, name, endpoint_url, subscribed_events, status, created_by, created_at, updated_at`;

function translateDatabaseError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const dbError = error as { code?: string; constraint?: string };
    if (dbError.code === '23505') {
      throw new AppError(409, 'WEBHOOK_NAME_EXISTS', 'A webhook with this name already exists');
    }
    if (dbError.code === '23514' && dbError.constraint === 'webhooks_endpoint_url_check') {
      throw new AppError(400, 'ENDPOINT_SCHEME_UNSUPPORTED', 'The current database schema only permits HTTPS webhook endpoints');
    }
  }
  throw error;
}

async function audit(
  client: Parameters<Parameters<typeof withTenantTransaction>[1]>[0],
  context: WebhookContext,
  action: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'webhook', $4, $5::jsonb)`,
    [context.tenantId, context.userId, action, resourceId, JSON.stringify(metadata)],
  );
}

export async function createWebhook(
  context: WebhookContext,
  input: CreateWebhookInput,
): Promise<Record<string, unknown>> {
  try {
    return await withTenantTransaction(context.tenantId, async client => {
      const result = await client.query(
        `INSERT INTO webhooks (tenant_id, name, endpoint_url, secret_encrypted, subscribed_events, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${webhookColumns}`,
        [
          context.tenantId, input.name, input.endpointUrl, encryptWebhookSecret(input.secret, env.webhookEncryptionKey),
          input.subscribedEvents, context.userId,
        ],
      );
      await audit(client, context, 'webhook.created', result.rows[0].id, {
        name: input.name, endpointUrl: input.endpointUrl, subscribedEvents: input.subscribedEvents,
      });
      return result.rows[0];
    });
  } catch (error) {
    return translateDatabaseError(error);
  }
}

export async function listWebhooks(
  context: WebhookContext,
  options: PageOptions & { status?: string },
): Promise<{ data: Record<string, unknown>[]; pagination: { limit: number; offset: number; total: number } }> {
  return withTenantTransaction(context.tenantId, async client => {
    const values = [context.tenantId, options.status ?? null];
    const result = await client.query(
      `SELECT ${webhookColumns} FROM webhooks
       WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
      [...values, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM webhooks WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2)',
      values,
    );
    return {
      data: result.rows,
      pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) },
    };
  });
}

export async function getWebhook(context: WebhookContext, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `SELECT ${webhookColumns} FROM webhooks WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id],
    );
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
    return result.rows[0];
  });
}

export async function updateWebhook(
  context: WebhookContext,
  id: string,
  input: UpdateWebhookInput,
): Promise<Record<string, unknown>> {
  try {
    return await withTenantTransaction(context.tenantId, async client => {
      const result = await client.query(
        `UPDATE webhooks SET
           name = COALESCE($3, name),
           endpoint_url = COALESCE($4, endpoint_url),
           secret_encrypted = COALESCE($5, secret_encrypted),
           subscribed_events = COALESCE($6::text[], subscribed_events),
           status = COALESCE($7, status),
           updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING ${webhookColumns}`,
        [
          context.tenantId, id, input.name ?? null, input.endpointUrl ?? null,
          input.secret ? encryptWebhookSecret(input.secret, env.webhookEncryptionKey) : null,
          input.subscribedEvents ?? null, input.status ?? null,
        ],
      );
      if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
      await audit(client, context, 'webhook.updated', id, { fields: Object.keys(input) });
      return result.rows[0];
    });
  } catch (error) {
    return translateDatabaseError(error);
  }
}

export async function deleteWebhook(context: WebhookContext, id: string): Promise<void> {
  await withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      'DELETE FROM webhooks WHERE tenant_id = $1 AND id = $2 RETURNING id',
      [context.tenantId, id],
    );
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
    await audit(client, context, 'webhook.deleted', id);
  });
}

export async function listWebhookDeliveries(
  context: WebhookContext,
  webhookId: string,
  options: PageOptions & { status?: string },
): Promise<{ data: Record<string, unknown>[]; pagination: { limit: number; offset: number; total: number } }> {
  return withTenantTransaction(context.tenantId, async client => {
    const webhook = await client.query(
      'SELECT id FROM webhooks WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, webhookId],
    );
    if (!webhook.rowCount) throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
    const values = [context.tenantId, webhookId, options.status ?? null];
    const result = await client.query(
      `SELECT id, webhook_id, event_id, event_type, payload, status, attempt_count,
              next_attempt_at, delivered_at, created_at
       FROM webhook_deliveries
       WHERE tenant_id = $1 AND webhook_id = $2 AND ($3::text IS NULL OR status = $3)
       ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`,
      [...values, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM webhook_deliveries
       WHERE tenant_id = $1 AND webhook_id = $2 AND ($3::text IS NULL OR status = $3)`,
      values,
    );
    return {
      data: result.rows,
      pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) },
    };
  });
}

export async function listDeliveryAttempts(
  context: WebhookContext,
  webhookId: string,
  deliveryId: string,
  options: PageOptions,
): Promise<{ data: Record<string, unknown>[]; pagination: { limit: number; offset: number; total: number } }> {
  return withTenantTransaction(context.tenantId, async client => {
    const delivery = await client.query(
      `SELECT id FROM webhook_deliveries
       WHERE tenant_id = $1 AND webhook_id = $2 AND id = $3`,
      [context.tenantId, webhookId, deliveryId],
    );
    if (!delivery.rowCount) throw new AppError(404, 'NOT_FOUND', 'Webhook delivery not found');
    const attempts = await client.query(
      `SELECT id, delivery_id, attempt_number, response_status, response_excerpt, error, duration_ms, attempted_at
       FROM webhook_delivery_attempts
       WHERE tenant_id = $1 AND delivery_id = $2
       ORDER BY attempt_number ASC LIMIT $3 OFFSET $4`,
      [context.tenantId, deliveryId, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM webhook_delivery_attempts
       WHERE tenant_id = $1 AND delivery_id = $2`,
      [context.tenantId, deliveryId],
    );
    return {
      data: attempts.rows,
      pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) },
    };
  });
}

export async function replayWebhookDelivery(
  context: WebhookContext,
  webhookId: string,
  deliveryId: string,
): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `UPDATE webhook_deliveries
       SET status = 'PENDING', next_attempt_at = now()
       WHERE tenant_id = $1 AND webhook_id = $2 AND id = $3
         AND status IN ('FAILED', 'ABANDONED')
         AND EXISTS (
           SELECT 1 FROM webhooks
           WHERE tenant_id = $1 AND id = $2 AND status = 'ACTIVE'
         )
       RETURNING id, webhook_id, event_id, event_type, payload, status, attempt_count,
                 next_attempt_at, delivered_at, created_at`,
      [context.tenantId, webhookId, deliveryId],
    );
    if (!result.rowCount) {
      const existing = await client.query(
        `SELECT d.id, w.status AS webhook_status
         FROM webhook_deliveries d
         JOIN webhooks w ON w.tenant_id = d.tenant_id AND w.id = d.webhook_id
         WHERE d.tenant_id = $1 AND d.webhook_id = $2 AND d.id = $3`,
        [context.tenantId, webhookId, deliveryId],
      );
      if (!existing.rowCount) throw new AppError(404, 'NOT_FOUND', 'Webhook delivery not found');
      if (existing.rows[0].webhook_status !== 'ACTIVE') {
        throw new AppError(409, 'WEBHOOK_INACTIVE', 'Only deliveries for active webhooks may be replayed');
      }
      throw new AppError(409, 'INVALID_STATE', 'Only failed or abandoned deliveries may be replayed');
    }
    await audit(client, context, 'webhook.delivery_replayed', deliveryId, { webhookId });
    return result.rows[0];
  });
}
