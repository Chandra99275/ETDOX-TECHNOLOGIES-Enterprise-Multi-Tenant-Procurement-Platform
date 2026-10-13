import { PoolClient } from 'pg';
import { withTenantTransaction } from '../../database/db';
import { AppError } from '../../utils/errors';
import { CreateInvoiceInput } from './invoices.schema';
import { v4 as uuid } from 'uuid';

interface Context { tenantId: string; userId: string }

async function audit(client: PoolClient, context: Context, action: string, invoiceId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'invoice', $4, $5::jsonb)`,
    [context.tenantId, context.userId, action, invoiceId, JSON.stringify(metadata)],
  );
}

async function readInvoice(client: PoolClient, tenantId: string, id: string): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT i.*,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id', ii.id, 'lineNumber', ii.line_number, 'purchaseOrderItemId', ii.purchase_order_item_id,
         'description', ii.description, 'quantity', ii.quantity, 'unitPrice', ii.unit_price,
         'taxAmount', ii.tax_amount, 'lineTotal', ii.line_total
       ) ORDER BY ii.line_number) FILTER (WHERE ii.id IS NOT NULL), '[]'::jsonb) AS items
     FROM invoices i
     LEFT JOIN invoice_items ii ON ii.tenant_id = i.tenant_id AND ii.invoice_id = i.id
     WHERE i.tenant_id = $1 AND i.id = $2
     GROUP BY i.id`,
    [tenantId, id],
  );
  if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
  return result.rows[0];
}

export async function createInvoice(context: Context, input: CreateInvoiceInput): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const supplier = await client.query<{ id: string }>(
      `SELECT id FROM suppliers WHERE tenant_id = $1 AND id = $2 AND status = 'ACTIVE'`,
      [context.tenantId, input.supplierId],
    );
    if (!supplier.rowCount) throw new AppError(400, 'INVALID_SUPPLIER', 'An active supplier in this organization is required');

    if (input.purchaseOrderId) {
      const order = await client.query<{ supplier_id: string; currency: string; status: string }>(
        `SELECT supplier_id, currency, status FROM purchase_orders
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, input.purchaseOrderId],
      );
      if (!order.rowCount) throw new AppError(400, 'INVALID_PURCHASE_ORDER', 'Purchase order does not exist in this organization');
      if (order.rows[0].supplier_id !== input.supplierId || order.rows[0].currency.trim() !== input.currency.toUpperCase()) {
        throw new AppError(400, 'PURCHASE_ORDER_MISMATCH', 'Invoice supplier and currency must match the purchase order');
      }
      if (!['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED'].includes(order.rows[0].status)) {
        throw new AppError(409, 'INVALID_PURCHASE_ORDER_STATE', 'The purchase order is not eligible for invoicing');
      }
      const selectedItems = input.items.filter(item => item.purchaseOrderItemId);
      if (selectedItems.length) {
        const itemIds = selectedItems.map(item => item.purchaseOrderItemId);
        const lines = await client.query(
          `SELECT id FROM purchase_order_items
           WHERE tenant_id = $1 AND purchase_order_id = $2 AND id = ANY($3::uuid[])`,
          [context.tenantId, input.purchaseOrderId, itemIds],
        );
        if (lines.rowCount !== itemIds.length) throw new AppError(400, 'INVALID_ORDER_LINE', 'Invoice lines must reference lines from its purchase order');
      }
    } else if (input.items.some(item => item.purchaseOrderItemId)) {
      throw new AppError(400, 'INVALID_ORDER_LINE', 'Purchase order line references require a purchase order');
    }

    const invoice = await client.query<{ id: string }>(
      `INSERT INTO invoices
         (tenant_id, supplier_id, purchase_order_id, invoice_number, issue_date, due_date, currency, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, upper($7), 0)
       RETURNING id`,
      [
        context.tenantId, input.supplierId, input.purchaseOrderId ?? null,
        input.invoiceNumber, input.issueDate ?? null, input.dueDate ?? null, input.currency,
      ],
    );
    const invoiceId = invoice.rows[0].id;
    for (const [index, item] of input.items.entries()) {
      await client.query(
        `INSERT INTO invoice_items
           (tenant_id, invoice_id, purchase_order_item_id, line_number, description,
            quantity, unit_price, tax_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 round($6::numeric * $7::numeric + $8::numeric, 4))`,
        [
          context.tenantId, invoiceId, item.purchaseOrderItemId ?? null,
          index + 1, item.description ?? null, item.quantity, item.unitPrice, item.taxAmount,
        ],
      );
    }
    await client.query(
      `UPDATE invoices i SET
         subtotal = totals.subtotal, tax_total = totals.tax_total,
         total_amount = totals.subtotal + totals.tax_total, updated_at = now()
       FROM (
         SELECT COALESCE(sum(quantity * unit_price), 0)::numeric(19,4) AS subtotal,
                COALESCE(sum(tax_amount), 0)::numeric(19,4) AS tax_total
         FROM invoice_items WHERE tenant_id = $1 AND invoice_id = $2
       ) totals
       WHERE i.tenant_id = $1 AND i.id = $2`,
      [context.tenantId, invoiceId],
    );
    await audit(client, context, 'invoice.created', invoiceId, { supplierId: input.supplierId });
    return readInvoice(client, context.tenantId, invoiceId);
  }).catch(error => {
    if (isUniqueViolation(error)) throw new AppError(409, 'DUPLICATE_INVOICE', 'An invoice with this supplier and invoice number already exists');
    throw error;
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export async function listInvoices(context: Context, options: { status?: string; supplierId?: string; limit: number; offset: number }): Promise<{ data: Record<string, unknown>[]; pagination: { limit: number; offset: number; total: number } }> {
  return withTenantTransaction(context.tenantId, async client => {
    const params = [context.tenantId, options.status ?? null, options.supplierId ?? null];
    const result = await client.query(
      `SELECT id, supplier_id, purchase_order_id, invoice_number, issue_date, due_date,
              currency, total_amount, status, created_at
       FROM invoices WHERE tenant_id = $1
         AND ($2::text IS NULL OR status = $2) AND ($3::uuid IS NULL OR supplier_id = $3)
       ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`,
      [...params, options.limit, options.offset],
    );
    const count = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM invoices WHERE tenant_id = $1
       AND ($2::text IS NULL OR status = $2) AND ($3::uuid IS NULL OR supplier_id = $3)`,
      params,
    );
    return {
      data: result.rows,
      pagination: { limit: options.limit, offset: options.offset, total: Number(count.rows[0].total) },
    };
  });
}

