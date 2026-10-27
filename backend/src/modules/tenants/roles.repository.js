
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

export async function listRoles(context) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, name, description, permissions, is_system, created_at, updated_at
       FROM roles
       WHERE tenant_id = $1
       ORDER BY is_system DESC, name`,
      [context.tenantId]
    );

    return result.rows;
  });
}

export async function createRole(context, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    try {
      const result = await client.query(
        `INSERT INTO roles (tenant_id, name, description, permissions)
         VALUES ($1, lower($2), $3, $4)
         RETURNING id, name, description, permissions, is_system, created_at, updated_at`,
        [
          context.tenantId,
          input.name,
          input.description ?? null,
          input.permissions,
        ]
      );

      await audit(
        client,
        context,
        'role.created',
        result.rows[0].id,
        { permissions: input.permissions }
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'ROLE_EXISTS',
          'A role with this name already exists'
        );
      }

      throw error;
    }
  });
}

export async function updateRole(context, id, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    try {
      const result = await client.query(
        `UPDATE roles SET
           name = COALESCE(lower($3), name),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           permissions = COALESCE($6::text[], permissions),
           updated_at = now()
         WHERE tenant_id = $1
           AND id = $2
           AND is_system = false
         RETURNING id, name, description, permissions, is_system, created_at, updated_at`,
        [
          context.tenantId,
          id,
          input.name ?? null,
          Object.prototype.hasOwnProperty.call(input, 'description'),
          input.description ?? null,
          input.permissions ?? null,
        ]
      );

      if (!result.rowCount) {
        const exists = await client.query(
          'SELECT 1 FROM roles WHERE tenant_id = $1 AND id = $2',
          [context.tenantId, id]
        );

        if (!exists.rowCount) {
          throw new AppError(404, 'NOT_FOUND', 'Role not found');
        }

        throw new AppError(
          409,
          'SYSTEM_ROLE_PROTECTED',
          'System roles cannot be modified'
        );
      }

      await audit(client, context, 'role.updated', id, {
        fields: Object.keys(input),
      });

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'ROLE_EXISTS',
          'A role with this name already exists'
        );
      }

      throw error;
    }
  });
}

export async function deleteRole(context, id) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const role = await client.query(
      `SELECT is_system
       FROM roles
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!role.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Role not found');
    }

    if (role.rows[0].is_system) {
      throw new AppError(
        409,
        'SYSTEM_ROLE_PROTECTED',
        'System roles cannot be deleted'
      );
    }

    await audit(client, context, 'role.deleted', id, {});

    try {
      await client.query(
        'DELETE FROM roles WHERE tenant_id = $1 AND id = $2',
        [context.tenantId, id]
      );
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError(
          409,
          'ROLE_IN_USE',
          'Remove this role from users before deleting it'
        );
      }

      throw error;
    }
  });
}

async function audit(client, context, action, id, metadata) {
  await client.query(
    `INSERT INTO audit_events
       (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'role', $4, $5::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
      id,
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
