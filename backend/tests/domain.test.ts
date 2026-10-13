import { describe, expect, it } from 'vitest';
import { workflowGraphSchema } from '../src/modules/workflows/workflows.schema';
import { createPurchaseRequestSchema } from '../src/modules/purchase-requests/purchase-requests.schema';
import { createRoleSchema } from '../src/modules/tenants/roles.schema';
import { createRequestAttachmentSchema } from '../src/modules/attachments/attachments.schema';

describe('procurement domain validation', () => {
  it('accepts a valid approval workflow graph', () => {
    const result = workflowGraphSchema.safeParse({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'manager', type: 'approval' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { from: 'start', to: 'manager' },
        { from: 'manager', to: 'end' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects cyclic workflow graphs', () => {
    const result = workflowGraphSchema.safeParse({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'approver', type: 'approval' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { from: 'start', to: 'approver' },
        { from: 'approver', to: 'start' },
        { from: 'approver', to: 'end' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects purchase-request line tax above 100 percent', () => {
    const result = createPurchaseRequestSchema.safeParse({
      currency: 'USD',
      items: [{ description: 'Equipment', quantity: '1', unitPrice: '100', taxRate: '101' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects wildcard and reserved role permissions', () => {
    const result = createRoleSchema.safeParse({
      name: 'custom_admin',
      permissions: ['*', 'roles:manage'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects attachment storage keys that escape the tenant prefix', () => {
    const result = createRequestAttachmentSchema.safeParse({
      fileName: 'invoice.pdf',
      storageKey: 'tenants/other-tenant/../../public/invoice.pdf',
    });
    expect(result.success).toBe(false);
  });
});
