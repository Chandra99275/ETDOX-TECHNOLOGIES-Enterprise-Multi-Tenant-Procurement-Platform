import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

function getTenantId(req) {
  return req.tenantId || req.user?.tenantId;
}

// GET /api/v1/issues
router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const result = await pool.query(
      `SELECT * FROM issues
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    const issues = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      client: row.client,
      priority: row.priority,
      status: row.status,
      description: row.description,
      reportedBy: row.reported_by,
      date: row.created_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      success: true,
      data: issues,
      issues,
      total: issues.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/issues
router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { title, client, priority = 'Medium', description, status = 'Open' } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Issue title is required.' });
    }

    const result = await pool.query(
      `INSERT INTO issues (tenant_id, title, client, priority, status, description, reported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, title.trim(), (client || '').trim(), priority, status, description || '', req.user?.id]
    );

    const issue = result.rows[0];
    res.status(201).json({
      success: true,
      message: 'Issue created successfully.',
      data: issue,
      issue,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/issues/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { status, priority, description } = req.body;

    const result = await pool.query(
      `UPDATE issues
       SET status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           description = COALESCE($5, description),
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [tenantId, req.params.id, status, priority, description]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Issue not found.' });
    }

    res.json({
      success: true,
      message: 'Issue updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;

