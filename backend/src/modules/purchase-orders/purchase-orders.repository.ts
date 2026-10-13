import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { withTenantTransaction } from '../../database/db';
import { AppError } from '../../utils/errors';

interface Context { tenantId: string; userId: string }
interface CreateInput {
  purchaseRequestId: string;
  supplierId: string;
  paymentTerms?: string;
  shippingAddress?: Record<string, unknown>;
}

async function audit(client: import('pg').PoolClient, context: Context, action: string, poId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'purchase_order', $4, $5::jsonb)`,
    [context.tenantId, context.userId, action, poId, JSON.stringify(metadata)],
  );
}

async function readOrder(client: import('pg').PoolClient, tenantId: string, id: string): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT po.*,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id', poi.id, 'lineNumber', poi.line_number, 'description', poi.description,
         'quantity', poi.quantity, 'unitOfMeasure', poi.unit_of_measure,
         'unitPrice', poi.unit_price, 'taxRate', poi.tax_rate, 'lineTotal', poi.line_total,
         'quantityReceived', poi.quantity_received, 'quantityInvoiced', poi.quantity_invoiced
       ) ORDER BY poi.line_number) FILTER (WHERE poi.id IS NOT NULL), '[]'::jsonb) AS items
     FROM purchase_orders po
     LEFT JOIN purchase_order_items poi ON poi.tenant_id = po.tenant_id AND poi.purchase_order_id = po.id
     WHERE po.tenant_id = $1 AND po.id = $2
     GROUP BY po.id`,
    [tenantId, id],
  );
  if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Purchase order not found');
  return result.rows[0];
}

export async function createPurchaseOrder(context: Context, input: CreateInput, poNumber: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const request = await client.query<{
      status: string; currency: string; subtotal: string; tax_total: string; total_amount: string;
    }>(
      `SELECT status, currency, subtotal, tax_total, total_amount
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [context.tenantId, input.purchaseRequestId],
    );
    if (!request.rowCount) throw new AppError(404, 'PURCHASE_REQUEST_NOT_FOUND', 'Purchase request not found');
    if (request.rows[0].status !== 'APPROVED') {
      throw new AppError(409, 'INVALID_STATE', 'Only approved purchase requests can be converted to an order');
    }
    const supplier = await client.query<{ payment_terms: string | null }>(
      `SELECT payment_terms FROM suppliers
       WHERE tenant_id = $1 AND id = $2 AND status = 'ACTIVE'`,
      [context.tenantId, input.supplierId],
    );
    if (!supplier.rowCount) throw new AppError(400, 'INVALID_SUPPLIER', 'An active supplier in this organization is required');

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO purchase_orders
         (tenant_id, po_number, purchase_request_id, supplier_id, payment_terms, shipping_address,
          currency, subtotal, tax_total, total_amount, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, $6), $7::jsonb, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        context.tenantId, poNumber, input.purchaseRequestId, input.supplierId,
        input.paymentTerms ?? null, supplier.rows[0].payment_terms,
        JSON.stringify(input.shippingAddress ?? {}),
        request.rows[0].currency, request.rows[0].subtotal, request.rows[0].tax_total,
        request.rows[0].total_amount, context.userId,
      ],
    );
    const poId = inserted.rows[0].id;
    const orderLines = await client.query<{ line_count: string }>(
      `SELECT count(*)::text AS line_count FROM purchase_request_items
       WHERE tenant_id = $1 AND purchase_request_id = $2`,
      [context.tenantId, input.purchaseRequestId],
    );
    if (Number(orderLines.rows[0].line_count) === 0) {
      throw new AppError(422, 'EMPTY_PURCHASE_REQUEST', 'An approved purchase request must contain at least one line item');
    }
    await client.query(
      `INSERT INTO purchase_order_items
         (tenant_id, purchase_order_id, source_request_item_id, line_number, description,
          quantity, unit_price, tax_rate, line_total)
       SELECT tenant_id, $3, id, line_number, description, quantity, unit_price, tax_rate, line_total
       FROM purchase_request_items
       WHERE tenant_id = $1 AND purchase_request_id = $2
       ORDER BY line_number`,
      [context.tenantId, input.purchaseRequestId, poId],
    );
    await client.query(
      `UPDATE purchase_requests SET status = 'CONVERTED_TO_PO', updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, input.purchaseRequestId],
    );
    await audit(client, context, 'purchase_order.created', poId, { purchaseRequestId: input.purchaseRequestId });
    return readOrder(client, context.tenantId, poId);
  });
}

