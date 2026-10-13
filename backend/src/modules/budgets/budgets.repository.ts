import { PoolClient } from 'pg';
import { withTenantTransaction } from '../../database/db';
import { AppError } from '../../utils/errors';
import { CreateBudgetInput, UpdateBudgetInput, BudgetListOptions } from './budgets.schema';
import { RequestContext } from './budgets.types';

export async function listBudgets(
  context: RequestContext, options: BudgetListOptions,
): Promise<{ data: Record<string, unknown>[]; pagination: { limit: number; offset: number; total: number } }> {
  return withTenantTransaction(context.tenantId, async client => {
    const values: unknown[] = [context.tenantId];
    const filters = ['tenant_id = $1'];
    if (options.fiscalYear !== undefined) {
      values.push(options.fiscalYear);
      filters.push(`fiscal_year = $${values.length}`);
    }
    if (options.departmentId !== undefined) {
      values.push(options.departmentId);
      filters.push(`department_id = $${values.length}`);
    }
    if (options.costCenterId !== undefined) {
      values.push(options.costCenterId);
      filters.push(`cost_center_id = $${values.length}`);
    }
    const where = filters.join(' AND ');
    const result = await client.query(
      `SELECT id, department_id, cost_center_id, fiscal_year, currency,
              allocated::text, reserved::text, committed::text, spent::text, created_at, updated_at
       FROM budgets WHERE ${where} ORDER BY fiscal_year DESC, currency, id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM budgets WHERE ${where}`,
      values,
    );
    return {
      data: result.rows,
      pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) },
    };
  });
}

export async function createBudget(context: RequestContext, input: CreateBudgetInput): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    try {
      const result = await client.query(
        `INSERT INTO budgets (tenant_id, department_id, cost_center_id, fiscal_year, currency, allocated, reserved, committed, spent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING
         id, department_id, cost_center_id, fiscal_year, currency,
         allocated::text, reserved::text, committed::text, spent::text, created_at, updated_at`,
        [
          context.tenantId, input.departmentId ?? null, input.costCenterId ?? null, input.fiscalYear,
          input.currency, input.allocated, input.reserved, input.committed, input.spent,
        ],
      );
      await audit(client, context, 'budget.created', result.rows[0].id, {
        fiscalYear: input.fiscalYear, currency: input.currency,
      });
      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'BUDGET_DIMENSIONS_EXISTS', 'A budget already exists for these period dimensions');
      if (isForeignKeyViolation(error)) throw new AppError(400, 'INVALID_BUDGET_DIMENSION', 'The department or cost center does not exist in this organization');
      throw error;
    }
  });
}

export async function updateBudget(
  context: RequestContext, id: string, input: UpdateBudgetInput,
): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    try {
      const result = await client.query(
        `UPDATE budgets SET
           department_id = CASE WHEN $3::boolean THEN $4::uuid ELSE department_id END,
           cost_center_id = CASE WHEN $5::boolean THEN $6::uuid ELSE cost_center_id END,
           fiscal_year = COALESCE($7, fiscal_year),
           currency = COALESCE($8, currency),
           allocated = COALESCE($9, allocated),
           reserved = COALESCE($10, reserved),
           committed = COALESCE($11, committed),
           spent = COALESCE($12, spent),
           updated_at = now()
         WHERE tenant_id = $1 AND id = $2 RETURNING
           id, department_id, cost_center_id, fiscal_year, currency,
           allocated::text, reserved::text, committed::text, spent::text, created_at, updated_at`,
        [
          context.tenantId, id,
          Object.prototype.hasOwnProperty.call(input, 'departmentId'), input.departmentId ?? null,
          Object.prototype.hasOwnProperty.call(input, 'costCenterId'), input.costCenterId ?? null,
          input.fiscalYear ?? null, input.currency ?? null, input.allocated ?? null, input.reserved ?? null,
          input.committed ?? null, input.spent ?? null,
        ],
      );
      if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Budget not found');
      await audit(client, context, 'budget.updated', id, { fields: Object.keys(input) });
      return result.rows[0];
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (isUniqueViolation(error)) throw new AppError(409, 'BUDGET_DIMENSIONS_EXISTS', 'A budget already exists for these period dimensions');
      if (isForeignKeyViolation(error)) throw new AppError(400, 'INVALID_BUDGET_DIMENSION', 'The department or cost center does not exist in this organization');
      throw error;
    }
  });
}

async function audit(client: PoolClient, context: RequestContext, action: string, id: string, metadata: object): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'budget', $4, $5::jsonb)`,
    [context.tenantId, context.userId, action, id, JSON.stringify(metadata)],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}
