
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

export async function listNotifications(context, options) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const unreadOnly = options.unreadOnly ?? false;

    const result = await client.query(
      `SELECT id, channel, event_type, subject, body, status, read_at, sent_at, created_at, updated_at
       FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND channel = 'IN_APP' AND status <> 'CANCELLED'
         AND (NOT $3::boolean OR (status <> 'READ' AND read_at IS NULL))
       ORDER BY created_at DESC, id DESC
       LIMIT $4 OFFSET $5`,
      [
        context.tenantId,
        context.userId,
        unreadOnly,
        options.limit,
        options.offset,
      ]
    );

    const count = await client.query(
      `SELECT count(*)::text AS total
       FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND channel = 'IN_APP' AND status <> 'CANCELLED'
         AND (NOT $3::boolean OR (status <> 'READ' AND read_at IS NULL))`,
      [context.tenantId, context.userId, unreadOnly]
    );

    const unread = await client.query(
      `SELECT count(*)::text AS total
       FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND channel = 'IN_APP'
         AND status <> 'READ' AND status <> 'CANCELLED' AND read_at IS NULL`,
      [context.tenantId, context.userId]
    );

    return {
      data: result.rows,
      unreadCount: Number(unread.rows[0].total),
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: Number(count.rows[0].total),
      },
    };
  });
}

export async function getNotification(context, id) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, channel, event_type, subject, body, status, read_at, sent_at, created_at, updated_at
       FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND channel = 'IN_APP'
         AND status <> 'CANCELLED'`,
      [context.tenantId, context.userId, id]
    );

    if (!result.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    }

    return result.rows[0];
  });
}

export async function markNotificationRead(context, id) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const updated = await client.query(
      `UPDATE notifications
       SET status = 'READ', read_at = COALESCE(read_at, now()), updated_at = now()
       WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND channel = 'IN_APP'
         AND status <> 'CANCELLED' AND (status <> 'READ' OR read_at IS NULL)
       RETURNING id, channel, event_type, subject, body, status, read_at, sent_at, created_at, updated_at`,
      [context.tenantId, context.userId, id]
    );

    if (updated.rowCount) {
      await client.query(
        `INSERT INTO audit_events (
           tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata
         )
         VALUES ($1, 'USER', $2, 'notification.read', 'notification', $3, '{}'::jsonb)`,
        [context.tenantId, context.userId, id]
      );

      return updated.rows[0];
    }

    const existing = await client.query(
      `SELECT id, channel, event_type, subject, body, status, read_at, sent_at, created_at, updated_at
       FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND channel = 'IN_APP'
         AND status <> 'CANCELLED'`,
      [context.tenantId, context.userId, id]
    );

    if (!existing.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    }

    return existing.rows[0];
  });
}
