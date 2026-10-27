
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

let token;

before(async (t) => {
  const email = process.env.TEST_AUTH_EMAIL;
  const password = process.env.TEST_AUTH_PASSWORD;

  if (!email || !password) {
    t.skip('Set TEST_AUTH_EMAIL and TEST_AUTH_PASSWORD for procurement integration tests');
    return;
  }

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    t.skip(`Test login unavailable (HTTP ${response.status}); configure a valid test account`);
    return;
  }

  token = response.body.data?.token ?? response.body.token;

  if (!token) {
    t.skip('Login response did not contain an access token');
  }
});

test('GET /api/procurement/requests returns a successful response', async (t) => {
  if (!token) t.skip('Authentication setup did not complete');

  const response = await request(app)
    .get('/api/procurement/requests')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test('POST /api/procurement/requests validates its input', async (t) => {
  if (!token) t.skip('Authentication setup did not complete');

  const response = await request(app)
    .post('/api/procurement/requests')
    .set('Authorization', `Bearer ${token}`)
    .send({});

  assert.ok(
    [400, 422].includes(response.status),
    `Expected validation failure, received ${response.status}`
  );
});

test('POST /api/procurement/requests can create a valid draft', async (t) => {
  if (!token) t.skip('Authentication setup did not complete');

  const rawBody = process.env.TEST_PURCHASE_REQUEST_JSON;

  if (!rawBody) {
    t.skip('Set TEST_PURCHASE_REQUEST_JSON to a valid request body for your schema');
    return;
  }

  let body;

  try {
    body = JSON.parse(rawBody);
  } catch {
    assert.fail('TEST_PURCHASE_REQUEST_JSON must contain valid JSON');
  }

  const response = await request(app)
    .post('/api/procurement/requests')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

  assert.ok(
    [200, 201].includes(response.status),
    `Expected creation success, received ${response.status}: ${JSON.stringify(response.body)}`
  );
  assert.equal(response.body.success, true);
});
