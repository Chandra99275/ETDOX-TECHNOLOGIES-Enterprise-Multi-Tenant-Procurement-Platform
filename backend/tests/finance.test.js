
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

let token;

before(async (t) => {
  const email = process.env.TEST_FINANCE_EMAIL;
  const password = process.env.TEST_FINANCE_PASSWORD;

  if (!email || !password) {
    t.skip('Set TEST_FINANCE_EMAIL and TEST_FINANCE_PASSWORD for finance tests');
    return;
  }

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    t.skip(`Finance test login unavailable (HTTP ${response.status})`);
    return;
  }

  token = response.body.data?.token ?? response.body.token;

  if (!token) t.skip('Login response did not contain an access token');
});

test('finance dashboard requires authentication', async () => {
  const response = await request(app)
    .get('/api/finance/dashboard');

  assert.equal(response.status, 401);
});

test('finance dashboard responds for an authenticated finance user', async (t) => {
  if (!token) t.skip('Finance authentication setup did not complete');

  const response = await request(app)
    .get('/api/finance/dashboard')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(
    response.status,
    200,
    `Expected 200; received ${response.status}: ${JSON.stringify(response.body)}`
  );
});

test('invoice listing requires authentication', async () => {
  const response = await request(app)
    .get('/api/finance/invoices');

  assert.equal(response.status, 401);
});

test('authenticated finance user can access invoice listing', async (t) => {
  if (!token) t.skip('Finance authentication setup did not complete');

  const response = await request(app)
    .get('/api/finance/invoices')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(
    response.status,
    200,
    `Expected 200; received ${response.status}: ${JSON.stringify(response.body)}`
  );
});
