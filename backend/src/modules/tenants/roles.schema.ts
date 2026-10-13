import { z } from 'zod';

const permissionValues = [
  'organization:read', 'organization:manage',
  'users:read', 'users:manage',
  'suppliers:read', 'suppliers:manage',
  'purchase_requests:read', 'purchase_requests:create', 'purchase_requests:manage', 'purchase_requests:submit',
  'approvals:read', 'approvals:act', 'workflows:manage',
  'purchase_orders:read', 'purchase_orders:manage', 'purchase_orders:issue', 'purchase_orders:approve', 'purchase_orders:acknowledge',
  'receipts:read', 'receipts:manage',
  'invoices:read', 'invoices:manage', 'invoices:approve',
  'budgets:read', 'budgets:manage',
  'contracts:read', 'contracts:manage',
  'billing:read', 'billing:manage',
  'analytics:read', 'audit:read', 'webhooks:manage',
  'notifications:read', 'notifications:manage', 'attachments:read', 'attachments:manage',
] as const;

const permissions = z.array(z.enum(permissionValues)).max(permissionValues.length)
  .refine(values => new Set(values).size === values.length, 'Permissions must be unique');

export const roleIdSchema = z.object({ id: z.string().uuid() }).strict();
export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9 _-]+$/),
  description: z.string().trim().max(500).optional(),
  permissions,
}).strict().refine(value => value.name.toLowerCase() !== 'organization_admin', {
  path: ['name'], message: 'This role name is reserved',
});
export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9 _-]+$/).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: permissions.optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field must be provided')
  .refine(value => value.name?.toLowerCase() !== 'organization_admin', {
    path: ['name'], message: 'This role name is reserved',
  });
