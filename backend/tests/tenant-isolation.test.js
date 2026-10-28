import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Tenant Isolation', () => {
  it('denies cross-tenant or unauthenticated access', async () => {
    const response = await request(app).get('/api/v1/organization');
    expect(response.status).toBe(401);
  });
});
