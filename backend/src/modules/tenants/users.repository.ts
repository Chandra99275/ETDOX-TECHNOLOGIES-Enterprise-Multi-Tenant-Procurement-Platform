import bcrypt from 'bcryptjs';
import { withTenantTransaction } from '../../database/db';
import { RequestContext } from '../../middleware/auth';
import { AppError } from '../../utils/errors';
import { CreateUserInput, UpdateUserInput } from './users.types';

interface UserListOptions { active?: 'true' | 'false'; search?: string; limit: number; offset: number }

export async function listUsers(context: RequestContext, options: UserListOptions): Promise<{
  data: Record<string, unknown>[];
  pagination: { limit: number; offset: number; total: number };
}> {
  return withTenantTransaction(context.tenantId, async client => {
    const params = [
      context.tenantId,
      options.active === undefined ? null : options.active === 'true',
      options.search ? `%${options.search}%` : null,
    ];
    const result = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.title, u.phone,
              u.department_id, u.is_active, u.created_at, u.updated_at,
              COALESCE(array_agg(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL), ARRAY[]::uuid[]) AS role_ids,
              COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
       LEFT JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
       WHERE u.tenant_id = $1 AND ($2::boolean IS NULL OR u.is_active = $2)
         AND ($3::text IS NULL OR u.email ILIKE $3 OR u.first_name ILIKE $3 OR u.last_name ILIKE $3)
       GROUP BY u.id ORDER BY u.created_at DESC, u.id DESC LIMIT $4 OFFSET $5`,
      [...params, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM users u
       WHERE u.tenant_id = $1 AND ($2::boolean IS NULL OR u.is_active = $2)
         AND ($3::text IS NULL OR u.email ILIKE $3 OR u.first_name ILIKE $3 OR u.last_name ILIKE $3)`,
      params,
    );
    return { data: result.rows, pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) } };
  });
}

