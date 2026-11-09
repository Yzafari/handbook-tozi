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
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
    COOKIE_SECURE: bool('false'),
    ZARINPAL_MERCHANT_ID: z.string().min(1).default('00000000-0000-0000-0000-000000000000'),
    ZARINPAL_SANDBOX: bool('true'),
    ZARINPAL_CALLBACK_URL: z.string().url().default('http://localhost:4000/api/payment/verify'),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16, 'PAYMENT_WEBHOOK_SECRET must be at least 16 chars'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    MAIL_FROM: z.string().default('App <no-reply@localhost>'),
    SEED_SUPER_ADMIN_EMAIL: z.string().default(''),
    SEED_SUPER_ADMIN_PASSWORD: z.string().default(''),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== 'production') return;
    const bad = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.JWT_ACCESS_SECRET.startsWith('dev_only')) bad('JWT_ACCESS_SECRET', 'dev default not allowed in production');
    if (v.PAYMENT_WEBHOOK_SECRET.startsWith('dev_only')) bad('PAYMENT_WEBHOOK_SECRET', 'dev default not allowed in production');
    if (v.ENCRYPTION_KEY.toLowerCase() === DEV_ENCRYPTION_KEY) bad('ENCRYPTION_KEY', 'dev default not allowed in production');
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration -> ${msg}`);
}

export const env = parsed.data;