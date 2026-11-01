// backend/src/modules/receipts/receipts.repository.js

import { pool } from "../../config/database.js";

const TABLE = "goods_receipt_items";

const CANDIDATES = {
  id: ["id", "goods_receipt_item_id", "receipt_item_id"],
  tenantId: ["tenant_id"],
  purchaseOrderId: ["purchase_order_id", "po_id"],
  purchaseOrderItemId: ["purchase_order_item_id", "po_item_id"],
  productId: ["product_id", "item_id"],
  description: ["description", "item_description", "name"],
  orderedQuantity: ["ordered_quantity", "quantity_ordered"],
  receivedQuantity: ["received_quantity", "quantity_received", "quantity"],
  acceptedQuantity: ["accepted_quantity"],
  rejectedQuantity: ["rejected_quantity"],
  unit: ["unit", "unit_of_measure", "uom"],
  status: ["status", "receipt_status"],
  receivedBy: ["received_by", "received_by_user_id"],
  receivedAt: ["received_at", "received_date"],
  notes: ["notes", "remarks"],
  createdAt: ["created_at", "created_on"],
  updatedAt: ["updated_at", "updated_on"],
};

const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;

async function getColumns(client) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE],
  );

  if (result.rows.length === 0) {
    throw new Error(`Table "${TABLE}" was not found in the current schema.`);
  }

  const actual = new Set(result.rows.map((row) => row.column_name));
  const mapped = {};

  for (const [field, candidates] of Object.entries(CANDIDATES)) {
    mapped[field] = candidates.find((name) => actual.has(name)) ?? null;
  }

  if (!mapped.id || !mapped.tenantId) {
    throw new Error(
      `"${TABLE}" must contain a recognized ID column and tenant_id column.`,
    );
  }

  if (!mapped.purchaseOrderId) {
    throw new Error(
      `"${TABLE}" must contain purchase_order_id or po_id.`,
    );
  }

  return mapped;
}

async function withTenant(tenantId, callback) {
  if (!tenantId) {
    throw new Error("Tenant ID is required.");
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

function normalizeRow(row, columns) {
  if (!row) return null;

  const output = { ...row };

  for (const [field, column] of Object.entries(columns)) {
    if (column && Object.hasOwn(row, column)) {
      output[field] = row[column];
    }
  }

  return output;
}

function buildConditions(columns, tenantId, filters = {}) {
  const conditions = [
    `${quote(columns.tenantId)} = $1`,
  ];
  const values = [String(tenantId)];

  if (filters.purchaseOrderId) {
    values.push(filters.purchaseOrderId);
    conditions.push(
      `${quote(columns.purchaseOrderId)} = $${values.length}`,
    );
  }

  if (filters.status && columns.status) {
    values.push(filters.status);
    conditions.push(`${quote(columns.status)} = $${values.length}`);
  }

  return { conditions, values };
}

export async function listReceipts(tenantId, filters = {}) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const { conditions, values } = buildConditions(
      columns,
      tenantId,
      filters,
    );

    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(filters.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;
    const where = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         FROM ${quote(TABLE)}
         ${where}`,
      values,
    );

    const orderColumn = columns.receivedAt ?? columns.createdAt ?? columns.id;

    const result = await client.query(
      `SELECT *
         FROM ${quote(TABLE)}
         ${where}
        ORDER BY ${quote(orderColumn)} DESC
        LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    const total = countResult.rows[0]?.total ?? 0;

    return {
      data: result.rows.map((row) => normalizeRow(row, columns)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

export async function getReceiptById(tenantId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `SELECT *
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)} = $1
          AND ${quote(columns.tenantId)} = $2
        LIMIT 1`,
      [id, String(tenantId)],
    );

    return normalizeRow(result.rows[0], columns);
  });
}

export async function createReceipt(tenantId, input, userId) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const values = [String(tenantId)];
    const names = [quote(columns.tenantId)];
    const placeholders = ["$1"];

    const inputMap = {
      purchaseOrderId: input.purchaseOrderId,
      purchaseOrderItemId: input.purchaseOrderItemId,
      productId: input.productId,
      description: input.description,
      orderedQuantity: input.orderedQuantity,
      receivedQuantity: input.receivedQuantity,
      acceptedQuantity: input.acceptedQuantity,
      rejectedQuantity: input.rejectedQuantity,
      unit: input.unit,
      status: input.status,
      receivedBy: userId,
      receivedAt: input.receivedAt,
      notes: input.notes,
    };

    for (const [field, value] of Object.entries(inputMap)) {
      const column = columns[field];

      if (!column || value === undefined) continue;

      names.push(quote(column));
      values.push(value);
      placeholders.push(`$${values.length}`);
    }

    if (columns.createdAt) {
      names.push(quote(columns.createdAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    if (columns.updatedAt) {
      names.push(quote(columns.updatedAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)}
         (${names.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values,
    );

    return normalizeRow(result.rows[0], columns);
  });
}

export async function updateReceipt(tenantId, id, input) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const values = [];
    const sets = [];

    const inputMap = {
      purchaseOrderId: input.purchaseOrderId,
      purchaseOrderItemId: input.purchaseOrderItemId,
      productId: input.productId,
      description: input.description,
      orderedQuantity: input.orderedQuantity,
      receivedQuantity: input.receivedQuantity,
      acceptedQuantity: input.acceptedQuantity,
      rejectedQuantity: input.rejectedQuantity,
      unit: input.unit,
      status: input.status,
      receivedAt: input.receivedAt,
      notes: input.notes,
    };

    for (const [field, value] of Object.entries(inputMap)) {
      const column = columns[field];

      if (!column || value === undefined) continue;

      values.push(value);
      sets.push(`${quote(column)} = $${values.length}`);
    }

    if (sets.length === 0) {
      throw new Error("No valid receipt fields were provided for update.");
    }

    if (columns.updatedAt) {
      sets.push(`${quote(columns.updatedAt)} = CURRENT_TIMESTAMP`);
    }

    values.push(id);
    const idParameter = `$${values.length}`;

    values.push(String(tenantId));
    const tenantParameter = `$${values.length}`;

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${sets.join(", ")}
        WHERE ${quote(columns.id)} = ${idParameter}
          AND ${quote(columns.tenantId)} = ${tenantParameter}
      RETURNING *`,
      values,
    );

    return normalizeRow(result.rows[0], columns);
  });
}

export async function deleteReceipt(tenantId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `DELETE FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)} = $1
          AND ${quote(columns.tenantId)} = $2
      RETURNING ${quote(columns.id)}`,
      [id, String(tenantId)],
    );

    return result.rowCount > 0;
  });
}