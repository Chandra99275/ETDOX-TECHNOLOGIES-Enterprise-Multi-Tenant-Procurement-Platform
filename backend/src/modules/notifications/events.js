
export async function enqueueInAppNotification(
  client,
  tenantId,
  userId,
  eventType,
  subject,
  body
) {
  await client.query(
    `INSERT INTO notifications (
       tenant_id,
       user_id,
       channel,
       event_type,
       subject,
       body,
       status
     )
     VALUES ($1, $2, 'IN_APP', $3, $4, $5::jsonb, 'PENDING')`,
    [
      tenantId,
      userId,
      eventType,
      subject,
      JSON.stringify(body),
    ]
  );
}
