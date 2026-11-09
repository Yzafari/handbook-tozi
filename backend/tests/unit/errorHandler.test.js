import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../src/utils/response.util.js';
import { env } from '../../src/config/env.js';
import { notFoundHandler, errorHandler } from '../../src/middlewares/errorHandler.middleware.js';

function prismaError(code, meta) {
  const e = new Error('prisma failure');
  e.name = 'PrismaClientKnownRequestError';
  e.code = code;
  e.meta = meta;
  e.clientVersion = '5.22.0';
  return e;
}

function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/app-error', () => {
    throw new AppError(403, 'FORBIDDEN', 'nope', { reason: 'test' });
  });
  app.get('/payment-error', () => {
    throw new AppError(502, 'PAYMENT_ERROR', 'gateway down');
  });
  app.get('/zod', () => {
    z.object({ email: z.string().email() }).parse({ email: 'bad' });
  });
  app.get('/p2002', () => {
    throw prismaError('P2002', { target: ['email'] });
  });
  app.get('/p2025', () => {
    throw prismaError('P2025');
  });
  app.get('/jwt-expired', () => {
    const t = jwt.sign({ sub: '1' }, 'k', { expiresIn: -10 });
    jwt.verify(t, 'k');
  });
  app.get('/jwt-invalid', () => {
    jwt.verify('abc', 'k');
  });
  app.get('/multer-size', () => {
    throw new multer.MulterError('LIMIT_FILE_SIZE', 'avatar');
  });
  app.get('/boom', () => {
    throw new Error('database password is hunter2');
  });
  app.post('/echo', (req, res) => res.json({ success: true, data: req.body }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('errorHandler', () => {
  test('AppError keeps status, code, message and details', async () => {
    const res = await request(app).get('/app-error');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'FORBIDDEN', message: 'nope', details: { reason: 'test' } },
    });
  });

  test('AppError 502 PAYMENT_ERROR', async () => {
    const res = await request(app).get('/payment-error');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_ERROR');
  });

  test('ZodError -> 400 VALIDATION_ERROR with details', async () => {
    const res = await request(app).get('/zod');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('email');
  });

  test('Prisma P2002 -> 409 CONFLICT', async () => {
    const res = await request(app).get('/p2002');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details.fields).toEqual(['email']);
  });

  test('Prisma P2025 -> 404 NOT_FOUND', async () => {
    const res = await request(app).get('/p2025');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('expired JWT -> 401 TOKEN_EXPIRED', async () => {
    const res = await request(app).get('/jwt-expired');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  test('invalid JWT -> 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/jwt-invalid');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('multer error -> 400', async () => {
    const res = await request(app).get('/multer-size');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('File too large');
  });

  test('malformed JSON body -> 400', async () => {
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('unknown route -> 404 NOT_FOUND', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  describe('unknown errors', () => {
    const original = env.NODE_ENV;
    afterEach(() => {
      env.NODE_ENV = original;
    });

    test('non-production: 500 INTERNAL_ERROR includes stack', async () => {
      env.NODE_ENV = 'development';
      const res = await request(app).get('/boom');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.details.stack).toEqual(expect.any(String));
    });

    test('production: 500 hides message and stack', async () => {
      env.NODE_ENV = 'production';
      const res = await request(app).get('/boom');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/hunter2|stack/);
    });
  });
});