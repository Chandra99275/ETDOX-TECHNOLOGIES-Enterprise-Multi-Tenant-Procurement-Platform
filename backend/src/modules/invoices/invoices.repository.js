// backend/src/modules/invoices/invoices.repository.js

import { pool } from "../../config/database.js";

const TABLE = "invoices";

const CANDIDATES = {
  id: ["id", "invoice_id"],
  tenant: ["tenant_id", "tenantId"],
  invoiceNumber: ["invoice_number", "invoice_no", "number"],
  supplierName: ["supplier_name", "vendor_name", "supplier", "vendor"],
  description: ["description", "notes", "purpose"],
  amount: ["amount", "total_amount", "invoice_amount", "grand_total"],
  currency: ["currency", "currency_code"],
  issueDate: ["issue_date", "invoice_date", "issued_at"],
  dueDate: ["due_date", "payment_due_date"],
  status: ["status", "invoice_status", "payment_status"],
  purchaseRequestId: [
    "purchase_request_id",
    "procurement_request_id",
    "request_id",
  ],
  budgetId: ["budget_id"],
  paymentReference: ["payment_reference", "transaction_reference"],
  createdBy: ["created_by", "created_by_user_id", "user_id"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
};

const quote = (identifier) =>
  `"${String(identifier).replaceAll('"', '""')}"`;

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getTenantId(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    throw httpError("Tenant context is missing.", 403);
  }

  return String(tenantId);
}

function getUserId(user) {
  return user?.id ?? user?.userId ?? user?.user_id ?? null;
}

async function withTenantTransaction(user, callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [getTenantId(user)],
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

async function getColumns(client) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE],
  );

  const all = result.rows.map((row) => row.column_name);

  if (all.length === 0) {
    throw httpError(`The "${TABLE}" table was not found.`, 500);
  }

  const columns = { all };

  for (const [key, candidates] of Object.entries(CANDIDATES)) {
    columns[key] =
      candidates.find((candidate) => all.includes(candidate)) ?? null;
  }

  if (!columns.id || !columns.tenant || !columns.amount) {
    throw httpError(
      "The invoices table must contain an ID, tenant ID, and amount column.",
      500,
    );
  }

  return columns;
}

function selectColumns(columns) {
  return columns.all.map(quote).join(", ");
}

function normalizeInvoice(row, columns) {
  if (!row) return null;

  const value = (key) => {
    const column = columns[key];
    return column ? row[column] ?? null : null;
  };

  return {
    id: row[columns.id],
    invoiceNumber: value("invoiceNumber"),
    supplierName: value("supplierName"),
    description: value("description"),
    amount: Number(row[columns.amount] ?? 0),
    currency: value("currency") ?? "INR",
    issueDate: value("issueDate"),
    dueDate: value("dueDate"),
    status: value("status"),
    purchaseRequestId: value("purchaseRequestId"),
    budgetId: value("budgetId"),
    paymentReference: value("paymentReference"),
    createdBy: value("createdBy"),
    createdAt: value("createdAt"),
    updatedAt: value("updatedAt"),
    raw: row,
  };
}

export async function listInvoices(user, filters = {}) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getColumns(client);
    const conditions = [];
    const params = [];

    if (filters.status && columns.status) {
      params.push(filters.status);
      conditions.push(
        `${quote(columns.status)}::text = $${params.length}`,
      );
    }

    if (filters.supplierName && columns.supplierName) {
      params.push(`%${filters.supplierName}%`);
      conditions.push(
        `${quote(columns.supplierName)}::text ILIKE $${params.length}`,
      );
    }

    if (filters.search) {
      const searchable = [
        columns.invoiceNumber,
        columns.supplierName,
        columns.description,
      ].filter(Boolean);

      if (searchable.length) {
        params.push(`%${filters.search}%`);
        const placeholder = `$${params.length}`;

        conditions.push(
          `(${searchable
            .map((column) => `${quote(column)}::text ILIKE ${placeholder}`)
            .join(" OR ")})`,
        );
      }
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(filters.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         FROM ${quote(TABLE)}
         ${where}`,
      params,
    );

    const dataParams = [...params, limit, offset];

    const result = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
         ${where}
        ORDER BY ${
          columns.createdAt
            ? `${quote(columns.createdAt)} DESC NULLS LAST`
            : `${quote(columns.id)} DESC`
        }
        LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      items: result.rows.map((row) => normalizeInvoice(row, columns)),
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    };
  });
}

export async function findInvoiceById(user, invoiceId) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        LIMIT 1`,
      [String(invoiceId)],
    );

    return normalizeInvoice(result.rows[0] ?? null, columns);
  });
}

export async function createInvoice(user, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getColumns(client);
    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) {
        data[column] = value;
      }
    };

    assign(columns.tenant, getTenantId(user));
    assign(columns.invoiceNumber, input.invoiceNumber);
    assign(columns.supplierName, input.supplierName);
    assign(columns.description, input.description);
    assign(columns.amount, input.amount);
    assign(columns.currency, input.currency ?? "INR");
    assign(columns.issueDate, input.issueDate);
    assign(columns.dueDate, input.dueDate);
    assign(columns.status, input.status ?? "unpaid");
    assign(columns.purchaseRequestId, input.purchaseRequestId);
    assign(columns.budgetId, input.budgetId);
    assign(columns.paymentReference, input.paymentReference);
    assign(columns.createdBy, getUserId(user));

    if (columns.createdAt) data[columns.createdAt] = new Date();
    if (columns.updatedAt) data[columns.updatedAt] = new Date();

    const entries = Object.entries(data);

    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)}
        (${entries.map(([column]) => quote(column)).join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeInvoice(result.rows[0], columns);
  });
}

export async function updateInvoice(user, invoiceId, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getColumns(client);

    const locked = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        FOR UPDATE`,
      [String(invoiceId)],
    );

    if (!locked.rowCount) {
      throw httpError("Invoice not found.", 404);
    }

    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) {
        data[column] = value;
      }
    };

    assign(columns.invoiceNumber, input.invoiceNumber);
    assign(columns.supplierName, input.supplierName);
    assign(columns.description, input.description);
    assign(columns.amount, input.amount);
    assign(columns.currency, input.currency);
    assign(columns.issueDate, input.issueDate);
    assign(columns.dueDate, input.dueDate);
    assign(columns.status, input.status);
    assign(columns.purchaseRequestId, input.purchaseRequestId);
    assign(columns.budgetId, input.budgetId);
    assign(columns.paymentReference, input.paymentReference);

    if (columns.updatedAt) data[columns.updatedAt] = new Date();

    const entries = Object.entries(data);

    if (!entries.length) {
      return normalizeInvoice(locked.rows[0], columns);
    }

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(
      ([column], index) => `${quote(column)} = $${index + 1}`,
    );

    values.push(String(invoiceId));

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${assignments.join(", ")}
        WHERE ${quote(columns.id)}::text = $${values.length}
        RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeInvoice(result.rows[0], columns);
  });
}