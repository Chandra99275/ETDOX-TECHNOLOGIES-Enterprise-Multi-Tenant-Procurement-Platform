process.env.JWT_SECRET = 'unit-test-only-secret-that-is-never-used-outside-tests';
process.env.WEBHOOK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:5432/etdox_test';
