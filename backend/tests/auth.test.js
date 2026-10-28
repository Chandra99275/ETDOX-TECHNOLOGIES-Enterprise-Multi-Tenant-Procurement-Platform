import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as emailService from '../src/modules/email/email.service.js';

describe('ETDOX Authentication & Account Management', () => {
  const testEmail = `user.${Date.now()}@etdox-test.com`;
  const testPassword = 'SecurePassword123!';
  let verificationToken = '';
  let resetToken = '';

  // 1. SMTP Connectivity
  describe('SMTP Email Service', () => {
    it('verifies SMTP configuration or reports missing credentials', async () => {
      const status = await emailService.verifyConnection();
      expect(typeof status.success).toBe('boolean');
      expect(typeof status.configured).toBe('boolean');
    });
  });

  // 2. Registration & Role Security
  describe('Registration and Role Rules', () => {
    it('rejects registration with missing or invalid fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'short',
          organizationMode: 'create',
          organizationName: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.fields.length).toBeGreaterThan(0);
    });

    it('rejects attempt to register as platform_admin', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Evil',
          lastName: 'User',
          email: 'hacker@example.com',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!',
          organizationMode: 'join',
          requestedRole: 'platform_admin',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('successfully registers an organization first-owner (creates new tenant)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
          organizationMode: 'create',
          organizationName: 'Acme Procurement Corp',
          requestedRole: 'organization_admin',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.status).toBe('PENDING_VERIFICATION');
    });

    it('rejects duplicate registration with the same email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Jane',
          lastName: 'Doe',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
          organizationMode: 'create',
          organizationName: 'Acme Duplicate',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  // 3. Login Account States
  describe('Login & Account State Enforcement', () => {
    it('blocks login when email is not yet verified', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('rejects invalid password for known account', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@etdox.com',
          password: 'WrongPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('allows seeded active demo account to login and sets HTTP-only cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@etdox.com',
          password: 'admin123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.role).toBe('organization_admin');
      expect(response.body.redirectTo).toBe('/admin/dashboard');

      // Verify Set-Cookie header contains etdox_token
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('etdox_token='))).toBe(true);
    });
  });

  // 4. Email Verification
  describe('Email Verification Flow', () => {
    it('rejects invalid or missing verification tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-nonexistent-token' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('handles resend verification request with rate limit', async () => {
      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Second immediate request should hit rate limit
      const rateLimitedResponse = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: testEmail });

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error.code).toBe('RATE_LIMITED');
    });
  });

  // 5. Password Recovery
  describe('Password Recovery (Forgot & Reset)', () => {
    it('returns generic success for forgot password on existing account', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@etdox.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('returns the same generic response for nonexistent account to prevent enumeration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent-user@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('rejects invalid reset password token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token-12345',
          newPassword: 'BrandNewPassword123!',
          confirmPassword: 'BrandNewPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects mismatched new passwords during reset', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'some-token',
          newPassword: 'BrandNewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PASSWORD_MISMATCH');
    });
  });

  // 6. Session & Protected Routes
  describe('Session Restoration and Logout', () => {
    it('allows authenticated user to fetch /me with Bearer token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@etdox.com',
          password: 'admin123',
        });

      const token = loginRes.body.accessToken;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('admin@etdox.com');
      expect(meRes.body.user.role).toBe('organization_admin');
    });

    it('allows logout and clears session cookie', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@etdox.com',
          password: 'admin123',
        });

      const token = loginRes.body.accessToken;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      const cookies = logoutRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });
  });
});