export async function getUser(context: RequestContext, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.title, u.phone,
              u.department_id, u.is_active, u.email_verified_at, u.last_login_at,
              u.created_at, u.updated_at,
              COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name))
                FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
       LEFT JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
       WHERE u.tenant_id = $1 AND u.id = $2 GROUP BY u.id`,
      [context.tenantId, id],
    );
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return result.rows[0];
  });
}

export async function createUser(context: RequestContext, input: CreateUserInput): Promise<Record<string, unknown>> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return withTenantTransaction(context.tenantId, async client => {
    try {
      if (input.departmentId) {
        const department = await client.query(
          'SELECT 1 FROM departments WHERE tenant_id = $1 AND id = $2 AND is_active',
          [context.tenantId, input.departmentId],
        );
        if (!department.rowCount) throw new AppError(400, 'INVALID_DEPARTMENT', 'Department does not exist or is inactive');
      }
      if (input.roleIds.length && !context.permissions.includes('roles:manage') && !context.permissions.includes('*')) {
        throw new AppError(403, 'FORBIDDEN', 'Role assignment requires roles:manage permission');
      }
      await assertRolesBelongToTenant(client, context.tenantId, input.roleIds, false);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, title, phone, department_id)
         VALUES ($1, lower($2), $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          context.tenantId, input.email, passwordHash, input.firstName, input.lastName,
          input.title ?? null, input.phone ?? null, input.departmentId ?? null,
        ],
      );
      for (const roleId of input.roleIds) {
        await client.query(
          `INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
           VALUES ($1, $2, $3, $4)`,
          [context.tenantId, inserted.rows[0].id, roleId, context.userId],
        );
      }
      await audit(client, context, 'user.created', inserted.rows[0].id, { roleIds: input.roleIds });
      return getUserFromClient(client, context.tenantId, inserted.rows[0].id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'EMAIL_EXISTS', 'A user with this email already exists in this organization');
      throw error;
    }
  });
}

export async function updateUser(context: RequestContext, id: string, input: UpdateUserInput): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    if (input.departmentId) {
      const department = await client.query('SELECT 1 FROM departments WHERE tenant_id = $1 AND id = $2', [context.tenantId, input.departmentId]);
      if (!department.rowCount) throw new AppError(400, 'INVALID_DEPARTMENT', 'Department does not exist in this organization');
    }
    const current = await client.query<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE tenant_id = $1 AND id = $2 FOR UPDATE',
      [context.tenantId, id],
    );
    if (!current.rowCount) throw new AppError(404, 'NOT_FOUND', 'User not found');
    if (id === context.userId && input.isActive === false) {
      throw new AppError(409, 'CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account');
    }
    if (input.isActive === false && current.rows[0].is_active) {
      const admins = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM users u
         WHERE u.tenant_id = $1 AND u.is_active
           AND EXISTS (
             SELECT 1 FROM user_roles ur JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
             WHERE ur.tenant_id = u.tenant_id AND ur.user_id = u.id
               AND r.is_system AND r.name = 'organization_admin'
           )`,
        [context.tenantId],
      );
      const isAdmin = await client.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
         WHERE ur.tenant_id = $1 AND ur.user_id = $2 AND r.is_system AND r.name = 'organization_admin'`,
        [context.tenantId, id],
      );
      if (isAdmin.rowCount && Number(admins.rows[0].count) <= 1) {
        throw new AppError(409, 'LAST_ORGANIZATION_ADMIN', 'The last active organization administrator cannot be deactivated');
      }
    }
    const result = await client.query(
      `UPDATE users SET
         first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name),
         title = CASE WHEN $5::boolean THEN $6 ELSE title END,
         phone = CASE WHEN $7::boolean THEN $8 ELSE phone END,
         department_id = CASE WHEN $9::boolean THEN $10::uuid ELSE department_id END,
         is_active = COALESCE($11, is_active), updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING id, email, first_name, last_name, title, phone, department_id, is_active, created_at, updated_at`,
      [
        context.tenantId, id, input.firstName ?? null, input.lastName ?? null,
        Object.prototype.hasOwnProperty.call(input, 'title'), input.title ?? null,
        Object.prototype.hasOwnProperty.call(input, 'phone'), input.phone ?? null,
        Object.prototype.hasOwnProperty.call(input, 'departmentId'), input.departmentId ?? null,
        input.isActive ?? null,
      ],
    );
    await audit(client, context, input.isActive === false ? 'user.deactivated' : input.isActive === true ? 'user.activated' : 'user.updated', id, { fields: Object.keys(input) });
    return result.rows[0];
  });
}

export async function assignUserRoles(context: RequestContext, id: string, roleIds: string[]): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const user = await client.query('SELECT 1 FROM users WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [context.tenantId, id]);
    if (!user.rowCount) throw new AppError(404, 'NOT_FOUND', 'User not found');
    await assertRolesBelongToTenant(client, context.tenantId, roleIds, false);
    await client.query(
      `DELETE FROM user_roles ur USING roles r
       WHERE ur.tenant_id = $1 AND ur.user_id = $2
         AND r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_system = false`,
      [context.tenantId, id],
    );
    for (const roleId of roleIds) {
      await client.query(
        'INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by) VALUES ($1, $2, $3, $4)',
        [context.tenantId, id, roleId, context.userId],
      );
    }
    await audit(client, context, 'user.roles_changed', id, { roleIds });
    return getUserFromClient(client, context.tenantId, id);
  });
}

export async function resetUserPassword(context: RequestContext, id: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);
  await withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `UPDATE users SET password_hash = $3, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND is_active`,
      [context.tenantId, id, passwordHash],
    );
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND_OR_INACTIVE', 'Active user not found');
    await audit(client, context, 'user.password_reset', id, {});
  });
}

async function assertRolesBelongToTenant(client: import('pg').PoolClient, tenantId: string, roleIds: string[], allowSystem: boolean): Promise<void> {
  if (roleIds.length !== new Set(roleIds).size) throw new AppError(400, 'DUPLICATE_ROLE', 'Role IDs must be unique');
  if (!roleIds.length) return;
  const roles = await client.query<{ id: string; is_system: boolean }>(
    'SELECT id, is_system FROM roles WHERE tenant_id = $1 AND id = ANY($2::uuid[])',
    [tenantId, roleIds],
  );
  if (roles.rowCount !== roleIds.length || (!allowSystem && roles.rows.some(role => role.is_system))) {
    throw new AppError(400, 'INVALID_ROLE', 'One or more roles are unavailable for assignment');
  }
}

async function getUserFromClient(client: import('pg').PoolClient, tenantId: string, id: string): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.title, u.phone, u.department_id,
            u.is_active, u.created_at, u.updated_at,
            COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name))
              FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
     LEFT JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
     WHERE u.tenant_id = $1 AND u.id = $2 GROUP BY u.id`,
    [tenantId, id],
  );
  return result.rows[0];
}

async function audit(client: import('pg').PoolClient, context: RequestContext, action: string, id: string, metadata: Record<string, unknown>): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'user', $4, $5::jsonb)`,
    [context.tenantId, context.userId, action, id, JSON.stringify(metadata)],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
