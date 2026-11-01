import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

function getTenantId(req) {
  return req.tenantId || req.user?.tenantId;
}

function mapSupplierToClient(row) {
  const meta = row.address || {};
  return {
    id: row.id,
    name: row.legal_name,
    companyName: row.legal_name,
    legalName: row.legal_name,
    contact: row.contact_name,
    contactName: row.contact_name,
    contactPerson: row.contact_name,
    email: row.contact_email,
    contactEmail: row.contact_email,
    phone: row.contact_phone,
    contactPhone: row.contact_phone,
    currency: row.currency,
    plan: meta.plan || 'Professional',
    projectsCount: 0,
    status: row.status === 'ACTIVE' ? 'Active' : row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/v1/clients
router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const result = await pool.query(
      `SELECT * FROM suppliers
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    const clients = result.rows.map(mapSupplierToClient);
    res.json({
      success: true,
      data: clients,
      clients,
      total: clients.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/clients
router.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const name = (req.body.name || req.body.companyName || '').trim();
    const contact = (req.body.contact || req.body.contactPerson || req.body.contactName || '').trim();
    const email = (req.body.email || req.body.contactEmail || '').trim().toLowerCase();
    const phone = (req.body.phone || req.body.contactPhone || '').trim();
    const plan = req.body.plan || 'Professional';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Client name is required.' });
    }

    const supplierCode = `CL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO suppliers
         (tenant_id, supplier_code, legal_name, contact_name, contact_email, contact_phone, currency, status, onboarding_status, address)
       VALUES ($1, $2, $3, $4, $5, $6, 'USD', 'ACTIVE', 'APPROVED', $7)
       RETURNING *`,
      [tenantId, supplierCode, name, contact, email, phone, JSON.stringify({ plan })]
    );

    const client = mapSupplierToClient(result.rows[0]);
    res.status(201).json({
      success: true,
      message: 'Client created successfully.',
      data: client,
      client,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const result = await pool.query(
      `SELECT * FROM suppliers WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    res.json({
      success: true,
      data: mapSupplierToClient(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
