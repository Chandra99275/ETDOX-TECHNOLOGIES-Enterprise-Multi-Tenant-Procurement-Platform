
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
  id: [
    "id",
    "request_id",
    "invoice_id",
    "budget_id",
    "purchase_order_id",
  ],
  tenant: ["tenant_id", "organization_id", "company_id"],
  status: ["status", "state"],
  amount: [
    "total_amount",
    "amount",
    "total",
    "grand_total",
    "net_amount",
    "allocated",
    "allocated_amount",
  ],
  createdAt: [
    "created_at",
    "created_on",
    "submitted_at",
    "date_created",
  ],
  updatedAt: ["updated_at", "modified_at"],
  requester: [
    "requester_id",
    "requested_by",
    "created_by",
    "user_id",
  ],
  invoiceStatus: ["payment_status", "status"],
  budgetAmount: [
    "allocated",
    "allocated_amount",
    "budget_amount",
    "amount",
    "total_amount",
  ],
  spentAmount: [
    "spent",
    "spent_amount",
    "used_amount",
    "actual_spend",
    "utilized_amount",
  ],
};

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function quoteTable(tableName) {
  return `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;
}

function firstColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) ?? null;
}

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
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
 * Read the public PostgreSQL schema.
 */
async function getSchema(client) {
  const result = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'`
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
  for (const tableName of candidates) {
    if (schema.has(tableName)) {
      return {
        name: tableName,
        columns: schema.get(tableName),
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
    paymentStatus: firstColumn(
      columns,
      COLUMN_CANDIDATES.invoiceStatus
    ),
    budgetAmount: firstColumn(
      columns,
      COLUMN_CANDIDATES.budgetAmount
    ),
    spentAmount: firstColumn(
      columns,
      COLUMN_CANDIDATES.spentAmount
    ),
  };
}

/**
 * A table is eligible for analytics only when its tenant column
 * and identifier column can be identified.
 */
function isTenantScopedTable(table, columns) {
  return Boolean(table && columns?.id && columns?.tenant);
}

/**
 * Apply tenant filtering to every analytics query.
 */
function tenantCondition(columns, parameterIndex = 1) {
  return `${quoteIdentifier(columns.tenant)} = $${parameterIndex}`;
}

/**
 * Execute analytics inside a read-only tenant-scoped transaction.
 */
async function withTenantClient(tenantId, callback) {
  if (
    !tenantId ||
    typeof tenantId !== "string" ||
    !tenantId.trim()
  ) {
    const error = new Error(
      "A valid tenant context is required for analytics."
    );

    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN READ ONLY");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }

    throw error;
  } finally {
    client.release();
  }
}

async function countRows(client, table, columns, tenantId) {
  if (!isTenantScopedTable(table, columns)) {
    return 0;
  }

  const result = await client.query(
    `SELECT COUNT(*)::bigint AS count
     FROM ${quoteTable(table.name)}
     WHERE ${tenantCondition(columns)}`,
    [tenantId]
  );

  return toNumber(result.rows[0]?.count);
}

async function getAmountTotal(
  client,
  table,
  columns,
  tenantId
) {
  if (
    !isTenantScopedTable(table, columns) ||
    !columns.amount
  ) {
    return 0;
  }

  const amountColumn = quoteIdentifier(columns.amount);

  const result = await client.query(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN ${amountColumn}::text
                ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN ${amountColumn}::numeric
           ELSE 0
         END
       ),
       0
     )::numeric AS total
     FROM ${quoteTable(table.name)}
     WHERE ${tenantCondition(columns)}`,
    [tenantId]
  );

  return toNumber(result.rows[0]?.total);
}

async function getStatusBreakdown(
  client,
  table,
  columns,
  tenantId
) {
  if (
    !isTenantScopedTable(table, columns) ||
    !columns.status
  ) {
    return [];
  }

  const statusColumn = quoteIdentifier(columns.status);

  const result = await client.query(
    `SELECT
       COALESCE(
         NULLIF(${statusColumn}::text, ''),
         'unknown'
       ) AS status,
       COUNT(*)::bigint AS count
     FROM ${quoteTable(table.name)}
     WHERE ${tenantCondition(columns)}
     GROUP BY ${statusColumn}::text
     ORDER BY count DESC`,
    [tenantId]
  );

  return result.rows.map((row) => ({
    status: row.status,
    count: toNumber(row.count),
  }));
}

async function getRecentRows(
  client,
  table,
  columns,
  tenantId,
  limit = 5
) {
  if (!isTenantScopedTable(table, columns)) {
    return [];
  }

  const selectedColumns = [
    columns.id,
    columns.status,
    columns.amount,
    columns.createdAt,
    columns.updatedAt,
  ].filter(Boolean);

  const uniqueColumns = [...new Set(selectedColumns)];

  const selectList = uniqueColumns
    .map(quoteIdentifier)
    .join(", ");

  const orderColumn = columns.createdAt || columns.updatedAt;

  if (!orderColumn) {
    return [];
  }

  const result = await client.query(
    `SELECT ${selectList}
     FROM ${quoteTable(table.name)}
     WHERE ${tenantCondition(columns)}
     ORDER BY ${quoteIdentifier(orderColumn)} DESC NULLS LAST
     LIMIT $2`,
    [tenantId, limit]
  );

  return result.rows.map((row) => ({
    id: row[columns.id],
    status: columns.status ? row[columns.status] : null,
    amount: columns.amount
      ? toNumber(row[columns.amount])
      : null,
    createdAt: columns.createdAt
      ? row[columns.createdAt]
      : null,
    updatedAt: columns.updatedAt
      ? row[columns.updatedAt]
      : null,
  }));
}

async function getMetric(
  client,
  table,
  tenantId
) {
  if (!table) {
    return emptyMetric();
  }

  const columns = resolveColumns(table);

  if (!isTenantScopedTable(table, columns)) {
    return emptyMetric();
  }

  return {
    available: true,
    count: await countRows(
      client,
      table,
      columns,
      tenantId
    ),
    totalAmount: await getAmountTotal(
      client,
      table,
      columns,
      tenantId
    ),
    byStatus: await getStatusBreakdown(
      client,
      table,
      columns,
      tenantId
    ),
    recent: await getRecentRows(
      client,
      table,
      columns,
      tenantId
    ),
  };
}

async function getBudgetSummary(
  client,
  table,
  tenantId
) {
  const unavailable = {
    available: false,
    count: 0,
    allocatedAmount: 0,
    recordedSpentAmount: null,
    remainingAmount: null,
    utilizationPercentage: null,
  };

  if (!table) {
    return unavailable;
  }

  const columns = resolveColumns(table);

  if (!isTenantScopedTable(table, columns)) {
    return unavailable;
  }

  const count = await countRows(
    client,
    table,
    columns,
    tenantId
  );

  if (!columns.budgetAmount) {
    return {
      ...unavailable,
      available: true,
      count,
    };
  }

  const allocatedColumn = quoteIdentifier(
    columns.budgetAmount
  );

  const allocatedResult = await client.query(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN ${allocatedColumn}::text
                ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN ${allocatedColumn}::numeric
           ELSE 0
         END
       ),
       0
     )::numeric AS total
     FROM ${quoteTable(table.name)}
     WHERE ${tenantCondition(columns)}`,
    [tenantId]
  );

  const allocatedAmount = toNumber(
    allocatedResult.rows[0]?.total
  );

  let recordedSpentAmount = null;

  if (columns.spentAmount) {
    const spentColumn = quoteIdentifier(
      columns.spentAmount
    );

    const spentResult = await client.query(
      `SELECT COALESCE(
         SUM(
           CASE
             WHEN ${spentColumn}::text
                  ~ '^-?[0-9]+(\\.[0-9]+)?$'
             THEN ${spentColumn}::numeric
             ELSE 0
           END
         ),
         0
       )::numeric AS total
       FROM ${quoteTable(table.name)}
       WHERE ${tenantCondition(columns)}`,
      [tenantId]
    );

    recordedSpentAmount = toNumber(
      spentResult.rows[0]?.total
    );
  }

  const remainingAmount =
    recordedSpentAmount === null
      ? null
      : allocatedAmount - recordedSpentAmount;

  const utilizationPercentage =
    recordedSpentAmount === null || allocatedAmount <= 0
      ? null
      : Number(
          (
            (recordedSpentAmount / allocatedAmount) *
            100
          ).toFixed(2)
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

async function getMonthlyTrend(
  client,
  table,
  tenantId
) {
  if (!table) {
    return [];
  }

  const columns = resolveColumns(table);

  if (
    !isTenantScopedTable(table, columns) ||
    !columns.createdAt
  ) {
    return [];
  }

  const dateColumn = quoteIdentifier(columns.createdAt);

  const amountExpression = columns.amount
    ? `COALESCE(
         SUM(
           CASE
             WHEN ${quoteIdentifier(columns.amount)}::text
                  ~ '^-?[0-9]+(\\.[0-9]+)?$'
             THEN ${quoteIdentifier(columns.amount)}::numeric
             ELSE 0
           END
         ),
         0
       )::numeric`
    : "0::numeric";

  const result = await client.query(
    `SELECT
       TO_CHAR(
         DATE_TRUNC('month', ${dateColumn}::timestamp),
         'YYYY-MM'
       ) AS month,
       COUNT(*)::bigint AS count,
       ${amountExpression} AS amount
     FROM ${quoteTable(table.name)}
     WHERE ${tenantCondition(columns)}
       AND ${dateColumn} IS NOT NULL
       AND ${dateColumn}::timestamp >=
           DATE_TRUNC('month', CURRENT_DATE)
           - INTERVAL '5 months'
     GROUP BY DATE_TRUNC(
       'month',
       ${dateColumn}::timestamp
     )
     ORDER BY DATE_TRUNC(
       'month',
       ${dateColumn}::timestamp
     ) ASC`,
    [tenantId]
  );

  return result.rows.map((row) => ({
    month: row.month,
    count: toNumber(row.count),
    amount: toNumber(row.amount),
  }));
}

/**
 * Main dashboard analytics.
 */
export async function getDashboardAnalytics(tenantId) {
  return withTenantClient(tenantId, async (client) => {
    const schema = await getSchema(client);

    const tables = {
      purchaseRequests: findTable(
        schema,
        TABLE_CANDIDATES.purchaseRequests
      ),
      budgets: findTable(
        schema,
        TABLE_CANDIDATES.budgets
      ),
      invoices: findTable(
        schema,
        TABLE_CANDIDATES.invoices
      ),
      purchaseOrders: findTable(
        schema,
        TABLE_CANDIDATES.purchaseOrders
      ),
      suppliers: findTable(
        schema,
        TABLE_CANDIDATES.suppliers
      ),
      receipts: findTable(
        schema,
        TABLE_CANDIDATES.receipts
      ),
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
      getMetric(client, tables.purchaseRequests, tenantId),
      getMetric(client, tables.budgets, tenantId),
      getMetric(client, tables.invoices, tenantId),
      getMetric(client, tables.purchaseOrders, tenantId),
      getMetric(client, tables.suppliers, tenantId),
      getMetric(client, tables.receipts, tenantId),
      getBudgetSummary(client, tables.budgets, tenantId),
      getMonthlyTrend(
        client,
        tables.purchaseRequests,
        tenantId
      ),
      getMonthlyTrend(
        client,
        tables.invoices,
        tenantId
      ),
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
          table?.name ?? null,
        ])
      ),
    };
  });
}