export async function getInvoice(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, client => readInvoice(client, context.tenantId, id));
}

export async function validateInvoice(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const invoice = await client.query<{ status: string; purchase_order_id: string | null; supplier_id: string; currency: string }>(
      `SELECT status, purchase_order_id, supplier_id, currency
       FROM invoices WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [context.tenantId, id],
    );
    if (!invoice.rowCount) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
    if (!['DRAFT', 'EXCEPTION'].includes(invoice.rows[0].status)) {
      throw new AppError(409, 'INVALID_STATE', 'Only draft or exception invoices can be validated');
    }

    const outcome: { matched: boolean; reason?: string }[] = [];
    if (invoice.rows[0].purchase_order_id) {
      const items = await client.query<{
        invoice_item_id: string; purchase_order_item_id: string | null; quantity: string;
        unit_price: string; line_total: string; ordered: string | null;
        received: string | null; invoiced: string | null; po_price: string | null;
      }>(
        `SELECT ii.id AS invoice_item_id, ii.purchase_order_item_id, ii.quantity, ii.unit_price, ii.line_total,
                poi.quantity AS ordered, poi.quantity_received AS received,
                poi.quantity_invoiced AS invoiced, poi.unit_price AS po_price
         FROM invoice_items ii
         LEFT JOIN purchase_order_items poi
           ON poi.tenant_id = ii.tenant_id AND poi.id = ii.purchase_order_item_id
          AND poi.purchase_order_id = $3
         WHERE ii.tenant_id = $1 AND ii.invoice_id = $2
         ORDER BY ii.line_number`,
        [context.tenantId, id, invoice.rows[0].purchase_order_id],
      );
      for (const item of items.rows) {
        let matched = false;
        let reason = 'Invoice line is not linked to a valid purchase order line';
        if (item.purchase_order_item_id && item.ordered !== null) {
          const check = await client.query<{ quantity_ok: boolean; price_ok: boolean; receipt_ok: boolean }>(
            `SELECT ($1::numeric + $2::numeric <= $3::numeric) AS quantity_ok,
                    ($4::numeric = $5::numeric) AS price_ok,
                    ($2::numeric <= $6::numeric) AS receipt_ok`,
            [item.invoiced, item.quantity, item.ordered, item.unit_price, item.po_price, item.received],
          );
          const row = check.rows[0];
          matched = row.quantity_ok && row.price_ok && row.receipt_ok;
          reason = matched ? 'Matched to purchase order and receipt' :
            !row.quantity_ok ? 'Invoiced quantity exceeds remaining ordered quantity' :
            !row.price_ok ? 'Invoice unit price differs from purchase order' :
            'Invoiced quantity exceeds posted receipts';
        }
        outcome.push({ matched, ...(matched ? {} : { reason }) });
        await client.query(
          `INSERT INTO invoice_match_results
             (tenant_id, invoice_id, invoice_item_id, purchase_order_item_id,
              match_type, outcome, actual_amount, details)
           VALUES ($1, $2, $3, $4, 'THREE_WAY', $5, $6, $7::jsonb)`,
          [
            context.tenantId, id, item.invoice_item_id, item.purchase_order_item_id,
            matched ? 'MATCHED' : 'EXCEPTION', item.line_total,
            JSON.stringify({ reason }),
          ],
        );
      }
    }

    const matched = outcome.every(item => item.matched);
    const nextStatus = matched ? 'PENDING_APPROVAL' : 'EXCEPTION';
    await client.query(
      `UPDATE invoices SET status = $3, matching_outcome = $4::jsonb, updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id, nextStatus, JSON.stringify({ matched, lines: outcome })],
    );
    await audit(client, context, 'invoice.validated', id, { status: nextStatus, matched });
    return readInvoice(client, context.tenantId, id);
  });
}

