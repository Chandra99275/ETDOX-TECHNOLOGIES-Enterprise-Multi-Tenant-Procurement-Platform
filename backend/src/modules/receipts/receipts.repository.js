import { v4 as uuid } from 'uuid';
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

async function readReceipt(client, tenantId, orderId, receiptId) {
  const result = await client.query(
    `SELECT gr.*,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id', gri.id, 'purchaseOrderItemId', gri.purchase_order_item_id,
         'quantityReceived', gri.quantity_received, 'condition', gri.condition, 'notes', gri.notes
       ) ORDER BY gri.id) FILTER (WHERE gri.id IS NOT NULL), '[]'::jsonb) AS items
     FROM goods_receipts gr
     LEFT JOIN goods_receipt_items gri ON gri.tenant_id = gr.tenant_id AND gri.goods_receipt_id = gr.id
     WHERE gr.tenant_id = $1 AND gr.purchase_order_id = $2 AND gr.id = $3
     GROUP BY gr.id`,
    [tenantId, orderId, receiptId]
  );

  if (!result.rowCount) {
    throw new AppError(404, 'NOT_FOUND', 'Goods receipt not found');
  }

  return result.rows[0];
}

export async function createReceipt(context, orderId, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const order = await client.query(
      `SELECT status FROM purchase_orders
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, orderId]
    );

    if (!order.rowCount) {
      throw new AppError(
        404,
        'PURCHASE_ORDER_NOT_FOUND',
        'Purchase order not found'
      );
    }

    if (
      !['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(
        order.rows[0].status
      )
    ) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'Receipts may only be recorded against an issued purchase order'
      );
    }

    const ids = input.items.map((item) => item.purchaseOrderItemId);

    const lines = await client.query(
      `SELECT id FROM purchase_order_items
       WHERE tenant_id = $1
         AND purchase_order_id = $2
         AND id = ANY($3::uuid[])`,
      [context.tenantId, orderId, ids]
    );

    if (lines.rowCount !== ids.length) {
      throw new AppError(
        400,
        'INVALID_ORDER_LINE',
        'Every receipt line must belong to the specified purchase order'
      );
    }

    const receiptNumber =
      input.receiptNumber ??
      `GR-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')}-${uuid().slice(0, 8).toUpperCase()}`;

    const receipt = await client.query(
      `INSERT INTO goods_receipts
         (tenant_id, receipt_number, purchase_order_id, delivery_note_reference, received_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        context.tenantId,
        receiptNumber,
        orderId,
        input.deliveryNoteReference ?? null,
        context.userId,
      ]
    );

    for (const item of input.items) {
      await client.query(
        `INSERT INTO goods_receipt_items
           (tenant_id, goods_receipt_id, purchase_order_item_id, quantity_received, condition, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          context.tenantId,
          receipt.rows[0].id,
          item.purchaseOrderItemId,
          item.quantityReceived,
          item.condition ?? null,
          item.notes ?? null,
        ]
      );
    }

    await client.query(
      `INSERT INTO audit_events
         (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'USER', $2, 'goods_receipt.created', 'goods_receipt', $3, $4::jsonb)`,
      [
        context.tenantId,
        context.userId,
        receipt.rows[0].id,
        JSON.stringify({
          purchaseOrderId: orderId,
          status: 'DRAFT',
        }),
      ]
    );

    return readReceipt(
      client,
      context.tenantId,
      orderId,
      receipt.rows[0].id
    );
  });
}

