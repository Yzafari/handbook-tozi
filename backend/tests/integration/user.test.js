import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import userRoutes from '../../src/routes/user.routes.js';
import { errorHandler } from '../../src/middlewares/errorHandler.middleware.js';
import * as userService from '../../src/services/user.service.js';

vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'test-user-id', role: 'USER' };
    next();
  },
}));

vi.mock('../../src/services/user.service.js');

describe('User Routes Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    app.use(errorHandler);
  });

  it('GET /api/users/me returns authenticated user', async () => {
    userService.getMe.mockResolvedValue({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        fullName: 'تست تستی',
        role: 'USER',
      },
    });

    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('PATCH /api/users/me validates body and updates user', async () => {
    userService.updateMe.mockResolvedValue({
      user: {
        id: 'test-user-id',
        fullName: 'نام جدید',
        phone: '09123456789',
      },
    });

    const res = await request(app)
      .patch('/api/users/me')
      .send({ fullName: 'نام جدید', phone: '09123456789' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.fullName).toBe('نام جدید');
  });

  it('PATCH /api/users/me fails validation with invalid iranian phone number', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ phone: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/users/me/dashboard returns dashboard data', async () => {
    userService.getDashboard.mockResolvedValue({
      subscription: null,
      stats: { totalPayments: 0, totalSpentToman: 0, daysRemaining: 0 },
      unreadNotifications: 2,
    });

    const res = await request(app).get('/api/users/me/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadNotifications).toBe(2);
  });

  it('POST /api/users/me/avatar rejects non-image txt file upload', async () => {
    const res = await request(app)
      .post('/api/users/me/avatar')
      .attach('avatar', Buffer.from('hello world'), 'test.txt');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});