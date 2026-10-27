
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

const email = process.env.TEST_AUTH_EMAIL;
const password = process.env.TEST_AUTH_PASSWORD;

test('POST /api/auth/login rejects missing credentials', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({});

  assert.ok(
    response.status === 400 || response.status === 401,
    `Expected 400 or 401, received ${response.status}`
  );
});

test('POST /api/auth/login rejects invalid credentials', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'invalid-user@example.test',
      password: 'Invalid-Password-123!',
    });

  assert.ok(
    [400, 401, 422].includes(response.status),
    `Expected a validation/authentication error, received ${response.status}`
  );
});

test('POST /api/auth/login accepts configured test credentials', async (t) => {
  if (!email || !password) {
    t.skip('Set TEST_AUTH_EMAIL and TEST_AUTH_PASSWORD to test successful login');
    return;
  }

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const token = response.body.data?.token ?? response.body.token;
  assert.ok(token, 'Login response should contain an access token');
});

test('protected procurement endpoint rejects unauthenticated requests', async () => {
  const response = await request(app)
    .get('/api/procurement/requests');

  assert.equal(response.status, 401);
});
