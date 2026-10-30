import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

const TENANT_ID =
  process.env.ETDOX_DEMO_TENANT_ID ||
  'b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e';

const ROLES = [
  { name: 'organization_admin', description: 'Tenant organization administrator', permissions: ['*'] },
  { name: 'admin', description: 'Organization administrator', permissions: ['*'] },
  { name: 'requester', description: 'Creates procurement requests', permissions: ['purchase_requests:read', 'purchase_requests:create', 'purchase_requests:submit', 'budgets:read', 'suppliers:read', 'invoices:read', 'receipts:read', 'notifications:read'] },
  { name: 'employee', description: 'Creates procurement requests', permissions: ['purchase_requests:read', 'purchase_requests:create', 'purchase_requests:submit', 'budgets:read', 'suppliers:read', 'invoices:read', 'receipts:read', 'notifications:read'] },
  { name: 'department_manager', description: 'Approves department requests', permissions: ['purchase_requests:read', 'purchase_requests:read_all', 'purchase_requests:manage', 'purchase_requests:approve', 'budgets:read', 'invoices:read', 'invoices:approve', 'purchase_orders:read', 'receipts:read', 'suppliers:read', 'notifications:read'] },
  { name: 'manager', description: 'Manager approver', permissions: ['purchase_requests:read', 'purchase_requests:read_all', 'purchase_requests:manage', 'purchase_requests:approve', 'budgets:read', 'invoices:read', 'invoices:approve', 'purchase_orders:read', 'receipts:read', 'suppliers:read', 'notifications:read'] },
  { name: 'procurement_manager', description: 'Procurement manager', permissions: ['purchase_requests:*', 'purchase_orders:*', 'suppliers:*', 'contracts:*', 'receipts:*', 'invoices:read', 'notifications:read'] },
  { name: 'procurement_specialist', description: 'Procurement specialist', permissions: ['purchase_requests:read', 'purchase_orders:read', 'purchase_orders:create', 'suppliers:*', 'notifications:read'] },
  { name: 'finance_manager', description: 'Reviews invoices and payments', permissions: ['budgets:*', 'invoices:*', 'billing:*', 'purchase_orders:read', 'receipts:read', 'notifications:read'] },
  { name: 'finance', description: 'Finance user', permissions: ['budgets:read', 'budgets:manage', 'invoices:read', 'invoices:manage', 'invoices:approve', 'billing:read', 'billing:manage', 'purchase_orders:read', 'receipts:read', 'notifications:read'] },
  { name: 'auditor', description: 'Read-only compliance auditor', permissions: ['*:read'] },
  { name: 'supplier_user', description: 'Supplier portal user', permissions: ['purchase_orders:read', 'invoices:create'] },
];

