
import request from 'supertest';
import { it, expect } from 'vitest';
import { app } from '../src/app.js';

it('health', async () => {
  const response = await request(app).get('/api/v1/health');

  expect(response.status).toBe(200);
});
