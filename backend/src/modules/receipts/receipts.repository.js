
// backend/src/modules/receipts/receipts.repository.js

import { pool } from "../../config/database.js";

const ITEMS_TABLE = "goods_receipt_items";
const RECEIPTS_TABLE = "goods_receipts";

const ITEM_CANDIDATES = {
  id: ["id", "goods_receipt_item_id", "receipt_item_id"],
  tenantId: ["tenant_id"],
  goodsReceiptId: ["goods_receipt_id"],
  purchaseOrderItemId: ["purchase_order_item_id", "po_item_id"],
  receivedQuantity: ["quantity_received", "received_quantity", "quantity"],
  condition: ["condition"],
  notes: ["notes", "remarks"],
  createdAt: ["created_at", "created_on"],
};

const RECEIPT_CANDIDATES = {
  id: ["id", "goods_receipt_id"],
  tenantId: ["tenant_id"],
  receiptNumber: ["receipt_number"],
  purchaseOrderId: ["purchase_order_id", "po_id"],
  deliveryNoteReference: ["delivery_note_reference"],
  status: ["status", "receipt_status"],
  receivedAt: ["received_at", "received_date"],
  receivedBy: ["received_by", "received_by_user_id"],
  createdAt: ["created_at", "created_on"],
  updatedAt: ["updated_at", "updated_on"],
};

const quote = (name) =>
  `"${String(name).replaceAll('"', '""')}"`;

