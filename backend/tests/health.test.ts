import request from 'supertest';
import { it, expect } from 'vitest';
import { app } from '../src/app';
it('health', async () => { expect((await request(app).get('/api/v1/health')).status).toBe(200); });
