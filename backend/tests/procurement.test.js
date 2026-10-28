import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Procurement Module', () => {
  let token;

  beforeAll(async () => {
    const email = process.env.TEST_AUTH_EMAIL || 'employee@etdox.com';
    const password = process.env.TEST_AUTH_PASSWORD || 'employee123';

    try {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password });

      if (response.status === 200) {
        token = response.body.accessToken || response.body.data?.token || response.body.token;
      }
    } catch {
      // optional
    }
  });

  it('rejects unauthenticated requests to procurement endpoints', async () => {
    const response = await request(app).get('/api/v1/procurement');
    expect(response.status).toBe(401);
  });
});
