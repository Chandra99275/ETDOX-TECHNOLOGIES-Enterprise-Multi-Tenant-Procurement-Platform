// backend/src/modules/purchase-orders/purchase-orders.repository.js

import { pool } from "../../config/database.js";

const TABLE = "purchase_orders";

const FIELD_CANDIDATES = {
  id: ["id", "purchase_order_id"],
  tenantId: ["tenant_id", "tenantid"],
  poNumber: ["po_number", "order_number", "purchase_order_number"],
  title: ["title", "subject", "name"],
  description: ["description", "notes_description"],
  supplierId: ["supplier_id", "supplierid"],
  requestId: ["purchase_request_id", "request_id"],
  status: ["status", "order_status"],
  currency: ["currency", "currency_code"],
  subtotal: ["subtotal", "sub_total"],
  taxAmount: ["tax_amount", "tax"],
  totalAmount: ["total_amount", "grand_total", "amount", "total"],
  deliveryDate: ["delivery_date", "expected_delivery_date"],
  paymentTerms: ["payment_terms"],
  notes: ["notes", "remarks"],
  createdBy: ["created_by", "created_by_user_id", "user_id"],
  createdAt: ["created_at", "created_on"],
  updatedAt: ["updated_at", "updated_on"],
};

const quote = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

let cachedColumns;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

