import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

function getTenantId(req) {
  return req.tenantId || req.user?.tenantId;
}

// GET /api/v1/transactions
router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);

    // Query payments or budget_transactions for this tenant
    const result = await pool.query(
      `SELECT bt.id, bt.amount, bt.transaction_type AS type, bt.description,
              bt.created_at AS date, bt.created_at AS "createdAt",
              b.name AS "budgetName", b.department,
              COALESCE(i.invoice_number, '') AS "invoiceNumber",
              COALESCE(pr.request_number, '') AS "requestNumber"
       FROM budget_transactions bt
       JOIN budgets b ON b.id = bt.budget_id
       LEFT JOIN invoices i ON i.id = bt.invoice_id
       LEFT JOIN procurement_requests pr ON pr.id = bt.request_id
       WHERE b.tenant_id = $1
       ORDER BY bt.created_at DESC`,
      [tenantId]
    );

    const transactions = result.rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      type: row.type,
      description: row.description,
      department: row.department,
      budgetName: row.budgetName,
      invoiceNumber: row.invoiceNumber,
      requestNumber: row.requestNumber,
      date: row.date,
      createdAt: row.createdAt,
    }));

    res.json({
      success: true,
      data: transactions,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/transactions
router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { budgetId, amount, type = 'expense', description = '', invoiceId, requestId } = req.body;

    if (!budgetId || !amount) {
      return res.status(400).json({ success: false, message: 'budgetId and amount are required.' });
    }

    const result = await pool.query(
      `INSERT INTO budget_transactions (budget_id, amount, transaction_type, description, invoice_id, request_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [budgetId, amount, type, description, invoiceId || null, requestId || null, req.user?.id]
    );

    res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;

