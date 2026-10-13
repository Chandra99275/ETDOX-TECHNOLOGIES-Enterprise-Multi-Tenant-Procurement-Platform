import { withTenantTransaction } from '../../database/db';
import { AnalyticsOptions } from './analytics.schema';

export interface StatusKpi {
  status: string;
  count: number;
}

export async function getAnalyticsSummary(
  tenantId: string, options: AnalyticsOptions,
): Promise<{ generatedAt: string; purchaseRequests: { total: number; byStatus: StatusKpi[] } }> {
  return withTenantTransaction(tenantId, async client => {
    const values: unknown[] = [tenantId];
    const filters = ['tenant_id = $1'];
    if (options.from) {
      values.push(options.from);
      filters.push(`created_at >= $${values.length}`);
    }
    if (options.to) {
      values.push(options.to);
      filters.push(`created_at <= $${values.length}`);
    }
    const result = await client.query<{ status: string; count: string }>(
      `SELECT status, count(*)::text AS count
       FROM purchase_requests WHERE ${filters.join(' AND ')}
       GROUP BY status ORDER BY status`,
      values,
    );
    const byStatus = result.rows.map(row => ({
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
