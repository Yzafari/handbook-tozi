// Runs before every test file (jest setupFiles). Deterministic test environment.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_at_least_32_characters_long';
process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.PAYMENT_WEBHOOK_SECRET = 'test_webhook_secret_123456';
process.env.COOKIE_SECURE = 'false';