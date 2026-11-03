import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.number().int().positive(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string(),
  CORS_ORIGIN: z.string().url().optional(),
});

const env = envSchema.parse(process.env);

export const { NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, CORS_ORIGIN } = env;