export async function approveInvoice(context: Context, id: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const invoice = await client.query<{ status: string; purchase_order_id: string | null }>(
      `SELECT status, purchase_order_id FROM invoices WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [context.tenantId, id],
    );
    if (!invoice.rowCount || invoice.rows[0].status !== 'PENDING_APPROVAL') {
      throw new AppError(409, 'INVALID_STATE', 'Only validated invoices pending approval can be approved');
    }
    if (invoice.rows[0].purchase_order_id) {
      const items = await client.query<{ purchase_order_item_id: string; quantity: string }>(
        `SELECT purchase_order_item_id, quantity FROM invoice_items
         WHERE tenant_id = $1 AND invoice_id = $2 ORDER BY line_number`,
        [context.tenantId, id],
      );
      for (const item of items.rows) {
        if (!item.purchase_order_item_id) throw new AppError(409, 'INVALID_MATCH', 'Every purchase-order invoice line must be matched before approval');
        const result = await client.query(
          `UPDATE purchase_order_items
           SET quantity_invoiced = quantity_invoiced + $4::numeric, updated_at = now()
           WHERE tenant_id = $1 AND id = $2 AND purchase_order_id = $3
             AND quantity_invoiced + $4::numeric <= quantity
             AND quantity_received >= quantity_invoiced + $4::numeric
           RETURNING id`,
          [context.tenantId, item.purchase_order_item_id, invoice.rows[0].purchase_order_id, item.quantity],
        );
        if (!result.rowCount) throw new AppError(409, 'INVOICE_QUANTITY_EXCEEDED', 'Invoice quantity is no longer available against the order receipts');
      }
    }
    await client.query(
      `UPDATE invoices SET status = 'APPROVED', updated_at = now() WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id],
    );
    await audit(client, context, 'invoice.approved', id);
    return readInvoice(client, context.tenantId, id);
  });
}

export async function transitionInvoice(context: Context, id: string, from: string, to: string, action: string): Promise<Record<string, unknown>> {
  return withTenantTransaction(context.tenantId, async client => {
    const result = await client.query(
      `UPDATE invoices SET status = $4, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = $3 RETURNING id`,
      [context.tenantId, id, from, to],
    );
    if (!result.rowCount) throw new AppError(409, 'INVALID_STATE', `Invoice must be ${from} before it can transition to ${to}`);
    await audit(client, context, action, id);
    return readInvoice(client, context.tenantId, id);
  });
}

export function newInvoiceNumber(): string {
  return `INV-${uuid().slice(0, 8).toUpperCase()}`;
}
