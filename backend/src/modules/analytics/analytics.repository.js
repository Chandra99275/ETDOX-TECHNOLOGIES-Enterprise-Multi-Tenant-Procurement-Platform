
import { withTenantTransaction } from '../../database/db.js';

export async function getAnalyticsSummary(tenantId, options) {
  return withTenantTransaction(tenantId, async (client) => {
    const values = [tenantId];
    const filters = ['tenant_id = $1'];

    if (options.from) {
      values.push(options.from);
      filters.push(`created_at >= $${values.length}`);
    }

    if (options.to) {
      values.push(options.to);
      filters.push(`created_at <= $${values.length}`);
    }

    const result = await client.query(
      `SELECT status, count(*)::text AS count
       FROM purchase_requests
       WHERE ${filters.join(' AND ')}
       GROUP BY status
       ORDER BY status`,
      values
    );

    const byStatus = result.rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));

    return {
      generatedAt: new Date().toISOString(),
      purchaseRequests: {
        total: byStatus.reduce((sum, item) => sum + item.count, 0),
        byStatus,
      },
    };
  });
}
