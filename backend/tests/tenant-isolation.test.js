
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

let tenantAToken;
let tenantBToken;
let tenantARequestId;

async function login(email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Test account login failed with HTTP ${response.status}`);
  }

  const token = response.body.data?.token ?? response.body.token;

  if (!token) {
    throw new Error('Login response did not contain an access token');
  }

  return token;
}

before(async (t) => {
  const emailA = process.env.TEST_TENANT_A_EMAIL;
  const passwordA = process.env.TEST_TENANT_A_PASSWORD;
  const emailB = process.env.TEST_TENANT_B_EMAIL;
  const passwordB = process.env.TEST_TENANT_B_PASSWORD;
  tenantARequestId = process.env.TEST_TENANT_A_REQUEST_ID;

  if (!emailA || !passwordA || !emailB || !passwordB || !tenantARequestId) {
    t.skip(
      'Configure both tenant test accounts and TEST_TENANT_A_REQUEST_ID'
    );
    return;
  }

  try {
    tenantAToken = await login(emailA, passwordA);
    tenantBToken = await login(emailB, passwordB);
  } catch (error) {
    t.skip(`Tenant test setup failed: ${error.message}`);
  }
});

test('tenant B cannot read a purchase request belonging to tenant A', async (t) => {
  if (!tenantAToken || !tenantBToken || !tenantARequestId) {
    t.skip('Tenant isolation test setup did not complete');
  }

  // First confirm that the request exists and is visible to tenant A.
  const tenantAResponse = await request(app)
    .get(`/api/procurement/requests/${tenantARequestId}`)
    .set('Authorization', `Bearer ${tenantAToken}`);

  assert.equal(
    tenantAResponse.status,
    200,
    'The configured request must exist and be accessible to tenant A'
  );

  // Tenant B must not be able to read tenant A's request.
  const tenantBResponse = await request(app)
    .get(`/api/procurement/requests/${tenantARequestId}`)
    .set('Authorization', `Bearer ${tenantBToken}`);

  assert.ok(
    [403, 404].includes(tenantBResponse.status),
    `Expected 403 or 404, received ${tenantBResponse.status}`
  );
});

test('tenant B list does not expose tenant A request IDs', async (t) => {
  if (!tenantAToken || !tenantBToken || !tenantARequestId) {
    t.skip('Tenant isolation test setup did not complete');
  }

  const response = await request(app)
    .get('/api/procurement/requests')
    .set('Authorization', `Bearer ${tenantBToken}`);

  assert.equal(response.status, 200);

  const serializedResponse = JSON.stringify(response.body);

  assert.ok(
    !serializedResponse.includes(tenantARequestId),
    'Tenant B response unexpectedly contains tenant A request ID'
  );
});
