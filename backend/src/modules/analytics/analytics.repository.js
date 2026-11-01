import { pool } from "../../config/database.js";

const TABLE_CANDIDATES = {
  purchaseRequests: ["purchase_requests", "procurement_requests"],
  budgets: ["budgets"],
  invoices: ["invoices"],
  purchaseOrders: ["purchase_orders"],
  suppliers: ["suppliers"],
  receipts: ["goods_receipt_items"],
};

const COLUMN_CANDIDATES = {
  id: ["id", "request_id", "invoice_id", "budget_id", "purchase_order_id"],
  tenant: ["tenant_id", "organization_id", "company_id"],
  status: ["status", "state"],
  amount: ["total_amount", "amount", "total", "grand_total", "net_amount"],
  createdAt: ["created_at", "created_on", "submitted_at", "date_created"],
  updatedAt: ["updated_at", "modified_at"],
  requester: ["requester_id", "requested_by", "created_by", "user_id"],
  invoiceStatus: ["payment_status", "status"],
  budgetAmount: ["allocated_amount", "budget_amount", "amount", "total_amount"],
  spentAmount: ["spent_amount", "used_amount", "actual_spend", "utilized_amount"],
};

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function firstColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) ?? null;
}

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function getSchema(client) {
  const result = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = ANY(current_schemas(false))`
  );

  const schema = new Map();

  for (const row of result.rows) {
    if (!schema.has(row.table_name)) {
      schema.set(row.table_name, new Set());
    }

    schema.get(row.table_name).add(row.column_name);
  }

  return schema;
}

function findTable(schema, candidates) {
  for (const table of candidates) {
    if (schema.has(table)) {
      return {
        name: table,
        columns: schema.get(table),
      };
    }
  }

  return null;
}

function resolveColumns(table) {
  if (!table) return null;

  const columns = [...table.columns];

  return {
    id: firstColumn(columns, COLUMN_CANDIDATES.id),
    tenant: firstColumn(columns, COLUMN_CANDIDATES.tenant),
    status: firstColumn(columns, COLUMN_CANDIDATES.status),
    amount: firstColumn(columns, COLUMN_CANDIDATES.amount),
    createdAt: firstColumn(columns, COLUMN_CANDIDATES.createdAt),
    updatedAt: firstColumn(columns, COLUMN_CANDIDATES.updatedAt),
    requester: firstColumn(columns, COLUMN_CANDIDATES.requester),
    paymentStatus: firstColumn(columns, COLUMN_CANDIDATES.invoiceStatus),
    budgetAmount: firstColumn(columns, COLUMN_CANDIDATES.budgetAmount),
    spentAmount: firstColumn(columns, COLUMN_CANDIDATES.spentAmount),
  };
}

function emptyMetric() {
  return {
    available: false,
    count: 0,
    totalAmount: 0,
    byStatus: [],
    recent: [],
  };
}

/**
 * Run a tenant-scoped read-only analytics transaction.
 *
 * PostgreSQL's transaction-local setting must be applied on the same client
 * used for every tenant-protected query.
 */
async function withTenantClient(tenantId, callback) {
  if (!tenantId) {
    const error = new Error("A valid tenant context is required.");
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN READ ONLY");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [String(tenantId)]
    );

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }
}

async function countRows(client, table, columns) {
  if (!table || !columns?.id) return 0;

  const result = await client.query(
    `SELECT COUNT(*)::bigint AS count
     FROM ${quoteIdentifier(table.name)}`
  );

  return toNumber(result.rows[0]?.count);
}

async function getAmountTotal(client, table, columns) {
  if (!table || !columns?.amount) return 0;

  const result = await client.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN ${quoteIdentifier(columns.amount)}::text
              ~ '^-?[0-9]+(\\.[0-9]+)?$'
         THEN ${quoteIdentifier(columns.amount)}::numeric
         ELSE 0
       END
     ), 0)::numeric AS total
     FROM ${quoteIdentifier(table.name)}`
  );

  return toNumber(result.rows[0]?.total);
}

async function getStatusBreakdown(client, table, columns) {
  if (!table || !columns?.status) return [];

  const statusColumn = quoteIdentifier(columns.status);

  const result = await client.query(
    `SELECT
       COALESCE(NULLIF(${statusColumn}::text, ''), 'unknown') AS status,
       COUNT(*)::bigint AS count
     FROM ${quoteIdentifier(table.name)}
     GROUP BY ${statusColumn}::text
     ORDER BY count DESC`
  );

  return result.rows.map((row) => ({
    status: row.status,
    count: toNumber(row.count),
  }));
}

