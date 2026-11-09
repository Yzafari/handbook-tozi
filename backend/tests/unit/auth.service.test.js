import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const prismaMock = {
  user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const hashUtilMock = {
  hashPassword: jest.fn(async () => 'dummy-hash'),
  comparePassword: jest.fn(),
  encrypt: jest.fn((v) => `enc(${v})`),
  decrypt: jest.fn((v) => String(v).replace(/^enc\(|\)$/g, '')),
  randomToken: jest.fn(() => 'random'),
};
const jwtUtilMock = {
  signAccessToken: jest.fn(() => 'access-token'),
  generateRefreshToken: jest.fn(() => ({
    token: 'raw-refresh',
    tokenHash: 'hashed-refresh',
    expiresAt: new Date(Date.now() + 7 * 86400000),
  })),
  hashToken: jest.fn((t) => `hash:${t}`),
  verifyAccessToken: jest.fn(),
};
const logEvent = jest.fn(async () => {});
const createNotification = jest.fn(async () => {});
const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../src/config/database.js', () => ({ default: prismaMock }));
jest.unstable_mockModule('../../src/utils/hash.util.js', () => hashUtilMock);
jest.unstable_mockModule('../../src/utils/jwt.util.js', () => jwtUtilMock);
jest.unstable_mockModule('../../src/utils/logger.util.js', () => ({ default: loggerMock }));
jest.unstable_mockModule('../../src/services/audit.service.js', () => ({ logEvent }));
jest.unstable_mockModule('../../src/services/notification.service.js', () => ({ createNotification }));

const { login, toPublicUser } = await import('../../src/services/auth.service.js');
const { AppError } = await import('../../src/utils/response.util.js');

const baseUser = (overrides = {}) => ({
  id: 'u1',
  email: 'a@b.com',
  passwordHash: 'real-hash',
  fullName: 'Ali',
  phoneEncrypted: null,
  avatarUrl: null,
  role: 'USER',
  isActive: true,
  emailVerified: false,
  failedLoginCount: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-02T00:00:00Z'),
  ...overrides,
});

const req = { ip: '127.0.0.1', get: () => 'jest-agent', headers: {} };
const creds = { email: 'a@b.com', password: 'Passw0rdX' };

async function rejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('Expected promise to reject');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toPublicUser', () => {
  it('returns exactly the public shape and strips every sensitive field', () => {
    const out = toPublicUser(
      baseUser({ phoneEncrypted: 'enc(09123456789)', lastLoginAt: new Date('2025-02-01T00:00:00Z') }),
    );
    expect(Object.keys(out).sort()).toEqual(
      ['avatarUrl', 'createdAt', 'email', 'fullName', 'id', 'isActive', 'lastLoginAt', 'phone', 'role'].sort(),
    );
    expect(out.phone).toBe('09123456789');
    const json = JSON.stringify(out);
    for (const k of ['passwordHash', 'phoneEncrypted', 'failedLoginCount', 'lockedUntil', 'emailVerified', 'updatedAt']) {
      expect(json).not.toContain(k);
    }
  });

  it('returns null phone/avatarUrl/lastLoginAt when absent', () => {
    const out = toPublicUser(baseUser({ avatarUrl: undefined, lastLoginAt: undefined }));
    expect(out.phone).toBeNull();
    expect(out.avatarUrl).toBeNull();
    expect(out.lastLoginAt).toBeNull();
  });

  it('returns null phone (and does not throw) when decryption fails', () => {
    hashUtilMock.decrypt.mockImplementationOnce(() => {
      throw new Error('bad payload');
    });
    expect(toPublicUser(baseUser({ phoneEncrypted: 'garbage' })).phone).toBeNull();
  });
});

describe('login lockout logic', () => {
  it('unknown email: performs a dummy bcrypt compare and returns generic 401', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    hashUtilMock.comparePassword.mockResolvedValue(false);

    const err = await rejection(login(creds, req));
    expect(err).toBeInstanceOf(AppError);
    expect(err.status ?? err.statusCode).toBe(401);
    expect(hashUtilMock.comparePassword).toHaveBeenCalledTimes(1);
    expect(hashUtilMock.comparePassword.mock.calls[0][1]).toBe('dummy-hash');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
  });

  it('wrong password below the threshold: increments counter, returns 401, no lock', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ failedLoginCount: 1 }));
    hashUtilMock.comparePassword.mockResolvedValue(false);
    prismaMock.user.update.mockResolvedValueOnce({ failedLoginCount: 2 });

    const err = await rejection(login(creds, req));
    expect(err.status ?? err.statusCode).toBe(401);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ failedLoginCount: { increment: 1 } });
  });

  it('5th consecutive failure sets lockedUntil ≈ now+15min and throws 423 ACCOUNT_LOCKED', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ failedLoginCount: 4 }));
    hashUtilMock.comparePassword.mockResolvedValue(false);
    prismaMock.user.update.mockResolvedValueOnce({ failedLoginCount: 5 }).mockResolvedValueOnce({});

    const before = Date.now();
    const err = await rejection(login(creds, req));
    expect(err.status ?? err.statusCode).toBe(423);
    expect(err.code).toBe('ACCOUNT_LOCKED');

    const lockCall = prismaMock.user.update.mock.calls[1][0];
    const lockedUntil = lockCall.data.lockedUntil.getTime();
    expect(lockedUntil).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 1000);
    expect(lockedUntil).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000 + 1000);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_LOCKED' }));
  });

  it('currently locked account: 423 without comparing the password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ failedLoginCount: 5, lockedUntil: new Date(Date.now() + 5 * 60 * 1000) }),
    );

    const err = await rejection(login(creds, req));
    expect(err.status ?? err.statusCode).toBe(423);
    expect(err.code).toBe('ACCOUNT_LOCKED');
    expect(hashUtilMock.comparePassword).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_LOCKED' }));
  });

  it('expired lock: counter is reset before counting the new failure', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ failedLoginCount: 5, lockedUntil: new Date(Date.now() - 1000) }),
    );
    hashUtilMock.comparePassword.mockResolvedValue(false);
    prismaMock.user.update.mockResolvedValueOnce({}).mockResolvedValueOnce({ failedLoginCount: 1 });

    const err = await rejection(login(creds, req));
    expect(err.status ?? err.statusCode).toBe(401);
    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });

  it('successful login resets the counter and returns tokens + public user', async () => {
    const user = baseUser({ failedLoginCount: 3 });
    prismaMock.user.findUnique.mockResolvedValue(user);
    hashUtilMock.comparePassword.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValueOnce({ ...user, failedLoginCount: 0, lastLoginAt: new Date() });
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt1' });

    const out = await login(creds, req);
    expect(prismaMock.user.update.mock.calls[0][0].data).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
    expect(out.accessToken).toBe('access-token');
    expect(out.refreshToken).toBe('raw-refresh');
    expect(out.refreshExpiresAt).toBeInstanceOf(Date);
    expect(JSON.stringify(out.user)).not.toContain('passwordHash');
    expect(prismaMock.refreshToken.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      tokenHash: 'hashed-refresh',
      ip: '127.0.0.1',
      userAgent: 'jest-agent',
    });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_SUCCESS' }));
  });

  it('inactive user with correct password: 403 FORBIDDEN and no session issued', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ isActive: false }));
    hashUtilMock.comparePassword.mockResolvedValue(true);

    const err = await rejection(login(creds, req));
    expect(err.status ?? err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled();
  });
});