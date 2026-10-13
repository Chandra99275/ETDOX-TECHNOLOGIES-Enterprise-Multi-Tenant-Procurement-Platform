import { withTenantTransaction, withTransaction } from '../../database/db';
import { RegisterInput } from './auth.schema';
import { v4 as uuid } from 'uuid';

export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
}

const adminPermissions = [
  'organization:read', 'organization:manage',
  'users:read', 'users:manage', 'roles:manage',
  'suppliers:read', 'suppliers:manage',
  'purchase_requests:read', 'purchase_requests:create', 'purchase_requests:manage', 'purchase_requests:submit',
  'approvals:read', 'approvals:act', 'workflows:manage',
  'purchase_orders:read', 'purchase_orders:manage', 'purchase_orders:issue',
  'purchase_orders:approve', 'purchase_orders:acknowledge',
  'receipts:read', 'receipts:manage',
  'invoices:read', 'invoices:manage', 'invoices:approve',
  'budgets:read', 'budgets:manage',
  'contracts:read', 'contracts:manage',
  'billing:read', 'billing:manage',
  'analytics:read', 'audit:read',
  'webhooks:manage', 'notifications:read', 'notifications:manage',
  'attachments:read', 'attachments:manage',
];

export async function createTenantAdmin(input: RegisterInput, passwordHash: string): Promise<{ id: string; tenantId: string; email: string }> {
  return withTransaction(async client => {
    const slugBase = input.organizationName.toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'organization';
    const slug = `${slugBase}-${uuid().slice(0, 8)}`;
    const tenantId = uuid();
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const tenant = await client.query<{ id: string }>(
      'INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) RETURNING id',
      [tenantId, input.organizationName, slug],
    );
    const role = await client.query<{ id: string }>(
      `INSERT INTO roles (tenant_id, name, permissions, is_system)
       VALUES ($1, 'organization_admin', $2, true)
       RETURNING id`,
      [tenantId, adminPermissions],
    );
    const user = await client.query<{ id: string; email: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email`,
      [tenantId, input.email.toLowerCase(), passwordHash, input.firstName, input.lastName],
    );
    await client.query(
      'INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3)',
      [tenantId, user.rows[0].id, role.rows[0].id],
    );
    return { id: user.rows[0].id, tenantId, email: user.rows[0].email };
  });
}

export async function findUserForLogin(tenantId: string, email: string): Promise<AuthUser | undefined> {
  return withTenantTransaction(tenantId, async client => {
    const result = await client.query<AuthUser>(
      `SELECT id, tenant_id, email, password_hash, first_name, last_name, is_active
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id AND t.status = 'ACTIVE'
       WHERE u.tenant_id = $1 AND lower(u.email) = lower($2)
       LIMIT 1`,
      [tenantId, email],
    );
    return result.rows[0];
  });
}

export async function recordLogin(tenantId: string, userId: string): Promise<void> {
  await withTenantTransaction(tenantId, async client => {
    await client.query('UPDATE users SET last_login_at = now() WHERE tenant_id = $1 AND id = $2', [tenantId, userId]);
    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'USER', $2, 'auth.login', 'user', $2, '{}'::jsonb)`,
      [tenantId, userId],
    );
  });
}