async function getRecentRows(client, table, columns, limit = 5) {
  if (!table || !columns?.id) return [];

  const selectedColumns = [
    columns.id,
    columns.status,
    columns.amount,
    columns.createdAt,
    columns.updatedAt,
  ].filter(Boolean);

  const uniqueColumns = [...new Set(selectedColumns)];

  const selectList = uniqueColumns
    .map((column) => quoteIdentifier(column))
    .join(", ");

  const orderColumn = columns.createdAt || columns.updatedAt;

  if (!orderColumn) {
    return [];
  }

  const result = await client.query(
    `SELECT ${selectList}
     FROM ${quoteIdentifier(table.name)}
     ORDER BY ${quoteIdentifier(orderColumn)} DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row[columns.id],
    status: columns.status ? row[columns.status] : null,
    amount: columns.amount ? toNumber(row[columns.amount]) : null,
    createdAt: columns.createdAt ? row[columns.createdAt] : null,
    updatedAt: columns.updatedAt ? row[columns.updatedAt] : null,
  }));
}

async function getMetric(client, table) {
  if (!table) return emptyMetric();

  const columns = resolveColumns(table);

  return {
    available: true,
    count: await countRows(client, table, columns),
    totalAmount: await getAmountTotal(client, table, columns),
    byStatus: await getStatusBreakdown(client, table, columns),
    recent: await getRecentRows(client, table, columns),
  };
}

async function getBudgetSummary(client, table) {
  if (!table) {
    return {
      available: false,
      count: 0,
      allocatedAmount: 0,
      recordedSpentAmount: null,
      remainingAmount: null,
      utilizationPercentage: null,
    };
  }

  const columns = resolveColumns(table);

  const count = await countRows(client, table, columns);

  if (!columns.budgetAmount) {
    return {
      available: true,
      count,
      allocatedAmount: 0,
      recordedSpentAmount: null,
      remainingAmount: null,
      utilizationPercentage: null,
    };
  }

  const allocatedResult = await client.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN ${quoteIdentifier(columns.budgetAmount)}::text
              ~ '^-?[0-9]+(\\.[0-9]+)?$'
         THEN ${quoteIdentifier(columns.budgetAmount)}::numeric
         ELSE 0
       END
     ), 0)::numeric AS total
     FROM ${quoteIdentifier(table.name)}`
  );

  const allocatedAmount = toNumber(allocatedResult.rows[0]?.total);

  let recordedSpentAmount = null;

  if (columns.spentAmount) {
    const spentResult = await client.query(
      `SELECT COALESCE(SUM(
         CASE
           WHEN ${quoteIdentifier(columns.spentAmount)}::text
                ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN ${quoteIdentifier(columns.spentAmount)}::numeric
           ELSE 0
         END
       ), 0)::numeric AS total
       FROM ${quoteIdentifier(table.name)}`
    );

    recordedSpentAmount = toNumber(spentResult.rows[0]?.total);
  }

  const remainingAmount =
    recordedSpentAmount === null
      ? null
      : allocatedAmount - recordedSpentAmount;

  const utilizationPercentage =
    recordedSpentAmount === null || allocatedAmount <= 0
      ? null
      : Number(
          ((recordedSpentAmount / allocatedAmount) * 100).toFixed(2)
        );

  return {
    available: true,
    count,
    allocatedAmount,
    recordedSpentAmount,
    remainingAmount,
    utilizationPercentage,
  };
}

async function getMonthlyTrend(client, table) {
  if (!table) return [];

  const columns = resolveColumns(table);

  if (!columns.createdAt) return [];

  const dateColumn = quoteIdentifier(columns.createdAt);

  const amountExpression = columns.amount
    ? `COALESCE(SUM(
        CASE
          WHEN ${quoteIdentifier(columns.amount)}::text
               ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN ${quoteIdentifier(columns.amount)}::numeric
          ELSE 0
        END
      ), 0)::numeric`
    : "0::numeric";

  const result = await client.query(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', ${dateColumn}::timestamp), 'YYYY-MM')
         AS month,
       COUNT(*)::bigint AS count,
       ${amountExpression} AS amount
     FROM ${quoteIdentifier(table.name)}
     WHERE ${dateColumn} IS NOT NULL
       AND ${dateColumn}::timestamp >=
           DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY DATE_TRUNC('month', ${dateColumn}::timestamp)
     ORDER BY DATE_TRUNC('month', ${dateColumn}::timestamp) ASC`
  );

  return result.rows.map((row) => ({
    month: row.month,
    count: toNumber(row.count),
    amount: toNumber(row.amount),
  }));
}

export async function getDashboardAnalytics(tenantId) {
  return withTenantClient(tenantId, async (client) => {
    const schema = await getSchema(client);

    const tables = {
      purchaseRequests: findTable(
        schema,
        TABLE_CANDIDATES.purchaseRequests
      ),
      budgets: findTable(schema, TABLE_CANDIDATES.budgets),
      invoices: findTable(schema, TABLE_CANDIDATES.invoices),
      purchaseOrders: findTable(schema, TABLE_CANDIDATES.purchaseOrders),
      suppliers: findTable(schema, TABLE_CANDIDATES.suppliers),
      receipts: findTable(schema, TABLE_CANDIDATES.receipts),
    };

    const [
      purchaseRequests,
      budgets,
      invoices,
      purchaseOrders,
      suppliers,
      receipts,
      budgetSummary,
      monthlyPurchaseRequests,
      monthlyInvoices,
    ] = await Promise.all([
      getMetric(client, tables.purchaseRequests),
      getMetric(client, tables.budgets),
      getMetric(client, tables.invoices),
      getMetric(client, tables.purchaseOrders),
      getMetric(client, tables.suppliers),
      getMetric(client, tables.receipts),
      getBudgetSummary(client, tables.budgets),
      getMonthlyTrend(client, tables.purchaseRequests),
      getMonthlyTrend(client, tables.invoices),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      purchaseRequests,
      budgets,
      invoices,
      purchaseOrders,
      suppliers,
      receipts,
      budgetSummary,
      trends: {
        purchaseRequests: monthlyPurchaseRequests,
        invoices: monthlyInvoices,
      },
      sources: Object.fromEntries(
        Object.entries(tables).map(([key, table]) => [
          key,
          table ? table.name : null,
        ])
      ),
    };
  });
}