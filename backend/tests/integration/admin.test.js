import request from 'supertest';
import { randomUUID } from 'node:crypto';

import app from '../../src/app.js';
import prisma from '../../src/config/database.js';
import { hashPassword } from '../../src/utils/hash.util.js';
import { signAccessToken } from '../../src/utils/jwt.util.js';

describe('Admin API integration', () => {
  const suffix = randomUUID();
  const password = 'IntegrationTest2026!';
  const fixtureIds = [];

  let user;
  let admin;
  let superAdmin;
  let target;
  let userToken;
  let adminToken;
  let superAdminToken;

  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  async function createFixtureUser(email, role) {
    const created = await prisma.user.create({
      data: {
        email,
        fullName: `Integration ${role}`,
        passwordHash: await hashPassword(password),
        role,
        isActive: true,
        emailVerified: true,
      },
    });

    fixtureIds.push(created.id);
    return created;
  }

  beforeAll(async () => {
    user = await createFixtureUser(`user-${suffix}@test.local`, 'USER');
    admin = await createFixtureUser(`admin-${suffix}@test.local`, 'ADMIN');
    superAdmin = await createFixtureUser(
      `super-${suffix}@test.local`,
      'SUPER_ADMIN',
    );
    target = await createFixtureUser(`target-${suffix}@test.local`, 'USER');

    userToken = signAccessToken({ sub: user.id, role: user.role });
    adminToken = signAccessToken({ sub: admin.id, role: admin.role });
    superAdminToken = signAccessToken({
      sub: superAdmin.id,
      role: superAdmin.role,
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: fixtureIds } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: fixtureIds } },
    });
    await prisma.payment.deleteMany({
      where: { userId: { in: fixtureIds } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: fixtureIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: fixtureIds } },
          { entityId: { in: fixtureIds } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: fixtureIds } },
    });
    await prisma.$disconnect();
  });

  test('USER receives 403 from the admin API', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set(bearer(userToken));

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('ADMIN can list users and receives pagination metadata', async () => {
    const response = await request(app)
      .get('/api/admin/users?page=1&limit=2')
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(2);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 2,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
    expect(response.body.meta.total).toBeGreaterThanOrEqual(4);
  });

  test('ADMIN cannot change a user role', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set(bearer(adminToken))
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(403);

    const unchanged = await prisma.user.findUnique({
      where: { id: target.id },
    });

    expect(unchanged.role).toBe('USER');
  });

  test('SUPER_ADMIN can change a user role', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set(bearer(superAdminToken))
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe('ADMIN');

    const updated = await prisma.user.findUnique({
      where: { id: target.id },
    });

    expect(updated.role).toBe('ADMIN');
  });

  test('an administrator cannot edit their own account', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set(bearer(adminToken))
      .send({ isActive: false });

    expect(response.status).toBe(403);

    const unchanged = await prisma.user.findUnique({
      where: { id: admin.id },
    });

    expect(unchanged.isActive).toBe(true);
  });

  test('revenue series contains exactly the requested number of days', async () => {
    const days = 7;

    const response = await request(app)
      .get(`/api/admin/stats/revenue?days=${days}`)
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(days);

    for (const entry of response.body.data) {
      expect(entry).toEqual({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        revenueToman: expect.any(Number),
        count: expect.any(Number),
      });
    }
  });

  test('invalid revenue ranges are rejected', async () => {
    const response = await request(app)
      .get('/api/admin/stats/revenue?days=6')
      .set(bearer(adminToken));

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});