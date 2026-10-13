import { PoolClient } from 'pg';

export async function enqueueInAppNotification(
  client: PoolClient,
  tenantId: string,
  userId: string,
  eventType: string,
  subject: string,
  body: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO notifications (tenant_id, user_id, channel, event_type, subject, body, status)
     VALUES ($1, $2, 'IN_APP', $3, $4, $5::jsonb, 'PENDING')`,
    [tenantId, userId, eventType, subject, JSON.stringify(body)],
  );
}
