
import { Router } from "express";
import { pool } from "../../config/database.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getTenantId(req) {
  return (
    req.tenantId ??
    req.user?.tenantId ??
    req.user?.tenant_id ??
    req.user?.tenant?.id ??
    null
  );
}

function getUserId(req) {
  return (
    req.user?.id ??
    req.user?.userId ??
    req.user?.user_id ??
    null
  );
}

function validateTenant(req) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    throw httpError(
      "Your authenticated account does not have a tenant assigned.",
      403
    );
  }

  return String(tenantId);
}

async function transactionTableExists(client) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'budget_transactions'
     ) AS exists`
  );

  return result.rows[0]?.exists === true;
}

/**
 * GET /api/v1/transactions
 *
 * Returns tenant-scoped budget transactions.
 */
router.get("/", async (req, res, next) => {
  try {
    const tenantId = validateTenant(req);

    const exists = await transactionTableExists(pool);

    // The transactions table has not yet been created.
    // Return an explicit unavailable state instead of a SQL 500.
    if (!exists) {
      return res.status(200).json({
        success: true,
        available: false,
        message:
          "Budget transactions are not configured yet. The budget_transactions table must be created through a database migration.",
        data: [],
        transactions: [],
        total: 0,
      });
    }

    const result = await pool.query(
      `SELECT
         bt.id,
         bt.budget_id AS "budgetId",
         bt.amount,
         bt.transaction_type AS type,
         bt.description,
         bt.created_at AS date,
         bt.created_at AS "createdAt",
         b.department_id AS "departmentId",
         b.cost_center_id AS "costCenterId",
         b.currency,
         bt.invoice_id AS "invoiceId",
         bt.request_id AS "requestId"
       FROM public.budget_transactions bt
       INNER JOIN public.budgets b
         ON b.id = bt.budget_id
       WHERE b.tenant_id = $1
       ORDER BY bt.created_at DESC NULLS LAST`,
      [tenantId]
    );

    const transactions = result.rows.map((row) => ({
      id: row.id,
      budgetId: row.budgetId,
      amount: Number(row.amount),
      type: row.type,
      description: row.description,
      departmentId: row.departmentId,
      costCenterId: row.costCenterId,
      currency: row.currency,
      invoiceId: row.invoiceId,
      requestId: row.requestId,
      date: row.date,
      createdAt: row.createdAt,
    }));

    return res.status(200).json({
      success: true,
      available: true,
      data: transactions,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/transactions
 *
 * Records a transaction only after verifying budget ownership.
 */
router.post("/", async (req, res, next) => {
  const client = await pool.connect();

  try {
    const tenantId = validateTenant(req);
    const userId = getUserId(req);

    const {
      budgetId,
      amount,
      type = "expense",
      description = "",
      invoiceId = null,
      requestId = null,
    } = req.body ?? {};

    if (!budgetId) {
      throw httpError("budgetId is required.", 400);
    }

    if (
      amount === undefined ||
      amount === null ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      throw httpError(
        "A valid transaction amount greater than zero is required.",
        400
      );
    }

    const allowedTypes = [
      "expense",
      "income",
      "credit",
      "debit",
      "adjustment",
    ];

    if (
      typeof type !== "string" ||
      !allowedTypes.includes(type.toLowerCase())
    ) {
      throw httpError(
        `Invalid transaction type. Allowed types: ${allowedTypes.join(", ")}.`,
        400
      );
    }

    if (typeof description !== "string") {
      throw httpError("description must be a string.", 400);
    }

    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const budgetResult = await client.query(
      `SELECT id
       FROM public.budgets
       WHERE id = $1
         AND tenant_id = $2
       FOR UPDATE`,
      [budgetId, tenantId]
    );

    if (budgetResult.rowCount === 0) {
      throw httpError(
        "The requested budget was not found for your organization.",
        404
      );
    }

    const exists = await transactionTableExists(client);

    if (!exists) {
      throw httpError(
        "Transactions cannot be recorded because the budget_transactions table has not been created. A database migration is required.",
        503
      );
    }

    const result = await client.query(
      `INSERT INTO public.budget_transactions (
         budget_id,
         amount,
         transaction_type,
         description,
         invoice_id,
         request_id,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        budgetId,
        Number(amount),
        type.toLowerCase(),
        description.trim(),
        invoiceId,
        requestId,
        userId,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Transaction recorded successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    next(error);
  } finally {
    client.release();
  }
});

export default router;
