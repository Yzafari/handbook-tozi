import 'dotenv/config';
import { z } from 'zod';

const DEV_ENCRYPTION_KEY =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

const bool = (def) =>
  z
    .enum(['true', 'false'])
    .default(def)
    .transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    APP_BASE_URL: z.string().url().optional(),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
    COOKIE_SECURE: bool('false'),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    ZARINPAL_MERCHANT_ID: z.string().min(1).default('00000000-0000-0000-0000-000000000000'),
    ZARINPAL_SANDBOX: bool('true'),
    ZARINPAL_CALLBACK_URL: z.string().url().default('http://localhost:3000/api/payment/verify'),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16, 'PAYMENT_WEBHOOK_SECRET must be at least 16 chars'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    MAIL_FROM: z.string().default('App <no-reply@localhost>'),
    SEED_SUPER_ADMIN_EMAIL: z.string().default(''),
    SEED_SUPER_ADMIN_PASSWORD: z.string().default(''),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    PAYMENT_PENDING_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
    PAYMENT_REMINDER_DAYS_BEFORE: z.coerce.number().int().min(1).max(90).default(3),
    DATACENTER_URL: z.string().url().default('http://127.0.0.1:8081'),
    DATACENTER_INTERNAL_TOKEN: z.string().default(''),
    DATACENTER_SIGNING_SECRET: z.string().min(32, 'DATACENTER_SIGNING_SECRET must be at least 32 chars'),
    DATACENTER_PUBLIC_URL: z.preprocess(value => value === '' || value == null ? undefined : value, z.string().url().optional()),
    DATACENTER_MAX_FILE_BYTES: z.coerce.number().int().min(1024).max(524288000).default(104857600),
    OPENSEARCH_URL: z.string().url().default('http://127.0.0.1:9200'),
    REDIS_URL: z.string().default(''),
    OPENSEARCH_USERNAME: z.string().default(''),
    OPENSEARCH_PASSWORD: z.string().default(''),
    OPENSEARCH_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(4000),
    OPENSEARCH_INDEX_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(120000),
    OPENSEARCH_DOCUMENT_INDEX: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,100}$/).default('handbook-documents-v1'),
    DOCUMENT_MAX_INDEX_CHARS: z.coerce.number().int().min(1000).max(20000000).default(5000000),
    DOCUMENT_WORKER_POLL_MS: z.coerce.number().int().min(250).max(60000).default(1500),
    DOCUMENT_WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    OCR_MAX_FILE_BYTES: z.coerce.number().int().min(1024).max(52428800).default(15728640),
    OCR_LANGUAGES: z.string().regex(/^[a-z_]+(?:\+[a-z_]+)*$/).default('fas+eng'),
    DOCUMENT_OCR_LANGUAGES: z.string().regex(/^[a-z_]+(?:\+[a-z_]+)*$/).default('fas+eng'),
    DOCUMENT_MAX_FILE_BYTES: z.coerce.number().int().min(1024).max(524288000).default(104857600),
    OCR_WORKER_POLL_MS: z.coerce.number().int().min(250).max(60000).default(1200),
    OCR_WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
    OCR_MAX_TEXT_CHARS: z.coerce.number().int().min(1000).max(5000000).default(1000000),
    AUTH_MAX_FAILED: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    SMTP_SECURE: bool('false'),
  })
  .superRefine((v, ctx) => {
    const bad = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });

    // SameSite=None is rejected by browsers unless the cookie is also Secure.
    // Enforce this in every environment so a misconfigured dev box does not
    // silently drop the refresh cookie.
    if (v.COOKIE_SAME_SITE === 'none' && !v.COOKIE_SECURE) {
      bad('COOKIE_SECURE', 'SameSite=None requires COOKIE_SECURE=true');
    }

    if (v.NODE_ENV !== 'production') return;

    if (v.JWT_ACCESS_SECRET.startsWith('dev_only') || v.JWT_ACCESS_SECRET.startsWith('REPLACE_')) bad('JWT_ACCESS_SECRET', 'a unique production secret is required');
    if (v.PAYMENT_WEBHOOK_SECRET.startsWith('dev_only') || v.PAYMENT_WEBHOOK_SECRET.startsWith('REPLACE_')) bad('PAYMENT_WEBHOOK_SECRET', 'a unique production secret is required');
    if (v.ENCRYPTION_KEY.toLowerCase() === DEV_ENCRYPTION_KEY) bad('ENCRYPTION_KEY', 'dev default not allowed in production');
    if (v.ZARINPAL_MERCHANT_ID === '00000000-0000-0000-0000-000000000000') bad('ZARINPAL_MERCHANT_ID', 'a real merchant id is required in production');
    if (v.ZARINPAL_SANDBOX) bad('ZARINPAL_SANDBOX', 'sandbox mode must be disabled in production');
    if (!v.COOKIE_SECURE) bad('COOKIE_SECURE', 'secure cookies must be enabled in production');
    if (!v.FRONTEND_URL.startsWith('https://')) bad('FRONTEND_URL', 'HTTPS frontend URL is required in production');
    if (v.APP_BASE_URL && !v.APP_BASE_URL.startsWith('https://')) bad('APP_BASE_URL', 'HTTPS app base URL is required in production');

    const allowedOrigins = v.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean);
    if (!allowedOrigins.length) {
      bad('CORS_ORIGINS', 'production CORS origins must be explicit valid HTTPS origins');
    } else {
      for (const origin of allowedOrigins) {
        let parsed;
        try {
          parsed = new URL(origin);
        } catch {
          bad('CORS_ORIGINS', `invalid CORS origin: ${origin}`);
          continue;
        }
        if (parsed.protocol !== 'https:') bad('CORS_ORIGINS', `CORS origin must use HTTPS: ${origin}`);
        if (parsed.origin !== origin) bad('CORS_ORIGINS', `CORS origin must be a bare origin without path, query, or trailing slash: ${origin}`);
      }
    }

    if (v.DATACENTER_SIGNING_SECRET.startsWith('REPLACE_') || v.DATACENTER_SIGNING_SECRET.startsWith('dev_only')) bad('DATACENTER_SIGNING_SECRET', 'a unique production signing secret is required');
    if (!v.DATACENTER_PUBLIC_URL || !v.DATACENTER_PUBLIC_URL.startsWith('https://')) bad('DATACENTER_PUBLIC_URL', 'a public HTTPS storage URL is required in production');
    if (!v.ZARINPAL_CALLBACK_URL.startsWith('https://')) bad('ZARINPAL_CALLBACK_URL', 'HTTPS callback URL is required in production');
    if (!v.DATACENTER_URL.startsWith('https://')) bad('DATACENTER_URL', 'HTTPS datacenter URL is required in production');
    if (v.DATACENTER_INTERNAL_TOKEN.length < 32) bad('DATACENTER_INTERNAL_TOKEN', 'a strong datacenter token is required in production');
    if (v.DATACENTER_INTERNAL_TOKEN.startsWith('REPLACE_') || v.DATACENTER_INTERNAL_TOKEN.startsWith('replace-')) bad('DATACENTER_INTERNAL_TOKEN', 'a unique production datacenter token is required');
    if (!v.OPENSEARCH_URL.startsWith('https://')) bad('OPENSEARCH_URL', 'HTTPS OpenSearch URL is required in production');
    if (!v.OPENSEARCH_USERNAME || !v.OPENSEARCH_PASSWORD) bad('OPENSEARCH_USERNAME', 'OpenSearch credentials are required in production');
    if (!v.REDIS_URL) bad('REDIS_URL', 'Redis is required in production for shared rate limits and cache');
    else if (!v.REDIS_URL.startsWith('rediss://')) bad('REDIS_URL', 'TLS Redis URL is required in production');
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration -> ${msg}`);
}

export const env = parsed.data;