export async function listPurchaseOrders(context: Context, options: { status?: string; limit: number; offset: number }): Promise<{ data: Record<string, unknown>[]; pagination: { limit: number; offset: number; total: number } }> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `SELECT id, po_number, purchase_request_id, supplier_id, currency, total_amount, status, issued_at, created_at
       FROM purchase_orders WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
      [context.tenantId, options.status ?? null, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM purchase_orders WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2)',
      [context.tenantId, options.status ?? null],
    );
    return {
      data: result.rows,
      pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) },
    };
  });
}

export async function getPurchaseOrder(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, client => readOrder(client, context.tenantId, id));
}

export async function approvePurchaseOrder(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `UPDATE purchase_orders SET status = 'APPROVED', updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status IN ('DRAFT', 'PENDING_APPROVAL')
       RETURNING id`,
      [context.tenantId, id],
    );
    if (!result.rowCount) throw new AppError(409, 'INVALID_STATE', 'Purchase order cannot be approved or was not found');
    await audit(client, context, 'purchase_order.approved', id);
    return readOrder(client, context.tenantId, id);
  });
}

export async function issuePurchaseOrder(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const order = await client.query<{
      po_number: string; supplier_id: string; purchase_request_id: string | null;
      payment_terms: string | null; shipping_address: Record<string, unknown>;
      currency: string; status: string; issued_version: number | null;
      legal_name: string; tax_identifier: string | null; supplier_address: Record<string, unknown>;
    }>(
      `SELECT po.po_number, po.supplier_id, po.purchase_request_id, po.payment_terms,
              po.shipping_address, po.currency, po.status, po.issued_version,
              s.legal_name, s.tax_identifier, s.address AS supplier_address
       FROM purchase_orders po
       JOIN suppliers s ON s.tenant_id = po.tenant_id AND s.id = po.supplier_id
       WHERE po.tenant_id = $1 AND po.id = $2 FOR UPDATE OF po`,
      [context.tenantId, id],
    );
    if (!order.rowCount) throw new AppError(404, 'NOT_FOUND', 'Purchase order not found');
    if (order.rows[0].status !== 'APPROVED') {
      throw new AppError(409, 'INVALID_STATE', 'Only approved purchase orders can be issued');
    }
    const items = await client.query(
      `SELECT line_number, description, quantity, unit_of_measure, unit_price, tax_rate, line_total
       FROM purchase_order_items WHERE tenant_id = $1 AND purchase_order_id = $2 ORDER BY line_number`,
      [context.tenantId, id],
    );
    const version = (order.rows[0].issued_version ?? 0) + 1;
    const snapshot = {
      purchaseOrderId: id,
      poNumber: order.rows[0].po_number,
      purchaseRequestId: order.rows[0].purchase_request_id,
      supplier: {
        id: order.rows[0].supplier_id,
        legalName: order.rows[0].legal_name,
        taxIdentifier: order.rows[0].tax_identifier,
        address: order.rows[0].supplier_address,
      },
      paymentTerms: order.rows[0].payment_terms,
      shippingAddress: order.rows[0].shipping_address,
      currency: order.rows[0].currency,
      items: items.rows,
      issuedAt: new Date().toISOString(),
      version,
    };
    const serialized = JSON.stringify(snapshot);
    await client.query(
      `INSERT INTO purchase_order_issued_snapshots
         (tenant_id, purchase_order_id, version, snapshot, content_hash, issued_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [context.tenantId, id, version, serialized, createHash('sha256').update(serialized).digest('hex'), context.userId],
    );
    await client.query(
      `UPDATE purchase_orders SET status = 'ISSUED', issued_version = $3, issued_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id, version],
    );
    await audit(client, context, 'purchase_order.issued', id, { version });
    return readOrder(client, context.tenantId, id);
  });
}

export async function acknowledgePurchaseOrder(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `UPDATE purchase_orders SET status = 'ACKNOWLEDGED', updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = 'ISSUED' RETURNING id`,
      [context.tenantId, id],
    );
    if (!result.rowCount) throw new AppError(409, 'INVALID_STATE', 'Only issued purchase orders can be acknowledged');
    await audit(client, context, 'purchase_order.acknowledged', id);
    return readOrder(client, context.tenantId, id);
  });
}

export function newPurchaseOrderNumber(): string {
  return `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuid().slice(0, 8).toUpperCase()}`;
}
