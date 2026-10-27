
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';
import { costCenterSchema, departmentSchema } from './tenants.schema.js';

export async function getTenant(context) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, name, slug, base_currency, status, settings, created_at, updated_at
       FROM tenants
       WHERE id = $1`,
      [context.tenantId]
    );

    if (!result.rowCount) {
      throw new AppError(
        404,
        'TENANT_NOT_FOUND',
        'Organization not found'
      );
    }

    return result.rows[0];
  });
}

export async function updateTenant(context, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `UPDATE tenants
       SET name = COALESCE($2, name),
           base_currency = COALESCE(upper($3), base_currency),
           settings = COALESCE($4::jsonb, settings),
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, base_currency, status, settings, created_at, updated_at`,
      [
        context.tenantId,
        input.name ?? null,
        input.baseCurrency ?? null,
        input.settings ? JSON.stringify(input.settings) : null,
      ]
    );

    if (!result.rowCount) {
      throw new AppError(
        404,
        'TENANT_NOT_FOUND',
        'Organization not found'
      );
    }

    await audit(
      client,
      context,
      'tenant.updated',
      context.tenantId,
      { fields: Object.keys(input) }
    );

    return result.rows[0];
  });
}

export async function listDepartments(context) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT d.id, d.name, d.code, d.manager_id, d.parent_department_id,
              d.is_active, d.created_at, d.updated_at
       FROM departments d
       WHERE d.tenant_id = $1
       ORDER BY d.name, d.id`,
      [context.tenantId]
    );

    return result.rows;
  });
}

export async function createDepartment(context, input) {
  // Validate input at runtime using the existing Zod schema.
  const validatedInput = departmentSchema.parse(input);

  return withTenantTransaction(context.tenantId, async (client) => {
    try {
      const result = await client.query(
        `INSERT INTO departments
           (tenant_id, name, code, manager_id, parent_department_id)
         VALUES ($1, $2, upper($3), $4, $5)
         RETURNING *`,
        [
          context.tenantId,
          validatedInput.name,
          validatedInput.code,
          validatedInput.managerId ?? null,
          validatedInput.parentDepartmentId ?? null,
        ]
      );

      await audit(
        client,
        context,
        'department.created',
        result.rows[0].id,
        {}
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'DEPARTMENT_EXISTS',
          'A department with this name or code already exists'
        );
      }

      if (isForeignKeyViolation(error)) {
        throw new AppError(
          400,
          'INVALID_DEPARTMENT_REFERENCE',
          'The manager or parent department must belong to this organization'
        );
      }

      throw error;
    }
  });
}

export async function listCostCenters(context) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, department_id, code, name, is_active, created_at, updated_at
       FROM cost_centers
       WHERE tenant_id = $1
       ORDER BY code, id`,
      [context.tenantId]
    );

    return result.rows;
  });
}

export async function createCostCenter(context, input) {
  // Validate input at runtime using the existing Zod schema.
  const validatedInput = costCenterSchema.parse(input);

  return withTenantTransaction(context.tenantId, async (client) => {
    try {
      const result = await client.query(
        `INSERT INTO cost_centers
           (tenant_id, department_id, code, name)
         VALUES ($1, $2, upper($3), $4)
         RETURNING *`,
        [
          context.tenantId,
          validatedInput.departmentId ?? null,
          validatedInput.code,
          validatedInput.name,
        ]
      );

      await audit(
        client,
        context,
        'cost_center.created',
        result.rows[0].id,
        {}
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'COST_CENTER_EXISTS',
          'A cost center with this code already exists'
        );
      }

      if (isForeignKeyViolation(error)) {
        throw new AppError(
          400,
          'INVALID_DEPARTMENT',
          'The department must belong to this organization'
        );
      }

      throw error;
    }
  });
}

async function audit(client, context, action, resourceId, metadata) {
  await client.query(
    `INSERT INTO audit_events
       (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, $4, $5, $6::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
      action.split('.')[0],
      resourceId,
      JSON.stringify(metadata),
    ]
  );
}

function isUniqueViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

function isForeignKeyViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503'
  );
}