async function getTableColumns(client, tableName, candidates) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [tableName],
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Table "${tableName}" was not found in the current schema.`,
    );
  }

  const actual = new Set(
    result.rows.map((row) => row.column_name),
  );

  const mapped = {};

  for (const [field, names] of Object.entries(candidates)) {
    mapped[field] =
      names.find((name) => actual.has(name)) ?? null;
  }

  return mapped;
}

async function getColumns(client) {
  const [items, receipts] = await Promise.all([
    getTableColumns(client, ITEMS_TABLE, ITEM_CANDIDATES),
    getTableColumns(client, RECEIPTS_TABLE, RECEIPT_CANDIDATES),
  ]);

  if (!items.id || !items.tenantId || !items.goodsReceiptId) {
    throw new Error(
      `${ITEMS_TABLE} must contain id, tenant_id, and goods_receipt_id columns.`,
    );
  }

  if (!receipts.id || !receipts.tenantId || !receipts.purchaseOrderId) {
    throw new Error(
      `${RECEIPTS_TABLE} must contain id, tenant_id, and purchase_order_id columns.`,
    );
  }

  if (!items.purchaseOrderItemId || !items.receivedQuantity) {
    throw new Error(
      `${ITEMS_TABLE} must contain purchase_order_item_id and quantity_received columns.`,
    );
  }

  return { items, receipts };
}

async function withTenant(tenantId, callback) {
  if (!tenantId) {
    const error = new Error("Tenant ID is required.");
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [String(tenantId)],
    );

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function normalizeReceiptRow(row, items, receipts) {
  if (!row) return null;

  return {
    ...row,

    id: row.item_id,
    receiptId: row.receipt_id,
    goodsReceiptId: row.receipt_id,

    tenantId: row.tenant_id,
    purchaseOrderId: row.purchase_order_id,
    purchaseOrderItemId: row.purchase_order_item_id,

    receiptNumber: row.receipt_number,
    deliveryNoteReference: row.delivery_note_reference,

    receivedQuantity: row.quantity_received,
    quantityReceived: row.quantity_received,

    condition: row.condition,
    status: row.receipt_status,

    receivedAt: row.received_at,
    receivedBy: row.received_by,

    notes: row.item_notes,
    createdAt: row.item_created_at,
  };
}

function buildReceiptSelect(items, receipts) {
  return `
    SELECT
      gri.${quote(items.id)} AS item_id,
      gri.${quote(items.tenantId)} AS tenant_id,
      gri.${quote(items.goodsReceiptId)} AS receipt_id,
      gri.${quote(items.purchaseOrderItemId)} AS purchase_order_item_id,
      gri.${quote(items.receivedQuantity)} AS quantity_received,
      ${items.condition
        ? `gri.${quote(items.condition)}`
        : "NULL"} AS condition,
      ${items.notes
        ? `gri.${quote(items.notes)}`
        : "NULL"} AS item_notes,
      ${items.createdAt
        ? `gri.${quote(items.createdAt)}`
        : "NULL"} AS item_created_at,

      gr.${quote(receipts.purchaseOrderId)} AS purchase_order_id,
      ${receipts.receiptNumber
        ? `gr.${quote(receipts.receiptNumber)}`
        : "NULL"} AS receipt_number,
      ${receipts.deliveryNoteReference
        ? `gr.${quote(receipts.deliveryNoteReference)}`
        : "NULL"} AS delivery_note_reference,
      ${receipts.status
        ? `gr.${quote(receipts.status)}`
        : "NULL"} AS receipt_status,
      ${receipts.receivedAt
        ? `gr.${quote(receipts.receivedAt)}`
        : "NULL"} AS received_at,
      ${receipts.receivedBy
        ? `gr.${quote(receipts.receivedBy)}`
        : "NULL"} AS received_by

    FROM ${quote(ITEMS_TABLE)} gri

    INNER JOIN ${quote(RECEIPTS_TABLE)} gr
      ON gr.${quote(receipts.id)} =
         gri.${quote(items.goodsReceiptId)}
     AND gr.${quote(receipts.tenantId)} =
         gri.${quote(items.tenantId)}
  `;
}

function buildPagination(filters = {}) {
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(filters.limit, 10) || 20),
  );

  const requestedOffset = Number.parseInt(filters.offset, 10);

  const page = Math.max(
    1,
    Number.parseInt(filters.page, 10) || 1,
  );

  const offset =
    Number.isInteger(requestedOffset) && requestedOffset >= 0
      ? requestedOffset
      : (page - 1) * limit;

  return {
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
  };
}

function buildFilters(items, receipts, tenantId, filters = {}) {
  const values = [String(tenantId)];

  const conditions = [
    `gri.${quote(items.tenantId)} = $1`,
    `gr.${quote(receipts.tenantId)} = $1`,
  ];

  if (filters.purchaseOrderId) {
    values.push(filters.purchaseOrderId);

    conditions.push(
      `gr.${quote(receipts.purchaseOrderId)} = $${values.length}`,
    );
  }

  if (filters.status && receipts.status) {
    values.push(filters.status);

    conditions.push(
      `gr.${quote(receipts.status)} = $${values.length}`,
    );
  }

  return {
    values,
    where: `WHERE ${conditions.join(" AND ")}`,
  };
}

export async function listReceipts(tenantId, filters = {}) {
  return withTenant(tenantId, async (client) => {
    const { items, receipts } = await getColumns(client);

    const { limit, offset, page } = buildPagination(filters);

    const { values, where } = buildFilters(
      items,
      receipts,
      tenantId,
      filters,
    );

    const fromClause = `
      FROM ${quote(ITEMS_TABLE)} gri
      INNER JOIN ${quote(RECEIPTS_TABLE)} gr
        ON gr.${quote(receipts.id)} =
           gri.${quote(items.goodsReceiptId)}
       AND gr.${quote(receipts.tenantId)} =
           gri.${quote(items.tenantId)}
    `;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         ${fromClause}
         ${where}`,
      values,
    );

    const orderColumn = receipts.receivedAt
      ? `gr.${quote(receipts.receivedAt)}`
      : receipts.createdAt
        ? `gr.${quote(receipts.createdAt)}`
        : `gr.${quote(receipts.id)}`;

    const result = await client.query(
      `${buildReceiptSelect(items, receipts)}
       ${where}
       ORDER BY ${orderColumn} DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    const total = countResult.rows[0]?.total ?? 0;

    return {
      data: result.rows.map((row) =>
        normalizeReceiptRow(row, items, receipts),
      ),
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

export async function getReceiptById(tenantId, id) {
  return withTenant(tenantId, async (client) => {
    const { items, receipts } = await getColumns(client);

    const result = await client.query(
      `${buildReceiptSelect(items, receipts)}
       WHERE gri.${quote(items.id)} = $1
         AND gri.${quote(items.tenantId)} = $2
       LIMIT 1`,
      [id, String(tenantId)],
    );

    return normalizeReceiptRow(
      result.rows[0],
      items,
      receipts,
    );
  });
}

export async function createReceipt(tenantId, input, userId) {
  return withTenant(tenantId, async (client) => {
    const { items, receipts } = await getColumns(client);

    if (!input.purchaseOrderId) {
      const error = new Error("purchaseOrderId is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!input.purchaseOrderItemId) {
      const error = new Error("purchaseOrderItemId is required.");
      error.statusCode = 400;
      throw error;
    }

    const purchaseOrderResult = await client.query(
      `SELECT id
         FROM purchase_orders
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1`,
      [input.purchaseOrderId, String(tenantId)],
    );

    if (purchaseOrderResult.rowCount === 0) {
      const error = new Error(
        "The purchase order was not found for this tenant.",
      );
      error.statusCode = 404;
      throw error;
    }

    const headerNames = [
      quote(receipts.tenantId),
      quote(receipts.purchaseOrderId),
    ];

    const headerValues = [
      String(tenantId),
      input.purchaseOrderId,
    ];

    const headerPlaceholders = ["$1", "$2"];

    const headerMap = {
      receiptNumber: receipts.receiptNumber
        ? input.receiptNumber || `GR-${Date.now()}`
        : undefined,
      deliveryNoteReference: input.deliveryNoteReference,
      status: input.status || "pending",
      receivedAt: input.receivedAt || new Date().toISOString(),
      receivedBy: userId,
    };

    for (const [field, value] of Object.entries(headerMap)) {
      const column = receipts[field];

      if (!column || value === undefined) continue;

      headerNames.push(quote(column));
      headerValues.push(value);
      headerPlaceholders.push(`$${headerValues.length}`);
    }

    if (receipts.createdAt) {
      headerNames.push(quote(receipts.createdAt));
      headerPlaceholders.push("CURRENT_TIMESTAMP");
    }

    if (receipts.updatedAt) {
      headerNames.push(quote(receipts.updatedAt));
      headerPlaceholders.push("CURRENT_TIMESTAMP");
    }

    const headerResult = await client.query(
      `INSERT INTO ${quote(RECEIPTS_TABLE)}
         (${headerNames.join(", ")})
       VALUES (${headerPlaceholders.join(", ")})
       RETURNING ${quote(receipts.id)}`,
      headerValues,
    );

    const receiptId = headerResult.rows[0][receipts.id];

    const itemNames = [
      quote(items.tenantId),
      quote(items.goodsReceiptId),
      quote(items.purchaseOrderItemId),
      quote(items.receivedQuantity),
    ];

    const itemValues = [
      String(tenantId),
      receiptId,
      input.purchaseOrderItemId,
      input.receivedQuantity,
    ];

    const itemPlaceholders = itemValues.map(
      (_, index) => `$${index + 1}`,
    );

    if (items.condition && input.condition) {
      itemNames.push(quote(items.condition));
      itemValues.push(input.condition);
      itemPlaceholders.push(`$${itemValues.length}`);
    }

    if (items.notes && input.notes !== undefined) {
      itemNames.push(quote(items.notes));
      itemValues.push(input.notes);
      itemPlaceholders.push(`$${itemValues.length}`);
    }

    if (items.createdAt) {
      itemNames.push(quote(items.createdAt));
      itemPlaceholders.push("CURRENT_TIMESTAMP");
    }

    const itemResult = await client.query(
      `INSERT INTO ${quote(ITEMS_TABLE)}
         (${itemNames.join(", ")})
       VALUES (${itemPlaceholders.join(", ")})
       RETURNING ${quote(items.id)}`,
      itemValues,
    );

    const created = await client.query(
      `${buildReceiptSelect(items, receipts)}
       WHERE gri.${quote(items.id)} = $1
         AND gri.${quote(items.tenantId)} = $2
       LIMIT 1`,
      [itemResult.rows[0][items.id], String(tenantId)],
    );

    return normalizeReceiptRow(
      created.rows[0],
      items,
      receipts,
    );
  });
}

export async function updateReceipt(tenantId, id, input) {
  return withTenant(tenantId, async (client) => {
    const { items, receipts } = await getColumns(client);

    const itemMap = {
      purchaseOrderItemId: items.purchaseOrderItemId,
      receivedQuantity: items.receivedQuantity,
      condition: items.condition,
      notes: items.notes,
    };

    const headerMap = {
      purchaseOrderId: receipts.purchaseOrderId,
      receiptNumber: receipts.receiptNumber,
      deliveryNoteReference: receipts.deliveryNoteReference,
      status: receipts.status,
      receivedAt: receipts.receivedAt,
    };

    const itemSets = [];
    const itemValues = [];

    const headerSets = [];
    const headerValues = [];

    for (const [field, column] of Object.entries(itemMap)) {
      if (!column || input[field] === undefined) continue;

      itemValues.push(input[field]);
      itemSets.push(
        `${quote(column)} = $${itemValues.length}`,
      );
    }

    for (const [field, column] of Object.entries(headerMap)) {
      if (!column || input[field] === undefined) continue;

      headerValues.push(input[field]);
      headerSets.push(
        `${quote(column)} = $${headerValues.length}`,
      );
    }

    if (headerSets.length > 0 && receipts.updatedAt) {
      headerSets.push(
        `${quote(receipts.updatedAt)} = CURRENT_TIMESTAMP`,
      );
    }

    if (itemSets.length === 0 && headerSets.length === 0) {
      const error = new Error(
        "No valid receipt fields were provided for update.",
      );
      error.statusCode = 400;
      throw error;
    }

    const existing = await client.query(
      `SELECT
         gri.${quote(items.goodsReceiptId)} AS receipt_id
       FROM ${quote(ITEMS_TABLE)} gri
       WHERE gri.${quote(items.id)} = $1
         AND gri.${quote(items.tenantId)} = $2
       LIMIT 1`,
      [id, String(tenantId)],
    );

    if (existing.rowCount === 0) return null;

    const receiptId = existing.rows[0].receipt_id;

    if (itemSets.length > 0) {
      itemValues.push(id);
      itemValues.push(String(tenantId));

      await client.query(
        `UPDATE ${quote(ITEMS_TABLE)}
            SET ${itemSets.join(", ")}
          WHERE ${quote(items.id)} = $${itemValues.length - 1}
            AND ${quote(items.tenantId)} = $${itemValues.length}`,
        itemValues,
      );
    }

    if (headerSets.length > 0) {
      headerValues.push(receiptId);
      headerValues.push(String(tenantId));

      await client.query(
        `UPDATE ${quote(RECEIPTS_TABLE)}
            SET ${headerSets.join(", ")}
          WHERE ${quote(receipts.id)} = $${headerValues.length - 1}
            AND ${quote(receipts.tenantId)} = $${headerValues.length}`,
        headerValues,
      );
    }

    const result = await client.query(
      `${buildReceiptSelect(items, receipts)}
       WHERE gri.${quote(items.id)} = $1
         AND gri.${quote(items.tenantId)} = $2
       LIMIT 1`,
      [id, String(tenantId)],
    );

    return normalizeReceiptRow(
      result.rows[0],
      items,
      receipts,
    );
  });
}

export async function deleteReceipt(tenantId, id) {
  return withTenant(tenantId, async (client) => {
    const { items, receipts } = await getColumns(client);

    const result = await client.query(
      `DELETE FROM ${quote(ITEMS_TABLE)}
        WHERE ${quote(items.id)} = $1
          AND ${quote(items.tenantId)} = $2
       RETURNING ${quote(items.goodsReceiptId)}`,
      [id, String(tenantId)],
    );

    if (result.rowCount === 0) return false;

    const receiptId = result.rows[0][items.goodsReceiptId];

    // Preserve the receipt header and any remaining items.
    // Remove the header only when no detail rows remain.
    await client.query(
      `DELETE FROM ${quote(RECEIPTS_TABLE)} gr
        WHERE gr.${quote(receipts.id)} = $1
          AND gr.${quote(receipts.tenantId)} = $2
          AND NOT EXISTS (
            SELECT 1
              FROM ${quote(ITEMS_TABLE)} gri
             WHERE gri.${quote(items.goodsReceiptId)} =
                   gr.${quote(receipts.id)}
               AND gri.${quote(items.tenantId)} =
                   gr.${quote(receipts.tenantId)}
          )`,
      [receiptId, String(tenantId)],
    );

    return true;
  });
}
