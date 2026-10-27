
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('API foundation', () => {
  it('rejects protected requests without a bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.headers['x-request-id']).toMatch(/^req_/);
  });

  it('returns field-level validation errors before starting registration', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        organizationName: '',
        email: 'not-an-email',
        password: 'short',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields.length).toBeGreaterThan(0);
  });

  it('returns the standard JSON error contract for unknown routes', async () => {
    const response = await request(app).get('/api/v1/no-such-route');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('protects the newly implemented administration and attachment routes', async () => {
    const userResponse = await request(app).get('/api/v1/users');
    const roleResponse = await request(app).get('/api/v1/roles');

    const attachmentResponse = await request(app).get(
      '/api/v1/purchase-requests/00000000-0000-4000-8000-000000000001/attachments'
    );

    const contractResponse = await request(app).get('/api/v1/contracts');
    const billingResponse = await request(app).get('/api/v1/billing/account');
    const webhookResponse = await request(app).get('/api/v1/webhooks');
    const notificationResponse = await request(app).get('/api/v1/notifications');

    expect(userResponse.status).toBe(401);
    expect(roleResponse.status).toBe(401);
    expect(attachmentResponse.status).toBe(401);
    expect(contractResponse.status).toBe(401);
    expect(billingResponse.status).toBe(401);
    expect(webhookResponse.status).toBe(401);
    expect(notificationResponse.status).toBe(401);
  });
});