export async function listReceipts(context, orderId) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const order = await client.query(
      `SELECT 1 FROM purchase_orders
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, orderId]
    );

    if (!order.rowCount) {
      throw new AppError(
        404,
        'PURCHASE_ORDER_NOT_FOUND',
        'Purchase order not found'
      );
    }

    const receipts = await client.query(
      `SELECT id FROM goods_receipts
       WHERE tenant_id = $1 AND purchase_order_id = $2
       ORDER BY created_at DESC, id DESC`,
      [context.tenantId, orderId]
    );

    const data = [];

    for (const receipt of receipts.rows) {
      data.push(
        await readReceipt(
          client,
          context.tenantId,
          orderId,
          receipt.id
        )
      );
    }

    return data;
  });
}

export async function postReceipt(context, orderId, receiptId) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const receipt = await client.query(
      `SELECT status FROM goods_receipts
       WHERE tenant_id = $1
         AND purchase_order_id = $2
         AND id = $3
       FOR UPDATE`,
      [context.tenantId, orderId, receiptId]
    );

    if (!receipt.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Goods receipt not found');
    }

    if (receipt.rows[0].status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_STATE',
        'Only draft receipts can be posted'
      );
    }

    const order = await client.query(
      `SELECT status FROM purchase_orders
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, orderId]
    );

    if (
      !order.rowCount ||
      !['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(
        order.rows[0].status
      )
    ) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'The purchase order is not eligible for receipt posting'
      );
    }

    const items = await client.query(
      `SELECT
         gri.purchase_order_item_id,
         gri.quantity_received,
         poi.quantity AS ordered,
         poi.quantity_received AS already_received
       FROM goods_receipt_items gri
       JOIN purchase_order_items poi
         ON poi.tenant_id = gri.tenant_id
        AND poi.id = gri.purchase_order_item_id
       WHERE gri.tenant_id = $1
         AND gri.goods_receipt_id = $2
       FOR UPDATE OF poi`,
      [context.tenantId, receiptId]
    );

    for (const item of items.rows) {
      const sum = await client.query(
        'SELECT ($1::numeric + $2::numeric > $3::numeric) AS exceeded',
        [
          item.already_received,
          item.quantity_received,
          item.ordered,
        ]
      );

      if (sum.rows[0].exceeded) {
        throw new AppError(
          409,
          'RECEIPT_EXCEEDS_ORDER',
          'A receipt quantity exceeds the unreceived quantity on its purchase order line'
        );
      }

      await client.query(
        `UPDATE purchase_order_items
         SET quantity_received = quantity_received + $3::numeric,
             updated_at = now()
         WHERE tenant_id = $1 AND id = $2`,
        [
          context.tenantId,
          item.purchase_order_item_id,
          item.quantity_received,
        ]
      );
    }

    await client.query(
      `UPDATE goods_receipts
       SET status = 'POSTED',
           received_at = now(),
           received_by = $4
       WHERE tenant_id = $1
         AND purchase_order_id = $2
         AND id = $3`,
      [context.tenantId, orderId, receiptId, context.userId]
    );

    const totals = await client.query(
      `SELECT
         count(*)::text AS line_count,
         count(*) FILTER (WHERE quantity_received >= quantity)::text AS complete_count,
         count(*) FILTER (WHERE quantity_received > 0)::text AS received_count
       FROM purchase_order_items
       WHERE tenant_id = $1 AND purchase_order_id = $2`,
      [context.tenantId, orderId]
    );

    const { line_count, complete_count, received_count } = totals.rows[0];

    const nextStatus =
      received_count === '0'
        ? 'ACKNOWLEDGED'
        : complete_count === line_count
          ? 'RECEIVED'
          : 'PARTIALLY_RECEIVED';

    await client.query(
      `UPDATE purchase_orders
       SET status = $3, updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, orderId, nextStatus]
    );

    await client.query(
      `INSERT INTO audit_events
         (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'USER', $2, 'goods_receipt.posted', 'goods_receipt', $3, $4::jsonb)`,
      [
        context.tenantId,
        context.userId,
        receiptId,
        JSON.stringify({
          purchaseOrderId: orderId,
          purchaseOrderStatus: nextStatus,
        }),
      ]
    );

    return readReceipt(
      client,
      context.tenantId,
      orderId,
      receiptId
    );
  });
}