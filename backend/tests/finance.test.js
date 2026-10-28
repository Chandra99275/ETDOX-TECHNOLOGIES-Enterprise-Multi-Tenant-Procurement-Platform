import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Finance Module & Permissions', () => {
  let token;

  beforeAll(async () => {
    const email = process.env.TEST_FINANCE_EMAIL || 'finance@etdox.com';
    const password = process.env.TEST_FINANCE_PASSWORD || 'finance123';

    try {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password });

      if (response.status === 200) {
        token = response.body.accessToken || response.body.data?.token || response.body.token;
      }
    } catch {
      // optional in test environment
    }
  });

  it('finance dashboard requires authentication', async () => {
    const response = await request(app).get('/api/finance/dashboard');
    expect([401, 404]).toContain(response.status);
  });

  it('invoice listing requires authentication', async () => {
    const response = await request(app).get('/api/v1/invoices');
    expect(response.status).toBe(401);
  });
});
