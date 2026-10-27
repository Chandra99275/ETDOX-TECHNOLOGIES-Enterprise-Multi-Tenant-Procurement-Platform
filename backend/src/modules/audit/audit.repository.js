
import { withTenantTransaction } from '../../database/db.js';

export async function searchAuditEvents(tenantId, options) {
  return withTenantTransaction(tenantId, async (client) => {
    const values = [tenantId];
    const filters = ['tenant_id = $1'];

    const addFilter = (column, value, operator = '=') => {
      if (value === undefined) return;

      values.push(value);
      filters.push(`${column} ${operator} $${values.length}`);
    };

    addFilter('action', options.action);
    addFilter('resource_type', options.resourceType);
    addFilter('resource_id', options.resourceId);
    addFilter('actor_id', options.actorId);
    addFilter('created_at', options.from, '>=');
    addFilter('created_at', options.to, '<=');

    const where = filters.join(' AND ');
    const pageValues = [
      ...values,
      options.limit,
      options.offset,
    ];

    const result = await client.query(
      `SELECT id, actor_type, actor_id, action, resource_type, resource_id,
              request_id, ip_address, user_agent, metadata, created_at
       FROM audit_events
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      pageValues
    );

    const count = await client.query(
      `SELECT count(*)::text AS total
       FROM audit_events
       WHERE ${where}`,
      values
    );

    return {
      data: result.rows,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: Number(count.rows[0].total),
      },
    };
  });
}
