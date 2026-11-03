import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.number().int().positive(),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string(),
  ENCRYPTION_KEY: z.string(),
});

const env = envSchema.parse(process.env);

export const { NODE_ENV, PORT, DATABASE_URL, JWT_ACCESS_SECRET, ENCRYPTION_KEY } = env;
