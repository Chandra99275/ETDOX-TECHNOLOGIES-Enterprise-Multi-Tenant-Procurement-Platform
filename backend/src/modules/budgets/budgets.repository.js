// backend/src/modules/budgets/budgets.repository.js

import { pool } from "../../config/database.js";

const TABLE = "budgets";

const CANDIDATES = {
  id: ["id", "budget_id"],
  tenant: ["tenant_id", "tenantId"],
  name: ["name", "budget_name", "title"],
  description: ["description", "purpose"],
  department: ["department", "department_name", "cost_center"],
  category: ["category", "budget_category"],
  allocated: [
    "allocated_amount",
    "total_amount",
    "budget_amount",
    "amount",
    "limit_amount",
  ],
  spent: ["spent_amount", "used_amount", "actual_amount", "utilized_amount"],
  currency: ["currency", "currency_code"],
  fiscalYear: ["fiscal_year", "financial_year", "year"],
  startDate: ["start_date", "period_start"],
  endDate: ["end_date", "period_end"],
  status: ["status", "budget_status"],
  createdBy: ["created_by", "created_by_user_id", "user_id"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
};

const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getTenantId(user) {
  const id = user?.tenantId ?? user?.tenant_id;

  if (!id) {
    throw httpError("Tenant context is missing.", 403);
  }

  return String(id);
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

async function getBudgetColumns(client) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE],
  );

  const all = result.rows.map((row) => row.column_name);

  if (!all.length) {
    throw httpError(`The "${TABLE}" table was not found.`, 500);
  }

  const mapped = { all };

  for (const [key, candidates] of Object.entries(CANDIDATES)) {
    mapped[key] = candidates.find((candidate) => all.includes(candidate)) ?? null;
  }

  if (!mapped.id || !mapped.tenant || !mapped.allocated) {
    throw httpError(
      'The budgets table must contain an ID, tenant ID, and budget amount column.',
      500,
    );
  }

  return mapped;
}

function selectColumns(columns) {
  return columns.all.map(quote).join(", ");
}

function normalizeBudget(row, columns) {
  if (!row) return null;

  const allocated = Number(row[columns.allocated] ?? 0);
  const spent = columns.spent ? Number(row[columns.spent] ?? 0) : null;

  return {
    id: row[columns.id],
    name: columns.name ? row[columns.name] ?? null : null,
    description: columns.description ? row[columns.description] ?? null : null,
    department: columns.department ? row[columns.department] ?? null : null,
    category: columns.category ? row[columns.category] ?? null : null,
    allocatedAmount: allocated,
    spentAmount: spent,
    remainingAmount: spent === null ? null : allocated - spent,
    utilizationPercentage:
      spent === null || allocated <= 0
        ? null
        : Math.round((spent / allocated) * 10000) / 100,
    currency: columns.currency ? row[columns.currency] ?? "INR" : "INR",
    fiscalYear: columns.fiscalYear ? row[columns.fiscalYear] ?? null : null,
    startDate: columns.startDate ? row[columns.startDate] ?? null : null,
    endDate: columns.endDate ? row[columns.endDate] ?? null : null,
    status: columns.status ? row[columns.status] ?? null : null,
    createdBy: columns.createdBy ? row[columns.createdBy] ?? null : null,
    createdAt: columns.createdAt ? row[columns.createdAt] ?? null : null,
    updatedAt: columns.updatedAt ? row[columns.updatedAt] ?? null : null,
    raw: row,
  };
}

export async function listBudgets(user, filters = {}) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getBudgetColumns(client);
    const conditions = [];
    const params = [];

    if (filters.status && columns.status) {
      params.push(filters.status);
      conditions.push(`${quote(columns.status)}::text = $${params.length}`);
    }

    if (filters.department && columns.department) {
      params.push(filters.department);
      conditions.push(`${quote(columns.department)}::text = $${params.length}`);
    }

    if (filters.fiscalYear && columns.fiscalYear) {
      params.push(filters.fiscalYear);
      conditions.push(`${quote(columns.fiscalYear)}::text = $${params.length}`);
    }

    if (filters.search) {
      const searchable = [columns.name, columns.description, columns.category]
        .filter(Boolean);

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
      `SELECT COUNT(*)::int AS total FROM ${quote(TABLE)} ${where}`,
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
      items: result.rows.map((row) => normalizeBudget(row, columns)),
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    };
  });
}

export async function findBudgetById(user, budgetId) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getBudgetColumns(client);

    const result = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        LIMIT 1`,
      [String(budgetId)],
    );

    return normalizeBudget(result.rows[0] ?? null, columns);
  });
}

export async function createBudget(user, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getBudgetColumns(client);
    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) data[column] = value;
    };

    assign(columns.tenant, getTenantId(user));
    assign(columns.name, input.name);
    assign(columns.description, input.description);
    assign(columns.department, input.department);
    assign(columns.category, input.category);
    assign(columns.allocated, input.allocatedAmount);
    assign(columns.currency, input.currency ?? "INR");
    assign(columns.fiscalYear, input.fiscalYear);
    assign(columns.startDate, input.startDate);
    assign(columns.endDate, input.endDate);
    assign(columns.status, input.status ?? "active");
    assign(columns.createdBy, getUserId(user));

    if (columns.spent) assign(columns.spent, 0);
    if (columns.createdAt) assign(columns.createdAt, new Date());
    if (columns.updatedAt) assign(columns.updatedAt, new Date());

    const entries = Object.entries(data);

    if (!entries.some(([column]) => column === columns.tenant)) {
      throw httpError("Unable to set the budget tenant.", 500);
    }

    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)}
        (${entries.map(([column]) => quote(column)).join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeBudget(result.rows[0], columns);
  });
}

export async function updateBudget(user, budgetId, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getBudgetColumns(client);

    const locked = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        FOR UPDATE`,
      [String(budgetId)],
    );

    if (!locked.rowCount) {
      throw httpError("Budget not found.", 404);
    }

    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) data[column] = value;
    };

    assign(columns.name, input.name);
    assign(columns.description, input.description);
    assign(columns.department, input.department);
    assign(columns.category, input.category);
    assign(columns.allocated, input.allocatedAmount);
    assign(columns.currency, input.currency);
    assign(columns.fiscalYear, input.fiscalYear);
    assign(columns.startDate, input.startDate);
    assign(columns.endDate, input.endDate);
    assign(columns.status, input.status);

    if (columns.updatedAt) data[columns.updatedAt] = new Date();

    const entries = Object.entries(data);

    if (!entries.length) {
      return normalizeBudget(locked.rows[0], columns);
    }

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(
      ([column], index) => `${quote(column)} = $${index + 1}`,
    );

    values.push(String(budgetId));

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${assignments.join(", ")}
        WHERE ${quote(columns.id)}::text = $${values.length}
        RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeBudget(result.rows[0], columns);
  });
}