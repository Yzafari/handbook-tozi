import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';

// ---- Test environment (must run before app modules are imported) ----
process.env.NODE_ENV = 'test';
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_ACCESS_SECRET ??= `test_access_secret_${'x'.repeat(48)}`;
process.env.ENCRYPTION_KEY ??= 'ab'.repeat(32);
process.env.COOKIE_SECURE = 'false';

// Rate limiting would interfere with the many auth calls made here.
const pass = (req, res, next) => next();
jest.unstable_mockModule('../../src/middlewares/rateLimit.middleware.js', () => ({
  globalLimiter: pass,
  authLimiter: pass,
  paymentLimiter: pass,
}));

jest.setTimeout(60000);

const API = '/api/auth';
const USER = {
  email: 'Test.User@Example.com',
  password: 'Passw0rdX',
  fullName: 'کاربر تست',
  phone: '09123456789',
};
const EMAIL = USER.email.toLowerCase();

let app;
let prisma;

beforeAll(async () => {
  ({ default: app } = await import('../../src/app.js'));
  ({ default: prisma } = await import('../../src/config/database.js'));
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---- helpers ----
const register = (body = USER) => request(app).post(`${API}/register`).send(body);
const login = (body = { email: USER.email, password: USER.password }) =>
  request(app).post(`${API}/login`).send(body);

const setCookies = (res) => res.headers['set-cookie'] || [];
const rawCookie = (res, name) => setCookies(res).find((c) => c.startsWith(`${name}=`));
const cookiePair = (res, name) => rawCookie(res, name)?.split(';')[0];
const valueOf = (pair) => pair.slice(pair.indexOf('=') + 1);

const refreshReq = (refreshPair, csrfPair, { sendHeader = true } = {}) => {
  const cookies = [refreshPair, csrfPair].filter(Boolean).join('; ');
  let r = request(app).post(`${API}/refresh`);
  if (cookies) r = r.set('Cookie', cookies);
  if (sendHeader && csrfPair) r = r.set('X-CSRF-Token', valueOf(csrfPair));
  return r;
};

const logoutReq = (refreshPair, csrfPair) =>
  request(app)
    .post(`${API}/logout`)
    .set('Cookie', [refreshPair, csrfPair].join('; '))
    .set('X-CSRF-Token', valueOf(csrfPair));

async function loginSession() {
  await register();
  const res = await login();
  return {
    res,
    refresh: cookiePair(res, 'gh_refresh'),
    csrf: cookiePair(res, 'gh_csrf'),
    accessToken: res.body.data.accessToken,
  };
}

function expectNoSecrets(res) {
  const s = JSON.stringify(res.body);
  for (const key of ['passwordHash', 'phoneEncrypted', 'failedLoginCount', 'lockedUntil', 'tokenHash']) {
    expect(s).not.toContain(key);
  }
  expect(s).not.toMatch(/\$2[aby]\$/);
}

describe('POST /api/auth/register', () => {
  it('registers a user (201) without logging in and never leaks secrets', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(EMAIL);
    expect(res.body.data.user.phone).toBe(USER.phone);
    expect(res.body.data.user.role).toBe('USER');
    expect(res.body.data.accessToken).toBeUndefined();
    expect(setCookies(res)).toHaveLength(0);
    expectNoSecrets(res);

    const row = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(row.passwordHash).not.toBe(USER.password);
    expect(row.phoneEncrypted).toBeTruthy();
    expect(row.phoneEncrypted).not.toContain(USER.phone);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'REGISTER', userId: row.id } });
    expect(audit).not.toBeNull();
  });

  it('returns 409 CONFLICT on duplicate email (case-insensitive)', async () => {
    await register();
    const res = await register({ ...USER, email: EMAIL.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 VALIDATION_ERROR for weak passwords', async () => {
    for (const password of ['short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsHere', 'A1a'.repeat(30)]) {
      const res = await register({ ...USER, password });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in, returns accessToken and sets gh_refresh + gh_csrf cookies', async () => {
    await register();
    const res = await login();
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(EMAIL);
    expect(res.body.data.refreshToken).toBeUndefined();
    expectNoSecrets(res);

    const refreshCookie = rawCookie(res, 'gh_refresh');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);

    const csrfCookie = rawCookie(res, 'gh_csrf');
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
    expect(csrfCookie).toMatch(/SameSite=Strict/i);

    const tokens = await prisma.refreshToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(valueOf(cookiePair(res, 'gh_refresh')));
  });

  it('returns 401 for wrong password and unknown email with the same message', async () => {
    await register();
    const wrong = await login({ email: USER.email, password: 'Wrong0Password' });
    const unknown = await login({ email: 'nobody@example.com', password: 'Wrong0Password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('UNAUTHORIZED');
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('locks the account after 5 consecutive failures (423 ACCOUNT_LOCKED)', async () => {
    await register();
    for (let i = 1; i <= 4; i += 1) {
      const res = await login({ email: USER.email, password: 'Wrong0Password' });
      expect(res.status).toBe(401);
    }
    const fifth = await login({ email: USER.email, password: 'Wrong0Password' });
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe('ACCOUNT_LOCKED');

    // Even the correct password is rejected while locked.
    const correct = await login();
    expect(correct.status).toBe(423);

    const row = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(row.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(await prisma.auditLog.count({ where: { action: 'LOGIN_LOCKED' } })).toBeGreaterThan(0);
  });

  it('resets the failure counter after a successful login', async () => {
    await register();
    for (let i = 0; i < 3; i += 1) await login({ email: USER.email, password: 'Wrong0Password' });
    expect((await login()).status).toBe(200);
    const row = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(row.failedLoginCount).toBe(0);
    expect(row.lastLoginAt).not.toBeNull();
  });

  it('returns 403 FORBIDDEN for inactive users', async () => {
    await register();
    await prisma.user.update({ where: { email: EMAIL }, data: { isActive: false } });
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/auth/csrf-token', () => {
  it('returns a token and sets the gh_csrf cookie', async () => {
    const res = await request(app).get(`${API}/csrf-token`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.csrfToken).toBe('string');
    expect(valueOf(cookiePair(res, 'gh_csrf'))).toBe(res.body.data.csrfToken);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and returns a new access token', async () => {
    const s = await loginSession();
    const res = await refreshReq(s.refresh, s.csrf);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(EMAIL);
    expectNoSecrets(res);

    const newRefresh = cookiePair(res, 'gh_refresh');
    expect(newRefresh).toBeDefined();
    expect(newRefresh).not.toBe(s.refresh);

    const rows = await prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0].revokedAt).not.toBeNull();
    expect(rows[0].replacedById).toBe(rows[1].id);
    expect(rows[1].revokedAt).toBeNull();

    // The new token works.
    const again = await refreshReq(newRefresh, cookiePair(res, 'gh_csrf'));
    expect(again.status).toBe(200);
  });

  it('revokes ALL tokens when an old refresh token is reused', async () => {
    const s = await loginSession();
    const first = await refreshReq(s.refresh, s.csrf);
    expect(first.status).toBe(200);
    const newRefresh = cookiePair(first, 'gh_refresh');
    const newCsrf = cookiePair(first, 'gh_csrf');

    // Attacker replays the old (rotated) token.
    const replay = await refreshReq(s.refresh, s.csrf);
    expect(replay.status).toBe(401);

    // The legitimate, newer token is now dead as well.
    const afterReplay = await refreshReq(newRefresh, newCsrf);
    expect(afterReplay.status).toBe(401);

    const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'TOKEN_REUSE_DETECTED' } })).toBe(1);
  });

  it('returns 403 when the X-CSRF-Token header is missing', async () => {
    const s = await loginSession();
    const res = await refreshReq(s.refresh, s.csrf, { sendHeader: false });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('returns 403 when the CSRF header does not match the cookie', async () => {
    const s = await loginSession();
    const res = await request(app)
      .post(`${API}/refresh`)
      .set('Cookie', [s.refresh, s.csrf].join('; '))
      .set('X-CSRF-Token', 'definitely-not-the-token');
    expect(res.status).toBe(403);
  });

  it('returns 401 UNAUTHORIZED when the refresh cookie is missing', async () => {
    const csrf = await request(app).get(`${API}/csrf-token`);
    const csrfPair = cookiePair(csrf, 'gh_csrf');
    const res = await refreshReq(undefined, csrfPair);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/logout', () => {
  it('invalidates the refresh token and clears cookies', async () => {
    const s = await loginSession();
    const res = await logoutReq(s.refresh, s.csrf);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(rawCookie(res, 'gh_refresh')).toMatch(/gh_refresh=;/);

    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'LOGOUT' } })).toBe(1);

    const after = await refreshReq(s.refresh, s.csrf);
    expect(after.status).toBe(401);
  });

  it('returns 401 when the refresh cookie is missing', async () => {
    const csrf = await request(app).get(`${API}/csrf-token`);
    const csrfPair = cookiePair(csrf, 'gh_csrf');
    const res = await request(app)
      .post(`${API}/logout`)
      .set('Cookie', csrfPair)
      .set('X-CSRF-Token', valueOf(csrfPair));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('changes the password, revokes all refresh tokens and creates a SECURITY notification', async () => {
    const s = await loginSession();
    // A second session.
    await login();
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(2);

    const res = await request(app)
      .post(`${API}/change-password`)
      .set('Authorization', `Bearer ${s.accessToken}`)
      .send({ currentPassword: USER.password, newPassword: 'NewPassw0rdY' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();

    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    expect((await refreshReq(s.refresh, s.csrf)).status).toBe(401);

    expect((await login()).status).toBe(401); // old password
    expect((await login({ email: USER.email, password: 'NewPassw0rdY' })).status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    const notes = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notes.some((n) => n.type === 'SECURITY')).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'PASSWORD_CHANGED' } })).toBe(1);
  });

  it('rejects a wrong current password (400) and a missing bearer token (401)', async () => {
    const s = await loginSession();
    const wrong = await request(app)
      .post(`${API}/change-password`)
      .set('Authorization', `Bearer ${s.accessToken}`)
      .send({ currentPassword: 'Wrong0Password', newPassword: 'NewPassw0rdY' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('VALIDATION_ERROR');

    const noAuth = await request(app)
      .post(`${API}/change-password`)
      .send({ currentPassword: USER.password, newPassword: 'NewPassw0rdY' });
    expect(noAuth.status).toBe(401);
  });

  it('rejects a weak new password (400)', async () => {
    const s = await loginSession();
    const res = await request(app)
      .post(`${API}/change-password`)
      .set('Authorization', `Bearer ${s.accessToken}`)
      .send({ currentPassword: USER.password, newPassword: 'weak' });
    expect(res.status).toBe(400);
  });
});