async function getColumns(client) {
  if (cachedColumns && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedColumns;
  }

  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE],
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Database table "${TABLE}" was not found in the current schema.`,
    );
  }

  const actual = new Set(result.rows.map((row) => row.column_name));
  const mapped = {};

  for (const [logicalName, candidates] of Object.entries(FIELD_CANDIDATES)) {
    mapped[logicalName] =
      candidates.find((candidate) => actual.has(candidate)) ?? null;
  }

  if (!mapped.id) {
    throw new Error(
      `Table "${TABLE}" must have an id or purchase_order_id column.`,
    );
  }

  if (!mapped.tenantId) {
    throw new Error(
      `Table "${TABLE}" must have a tenant_id column for tenant isolation.`,
    );
  }

  cachedColumns = { actual, mapped };
  cachedAt = Date.now();

  return cachedColumns;
}

async function withTenant(tenantId, callback) {
  if (!tenantId) {
    throw new Error("Tenant ID is required for purchase-order queries.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Keep tenant context and all protected queries on the same connection.
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

function valueFor(logicalName, input, userId) {
  if (logicalName === "createdBy") return userId ?? null;
  return input[logicalName];
}

function buildWriteValues(columns, input, userId, { creating = false } = {}) {
  const values = [];
  const names = [];
  const placeholders = [];

  for (const [logicalName, columnName] of Object.entries(columns.mapped)) {
    if (!columnName || logicalName === "id" || logicalName === "tenantId") {
      continue;
    }

    if (logicalName === "createdAt" || logicalName === "updatedAt") {
      continue;
    }

    if (logicalName === "createdBy" && !creating) {
      continue;
    }

    const value = valueFor(logicalName, input, userId);

    if (value === undefined) continue;

    names.push(quote(columnName));
    values.push(value);
    placeholders.push(`$${values.length}`);
  }

  const tenantColumn = quote(columns.mapped.tenantId);

  if (creating) {
    names.unshift(tenantColumn);
    values.unshift(String(input.tenantId));
    placeholders.unshift("$1");

    if (columns.mapped.createdAt) {
      names.push(quote(columns.mapped.createdAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    if (columns.mapped.updatedAt) {
      names.push(quote(columns.mapped.updatedAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }
  } else if (columns.mapped.updatedAt) {
    names.push(quote(columns.mapped.updatedAt));
    placeholders.push("CURRENT_TIMESTAMP");
  }

  return { names, values, placeholders };
}

function normalizeRow(row, mapped) {
  if (!row) return null;

  const result = { ...row };

  for (const [logicalName, columnName] of Object.entries(mapped)) {
    if (columnName && Object.hasOwn(row, columnName)) {
      result[logicalName] = row[columnName];
    }
  }

  return result;
}

function requireColumn(columns, logicalName) {
  const column = columns.mapped[logicalName];

  if (!column) {
    throw new Error(
      `The "${TABLE}" table does not contain a recognized column for "${logicalName}".`,
    );
  }

  return quote(column);
}

export async function listPurchaseOrders(tenantId, filters = {}) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const { mapped } = columns;

    const conditions = [];
    const values = [];

    conditions.push(`${quote(mapped.tenantId)} = $${values.push(String(tenantId))}`);

    if (filters.status && mapped.status) {
      conditions.push(
        `${quote(mapped.status)} = $${values.push(filters.status)}`,
      );
    }

    if (filters.supplierId && mapped.supplierId) {
      conditions.push(
        `${quote(mapped.supplierId)} = $${values.push(filters.supplierId)}`,
      );
    }

    if (filters.search) {
      const searchable = [
        mapped.poNumber,
        mapped.title,
        mapped.description,
      ].filter(Boolean);

      if (searchable.length) {
        const searchParam = `$${values.push(`%${filters.search}%`)}`;
        conditions.push(
          `(${searchable
            .map((column) => `${quote(column)} ILIKE ${searchParam}`)
            .join(" OR ")})`,
        );
      }
    }

    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(filters.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total FROM ${quote(TABLE)} ${whereClause}`,
      values,
    );

    const orderColumn = mapped.createdAt ?? mapped.id;

    const listValues = [...values, limit, offset];
    const result = await client.query(
      `SELECT *
         FROM ${quote(TABLE)}
         ${whereClause}
        ORDER BY ${quote(orderColumn)} DESC
        LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      listValues,
    );

    return {
      data: result.rows.map((row) => normalizeRow(row, mapped)),
      pagination: {
        page,
        limit,
        total: countResult.rows[0]?.total ?? 0,
        totalPages: Math.ceil((countResult.rows[0]?.total ?? 0) / limit),
      },
    };
  });
}

export async function getPurchaseOrderById(tenantId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `SELECT *
         FROM ${quote(TABLE)}
        WHERE ${requireColumn(columns, "id")} = $1
          AND ${requireColumn(columns, "tenantId")} = $2
        LIMIT 1`,
      [id, String(tenantId)],
    );

    return normalizeRow(result.rows[0], columns.mapped);
  });
}

export async function createPurchaseOrder(tenantId, input, userId) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const { names, values, placeholders } = buildWriteValues(
      columns,
      { ...input, tenantId: String(tenantId) },
      userId,
      { creating: true },
    );

    if (names.length === 0) {
      throw new Error("No compatible fields were provided to create the order.");
    }

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)} (${names.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values,
    );

    return normalizeRow(result.rows[0], columns.mapped);
  });
}

export async function updatePurchaseOrder(tenantId, id, input) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const { mapped } = columns;

    const sets = [];
    const values = [];

    for (const [logicalName, columnName] of Object.entries(mapped)) {
      if (
        !columnName ||
        logicalName === "id" ||
        logicalName === "tenantId" ||
        logicalName === "createdBy" ||
        logicalName === "createdAt" ||
        logicalName === "updatedAt"
      ) {
        continue;
      }

      const value = input[logicalName];
      if (value === undefined) continue;

      values.push(value);
      sets.push(`${quote(columnName)} = $${values.length}`);
    }

    if (sets.length === 0) {
      throw new Error("No valid purchase-order fields were supplied for update.");
    }

    if (mapped.updatedAt) {
      sets.push(`${quote(mapped.updatedAt)} = CURRENT_TIMESTAMP`);
    }

    values.push(id);
    const idParameter = `$${values.length}`;

    values.push(String(tenantId));
    const tenantParameter = `$${values.length}`;

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${sets.join(", ")}
        WHERE ${requireColumn(columns, "id")} = ${idParameter}
          AND ${requireColumn(columns, "tenantId")} = ${tenantParameter}
      RETURNING *`,
      values,
    );

    return normalizeRow(result.rows[0], mapped);
  });
}

export async function deletePurchaseOrder(tenantId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `DELETE FROM ${quote(TABLE)}
        WHERE ${requireColumn(columns, "id")} = $1
          AND ${requireColumn(columns, "tenantId")} = $2
      RETURNING ${requireColumn(columns, "id")}`,
      [id, String(tenantId)],
    );

    return result.rowCount > 0;
  });
}