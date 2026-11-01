import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import { app } from '../src/app.js';

describe('ETDOX End-to-End PostgreSQL Source of Truth & Persistence', () => {
  let dbClient;
  let employeeToken;
  let managerToken;
  let financeToken;
  let adminToken;
  let createdRequestId;
  const tenantId = 'b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e';

  beforeAll(async () => {
    dbClient = new pg.Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://etdox_user:postgre99@localhost:5432/etdox_dev',
    });
    await dbClient.connect();

    // 1. Authenticate Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@etdox.com', password: 'employee123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token || empRes.body.accessToken || empRes.body.data?.token;
    expect(employeeToken).toBeTruthy();

    // 2. Authenticate Manager
    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@etdox.com', password: 'manager123' });
    expect(mgrRes.status).toBe(200);
    managerToken = mgrRes.body.token || mgrRes.body.accessToken || mgrRes.body.data?.token;
    expect(managerToken).toBeTruthy();

    // 3. Authenticate Finance
    const finRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'finance@etdox.com', password: 'finance123' });
    expect(finRes.status).toBe(200);
    financeToken = finRes.body.token || finRes.body.accessToken || finRes.body.data?.token;
    expect(financeToken).toBeTruthy();

    // 4. Authenticate Admin
    const admRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@etdox.com', password: 'admin123' });
    expect(admRes.status).toBe(200);
    adminToken = admRes.body.token || admRes.body.accessToken || admRes.body.data?.token;
    expect(adminToken).toBeTruthy();
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }
  });

  it('Step 1: Employee submits a purchase request -> persists in PostgreSQL', async () => {
    const payload = {
      productName: 'High Performance GPU Node',
      description: 'AI model training hardware node for Engineering',
      supplier: 'Dell Technologies',
      quantity: 2,
      unitPrice: 75000,
      total: 150000,
      department: 'Engineering',
      justification: 'Quarterly AI capacity expansion',
      currency: 'INR',
    };

    const res = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdRequestId = res.body.data?.id || res.body.request?.id;
    expect(createdRequestId).toBeTruthy();

    // Verify row directly in PostgreSQL
    await dbClient.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    const dbRow = await dbClient.query(
      'SELECT id, tenant_id, status, total_amount, currency FROM purchase_requests WHERE id = $1',
      [createdRequestId]
    );

    expect(dbRow.rows.length).toBe(1);
    expect(dbRow.rows[0].tenant_id).toBe(tenantId);
    expect(dbRow.rows[0].status).toBe('SUBMITTED');
    expect(Number(dbRow.rows[0].total_amount)).toBe(150000);
    expect(dbRow.rows[0].currency).toBe('INR');

    // Verify items in purchase_request_items
    const itemRows = await dbClient.query(
      'SELECT description, quantity, line_total FROM purchase_request_items WHERE purchase_request_id = $1',
      [createdRequestId]
    );
    expect(itemRows.rows.length).toBeGreaterThan(0);
    expect(itemRows.rows[0].description).toBe('High Performance GPU Node');
    expect(Number(itemRows.rows[0].quantity)).toBe(2);
  });

  it('Step 2: Manager reviews and approves request -> updates PostgreSQL status & creates approval record', async () => {
    expect(createdRequestId).toBeTruthy();

    // Manager lists requests
    const listRes = await request(app)
      .get('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listRes.status).toBe(200);
    const requests = listRes.body.data || listRes.body.requests || [];
    const found = requests.find((r) => r.id === createdRequestId);
    expect(found).toBeDefined();
    expect(found.status).toBe('SUBMITTED');

    // Manager approves
    const approveRes = await request(app)
      .patch(`/api/v1/procurement/requests/${createdRequestId}/manager-decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'APPROVE',
        comment: 'Engineering technical review approved.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // Verify PostgreSQL status updated to IN_APPROVAL
    await dbClient.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    const dbRow = await dbClient.query(
      'SELECT status FROM purchase_requests WHERE id = $1',
      [createdRequestId]
    );
    expect(dbRow.rows[0].status).toBe('IN_APPROVAL');

    // Verify PostgreSQL approvals table has record
    const approvalRow = await dbClient.query(
      'SELECT status, comment FROM approvals WHERE purchase_request_id = $1',
      [createdRequestId]
    );
    expect(approvalRow.rows.length).toBeGreaterThan(0);
    expect(approvalRow.rows[0].status).toBe('approved');
  });

  it('Step 3: Finance reviews and provides final approval -> updates PostgreSQL status to APPROVED', async () => {
    expect(createdRequestId).toBeTruthy();

    // Finance approves
    const finRes = await request(app)
      .patch(`/api/v1/procurement/requests/${createdRequestId}/finance-decision`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        decision: 'APPROVE',
        comment: 'Budget allocated and approved for Q4.',
      });

    expect(finRes.status).toBe(200);
    expect(finRes.body.success).toBe(true);

    // Verify PostgreSQL status is now APPROVED and approved_at is set
    await dbClient.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    const dbRow = await dbClient.query(
      'SELECT status, approved_at FROM purchase_requests WHERE id = $1',
      [createdRequestId]
    );
    expect(dbRow.rows[0].status).toBe('APPROVED');
    expect(dbRow.rows[0].approved_at).not.toBeNull();
  });

  it('Step 4: Admin creates a client / supplier -> persists in PostgreSQL and reflects in API', async () => {
    const clientPayload = {
      name: 'NVIDIA Enterprise Systems',
      contactPerson: 'Jensen Huang',
      email: 'jensen@nvidia.com',
      phone: '+1-408-486-2000',
      category: 'Hardware',
    };

    const createRes = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(clientPayload);

    expect(createRes.status).toBe(201);
    const createdSupplierId = createRes.body.data?.id || createRes.body.client?.id;
    expect(createdSupplierId).toBeTruthy();

    // Verify in PostgreSQL suppliers table
    await dbClient.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    const suppDb = await dbClient.query(
      'SELECT id, legal_name, contact_email FROM suppliers WHERE id = $1',
      [createdSupplierId]
    );
    expect(suppDb.rows.length).toBe(1);
    expect(suppDb.rows[0].legal_name).toBe('NVIDIA Enterprise Systems');

    // Admin lists clients
    const listClients = await request(app)
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listClients.status).toBe(200);
    const clients = listClients.body.data || listClients.body.clients || [];
    const clientFound = clients.find((c) => c.name === 'NVIDIA Enterprise Systems');
    expect(clientFound).toBeDefined();
  });

  it('Step 5: Strict Tenant Isolation: another tenant cannot access data', async () => {
    const isolatedTenantId = 'e2b10000-0000-4000-8000-000000000099';

    // Set tenant context to another tenant
    await dbClient.query("SELECT set_config('app.tenant_id', $1, false)", [isolatedTenantId]);

    // Query purchase_requests from isolated tenant -> must return 0 rows
    const isolatedReqs = await dbClient.query(
      'SELECT * FROM purchase_requests WHERE id = $1',
      [createdRequestId]
    );
    expect(isolatedReqs.rows.length).toBe(0);

    // Query suppliers -> must return 0 rows for other tenant's supplier
    const isolatedSupp = await dbClient.query(
      "SELECT * FROM suppliers WHERE legal_name = 'NVIDIA Enterprise Systems'"
    );
    expect(isolatedSupp.rows.length).toBe(0);
  });

  it('Step 6: UI Refresh Simulation: all data survives and reflects correctly from PostgreSQL', async () => {
    // Simulate user reloading page and fetching from API
    const reloadRes = await request(app)
      .get(`/api/v1/procurement/requests/${createdRequestId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(reloadRes.status).toBe(200);
    const req = reloadRes.body.data || reloadRes.body.request;
    expect(req.id).toBe(createdRequestId);
    expect(req.status).toBe('APPROVED');
    expect(req.amount).toBe(150000);
    expect(req.currency).toBe('INR');
  });
});
