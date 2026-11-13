
import { pool } from "../../config/database.js";

const TABLE = "budgets";

const quote = (name) =>
  `"${String(name).replaceAll('"', '""')}"`;

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// ======================================================
// TENANT HELPERS
// ======================================================

function getTenantId(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    throw httpError("Tenant context is missing.", 403);
  }

  return String(tenantId);
}

async function withTenantScope(client, tenantId) {
  await client.query(
    "SELECT set_config('app.tenant_id', $1, true)",
    [tenantId]
  );
}

async function withTenantTransaction(user, callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await withTenantScope(client, getTenantId(user));

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

// ======================================================
// VERIFY DATABASE COLUMNS
// ======================================================

async function verifyBudgetColumns(client) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1`,
    [TABLE]
  );

  const actual = new Set(
    result.rows.map((row) => row.column_name)
  );

  const required = [
    "id",
    "tenant_id",
    "department_id",
    "cost_center_id",
    "fiscal_year",
    "currency",
    "allocated",
    "reserved",
    "committed",
    "spent",
    "created_at",
    "updated_at",
  ];

  const missing = required.filter(
    (column) => !actual.has(column)
  );

  if (missing.length) {
    throw httpError(
      `Budgets table is missing required columns: ${missing.join(", ")}`
    );
  }

  return actual;
}

// ======================================================
// NORMALIZE BUDGET
// ======================================================

function normalizeBudget(row) {
  if (!row) return null;

  const allocated = Number(row.allocated ?? 0);
  const reserved = Number(row.reserved ?? 0);
  const committed = Number(row.committed ?? 0);
  const spent = Number(row.spent ?? 0);

  const available = Math.max(
    0,
    allocated - reserved - committed - spent
  );

  return {
    id: row.id,
    tenantId: row.tenant_id,
    departmentId: row.department_id,
    costCenterId: row.cost_center_id,
    fiscalYear: row.fiscal_year,
    currency: String(row.currency ?? "INR").trim(),

    allocatedAmount: allocated,
    reservedAmount: reserved,
    committedAmount: committed,
    spentAmount: spent,

    availableAmount: available,
    remainingAmount: available,

    utilizationPercentage:
      allocated > 0
        ? Math.round(
            ((reserved + committed + spent) / allocated) *
              10000
          ) / 100
        : 0,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const RETURNING_COLUMNS = `
  id,
  tenant_id,
  department_id,
  cost_center_id,
  fiscal_year,
  currency,
  allocated,
  reserved,
  committed,
  spent,
  created_at,
  updated_at
`;

// ======================================================
// LIST BUDGETS
// ======================================================

export async function listBudgets(user, filters = {}) {
  return withTenantTransaction(user, async (client) => {
    await verifyBudgetColumns(client);

    const conditions = ["tenant_id = $1"];
    const params = [getTenantId(user)];

    if (filters.department) {
      params.push(String(filters.department));

      conditions.push(
        `department_id::text = $${params.length}`
      );
    }

    if (filters.fiscalYear) {
      const fiscalYear = Number(filters.fiscalYear);

      if (!Number.isInteger(fiscalYear)) {
        throw httpError(
          "Fiscal year must be a valid integer.",
          400
        );
      }

      params.push(fiscalYear);

      conditions.push(
        `fiscal_year = $${params.length}`
      );
    }

    const where = conditions.join(" AND ");

    const page = Math.max(
      1,
      Number.parseInt(filters.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(filters.limit, 10) || 20
      )
    );

    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         FROM ${quote(TABLE)}
        WHERE ${where}`,
      params
    );

    const dataParams = [...params, limit, offset];

    const result = await client.query(
      `SELECT ${RETURNING_COLUMNS}
         FROM ${quote(TABLE)}
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${dataParams.length - 1}
        OFFSET $${dataParams.length}`,
      dataParams
    );

    const total = countResult.rows[0].total;

    return {
      items: result.rows.map(normalizeBudget),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

// ======================================================
// FIND BUDGET BY ID
// ======================================================

export async function findBudgetById(user, budgetId) {
  return withTenantTransaction(user, async (client) => {
    await verifyBudgetColumns(client);

    const result = await client.query(
      `SELECT ${RETURNING_COLUMNS}
         FROM ${quote(TABLE)}
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
        LIMIT 1`,
      [
        String(budgetId),
        getTenantId(user),
      ]
    );

    return normalizeBudget(result.rows[0] ?? null);
  });
}

// ======================================================
// CREATE OR UPDATE EXISTING BUDGET
// ======================================================

export async function createBudget(user, input) {
  return withTenantTransaction(user, async (client) => {
    await verifyBudgetColumns(client);

    const tenantId = getTenantId(user);

    // Validate allocated amount
    const allocated = Number(input.allocatedAmount);

    if (!Number.isFinite(allocated) || allocated <= 0) {
      throw httpError(
        "Allocated amount must be greater than zero.",
        400
      );
    }

    // Validate fiscal year
    const fiscalYear = Number(input.fiscalYear);

    if (!Number.isInteger(fiscalYear)) {
      throw httpError(
        "Fiscal year must be an integer, for example 2026.",
        400
      );
    }

    // Validate currency
    const currency = String(input.currency ?? "INR")
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw httpError(
        "Currency must be a valid three-letter code.",
        400
      );
    }

    // Department and cost center
    const departmentId =
      input.departmentId ??
      input.department_id ??
      null;

    const costCenterId =
      input.costCenterId ??
      input.cost_center_id ??
      null;

    /*
     * IMPORTANT:
     *
     * This ON CONFLICT target matches the actual
     * budgets_dimensions_uq unique expression index:
     *
     * tenant_id
     * COALESCE(department_id, zero UUID)
     * COALESCE(cost_center_id, zero UUID)
     * fiscal_year
     * currency
     *
     * Existing budget:
     *   Update allocated and updated_at.
     *
     * New budget:
     *   Insert a new record.
     *
     * Reserved, committed and spent are preserved.
     */

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)} (
          tenant_id,
          department_id,
          cost_center_id,
          fiscal_year,
          currency,
          allocated,
          reserved,
          committed,
          spent,
          created_at,
          updated_at
       )
       VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          0,
          0,
          0,
          NOW(),
          NOW()
       )
       ON CONFLICT (
          tenant_id,
          (COALESCE(
            department_id,
            '00000000-0000-0000-0000-000000000000'::uuid
          )),
          (COALESCE(
            cost_center_id,
            '00000000-0000-0000-0000-000000000000'::uuid
          )),
          fiscal_year,
          currency
       )
       DO UPDATE SET
          allocated = EXCLUDED.allocated,
          updated_at = NOW()
       WHERE
          EXCLUDED.allocated >= (
            budgets.reserved +
            budgets.committed +
            budgets.spent
          )
       RETURNING ${RETURNING_COLUMNS}`,
      [
        tenantId,
        departmentId,
        costCenterId,
        fiscalYear,
        currency,
        allocated,
      ]
    );

    if (!result.rowCount) {
      throw httpError(
        "The new allocated amount cannot be less than the existing reserved, committed, and spent amounts.",
        400
      );
    }

    return normalizeBudget(result.rows[0]);
  });
}

// ======================================================
// UPDATE BUDGET BY ID
// ======================================================

export async function updateBudget(user, budgetId, input) {
  return withTenantTransaction(user, async (client) => {
    await verifyBudgetColumns(client);

    const tenantId = getTenantId(user);

    // Lock existing budget
    const locked = await client.query(
      `SELECT ${RETURNING_COLUMNS}
         FROM ${quote(TABLE)}
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
        FOR UPDATE`,
      [
        String(budgetId),
        tenantId,
      ]
    );

    if (!locked.rowCount) {
      throw httpError("Budget not found.", 404);
    }

    const current = locked.rows[0];

    // Allocated amount
    const allocated =
      input.allocatedAmount !== undefined
        ? Number(input.allocatedAmount)
        : Number(current.allocated);

    const reserved = Number(current.reserved);
    const committed = Number(current.committed);
    const spent = Number(current.spent);

    if (!Number.isFinite(allocated) || allocated <= 0) {
      throw httpError(
        "Allocated amount must be greater than zero.",
        400
      );
    }

    if (allocated < reserved + committed + spent) {
      throw httpError(
        "Allocated amount cannot be less than reserved, committed, and spent amounts.",
        400
      );
    }

    // Department
    const departmentId =
      input.departmentId !== undefined
        ? input.departmentId
        : input.department_id !== undefined
          ? input.department_id
          : current.department_id;

    // Cost center
    const costCenterId =
      input.costCenterId !== undefined
        ? input.costCenterId
        : input.cost_center_id !== undefined
          ? input.cost_center_id
          : current.cost_center_id;

    // Fiscal year
    const fiscalYear =
      input.fiscalYear !== undefined
        ? Number(input.fiscalYear)
        : current.fiscal_year;

    if (!Number.isInteger(fiscalYear)) {
      throw httpError(
        "Fiscal year must be an integer.",
        400
      );
    }

    // Currency
    const currency = String(
      input.currency ?? current.currency
    )
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw httpError(
        "Currency must be a valid three-letter code.",
        400
      );
    }

    try {
      const result = await client.query(
        `UPDATE ${quote(TABLE)}
            SET department_id = $1::uuid,
                cost_center_id = $2::uuid,
                fiscal_year = $3,
                currency = $4,
                allocated = $5,
                updated_at = NOW()
          WHERE id = $6::uuid
            AND tenant_id = $7::uuid
          RETURNING ${RETURNING_COLUMNS}`,
        [
          departmentId,
          costCenterId,
          fiscalYear,
          currency,
          allocated,
          String(budgetId),
          tenantId,
        ]
      );

      return normalizeBudget(result.rows[0]);
    } catch (error) {
      if (
        error.code === "23505" &&
        error.constraint === "budgets_dimensions_uq"
      ) {
        throw httpError(
          "Another budget already exists with this department, cost center, fiscal year, and currency.",
          409
        );
      }

      throw error;
    }
  });
}