// ----------------------------------------------------------------------
// ETDOX Database Seed — Schema, Roles, Departments, Suppliers, Budgets
// No hardcoded credentials or demo accounts are stored in this seed script.
// ----------------------------------------------------------------------

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Set tenant context for RLS first so that app_current_tenant_id() matches
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_ID]);

    // 1. Ensure Tenant exists
    await client.query(
      `INSERT INTO tenants (id, name, slug, base_currency, status)
       VALUES ($1, 'ETDOX Global Technologies', 'etdox-global', 'USD', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE'`,
      [TENANT_ID]
    );

    // Also mirror to organizations table for foreign key compatibility
    await client.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, 'ETDOX Global Technologies', 'etdox-global')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [TENANT_ID]
    );

    // 2. Seed Roles
    const roleMap = new Map();
    for (const r of ROLES) {
      const res = await client.query(
        `INSERT INTO roles (tenant_id, name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (tenant_id, name)
         DO UPDATE SET description = EXCLUDED.description, permissions = EXCLUDED.permissions
         RETURNING id`,
        [TENANT_ID, r.name, r.description, r.permissions]
      );
      roleMap.set(r.name, res.rows[0].id);
    }
    console.log(`Seeded ${roleMap.size} roles.`);

    // 3. User verification: Fetch existing active users without storing fake credentials
    const userRes = await client.query(
      `SELECT id, email FROM users WHERE tenant_id = $1 LIMIT 1`,
      [TENANT_ID]
    );
    const existingUserId = userRes.rows[0]?.id || null;

    // 4. Seed Departments
    const departments = [
      { name: 'Engineering', code: 'ENG' },
      { name: 'Procurement', code: 'PROC' },
      { name: 'Finance', code: 'FIN' },
      { name: 'Operations', code: 'OPS' },
    ];
    const deptMap = new Map();
    for (const d of departments) {
      const res = await client.query(
        `INSERT INTO departments (tenant_id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [TENANT_ID, d.name, d.code]
      );
      deptMap.set(d.code, res.rows[0].id);
    }
    console.log(`Seeded ${departments.length} departments.`);

    // 5. Seed Cost Centers
    for (const [code, deptId] of deptMap.entries()) {
      await client.query(
        `INSERT INTO cost_centers (tenant_id, department_id, code, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [TENANT_ID, deptId, `CC-${code}`, `${code} Center`]
      );
    }

    // 6. Seed Suppliers
    const suppliers = [
      { code: 'SUP-DELL', name: 'Dell Technologies', email: 'sales@dell.com', phone: '+1-800-456-3355' },
      { code: 'SUP-AWS', name: 'Amazon Web Services', email: 'billing@aws.com', phone: '+1-800-555-0199' },
      { code: 'SUP-ODS', name: 'Office Depot Supplies', email: 'orders@officedepot.com', phone: '+1-800-555-0144' },
      { code: 'SUP-APPLE', name: 'Apple Enterprise', email: 'b2b@apple.com', phone: '+1-800-692-7753' },
    ];
    const supplierMap = new Map();
    for (const s of suppliers) {
      const res = await client.query(
        `INSERT INTO suppliers (tenant_id, supplier_code, legal_name, currency, contact_name, contact_email, contact_phone, status, onboarding_status)
         VALUES ($1, $2, $3, 'USD', $3, $4, $5, 'ACTIVE', 'APPROVED')
         ON CONFLICT (tenant_id, supplier_code) DO UPDATE SET legal_name = EXCLUDED.legal_name, status = 'ACTIVE'
         RETURNING id`,
        [TENANT_ID, s.code, s.name, s.email, s.phone]
      );
      supplierMap.set(s.code, res.rows[0].id);
    }
    console.log(`Seeded ${suppliers.length} suppliers.`);

    // 7. Seed Budgets
    const budgets = [
      { code: 'ENG', allocated: 250000, spent: 45000, reserved: 12000 },
      { code: 'PROC', allocated: 150000, spent: 20000, reserved: 5000 },
      { code: 'FIN', allocated: 100000, spent: 10000, reserved: 2000 },
      { code: 'OPS', allocated: 180000, spent: 30000, reserved: 8000 },
    ];
    for (const b of budgets) {
      const deptId = deptMap.get(b.code);
      const existing = await client.query(
        `SELECT id FROM budgets WHERE tenant_id = $1 AND department_id = $2 AND fiscal_year = 2026`,
        [TENANT_ID, deptId]
      );
      if (existing.rowCount === 0) {
        await client.query(
          `INSERT INTO budgets (tenant_id, department_id, fiscal_year, currency, allocated, spent, reserved, status, name, department)
           VALUES ($1, $2, 2026, 'USD', $3, $4, $5, 'active', $6, $6)`,
          [TENANT_ID, deptId, b.allocated, b.spent, b.reserved, b.code]
        );
      }
    }
    console.log(`Seeded ${budgets.length} budgets.`);

    // 8. Seed Sample Purchase Request if none exist and an active user exists
    const prCheck = await client.query(`SELECT count(*)::int as count FROM purchase_requests WHERE tenant_id = $1`, [TENANT_ID]);
    if (prCheck.rows[0].count === 0 && existingUserId) {
      const dellId = supplierMap.get('SUP-DELL');
      const engDeptId = deptMap.get('ENG');

      const prRes = await client.query(
        `INSERT INTO purchase_requests
           (tenant_id, request_number, requester_id, department_id, preferred_supplier_id, justification, currency, subtotal, tax_total, total_amount, status)
         VALUES ($1, 'PR-2026-0001', $2, $3, $4, 'High-performance engineering laptops for new developers', 'USD', 4500, 450, 4950, 'SUBMITTED')
         RETURNING id`,
        [TENANT_ID, existingUserId, engDeptId, dellId]
      );

      const prId = prRes.rows[0].id;
      await client.query(
        `INSERT INTO purchase_request_items
           (tenant_id, purchase_request_id, line_number, description, quantity, unit_price, tax_rate, line_total)
         VALUES ($1, $2, 1, 'Dell XPS 15 Developer Edition', 3, 1500, 10, 4950)`,
        [TENANT_ID, prId]
      );

      // Also create an approval entry
      await client.query(
        `INSERT INTO approvals (tenant_id, purchase_request_id, approver_id, status, comment)
         VALUES ($1, $2, $3, 'pending', 'Awaiting managerial sign-off')`,
        [TENANT_ID, prId, existingUserId]
      );
      console.log('Seeded sample purchase request PR-2026-0001 with approval task.');
    }

    await client.query('COMMIT');
    console.log('\nPostgreSQL database seeded successfully!');
    console.log(`Tenant ID: ${TENANT_ID}`);
    console.log('PostgreSQL is the verified single source of truth.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
