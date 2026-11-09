import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../src/utils/jwt.util.js';
import { AppError } from '../../src/utils/response.util.js';
import { env } from '../../src/config/env.js';

function catchError(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('Expected function to throw');
}

describe('access tokens', () => {
  test('sign and verify round-trip', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'ADMIN' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('ADMIN');
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  test('expired token -> 401 TOKEN_EXPIRED', () => {
    const token = jwt.sign({ sub: 'u', role: 'USER' }, env.JWT_ACCESS_SECRET, { expiresIn: -10 });
    const err = catchError(() => verifyAccessToken(token));
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('TOKEN_EXPIRED');
  });

  test('wrong signature -> 401 UNAUTHORIZED', () => {
    const token = jwt.sign({ sub: 'u', role: 'USER' }, 'another_secret_that_is_long_enough_123456');
    const err = catchError(() => verifyAccessToken(token));
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('garbage token -> 401 UNAUTHORIZED', () => {
    const err = catchError(() => verifyAccessToken('not.a.token'));
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('alg=none token is rejected', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u', role: 'SUPER_ADMIN' })}.`;
    const err = catchError(() => verifyAccessToken(token));
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });
});

describe('refresh tokens', () => {
  test('generateRefreshToken returns token, sha256 hash and 7-day expiry', () => {
    const { token, tokenHash, expiresAt } = generateRefreshToken();
    expect(token).toMatch(/^[0-9a-f]{128}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(token));
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });

  test('tokens are unique and hashToken is deterministic', () => {
    expect(generateRefreshToken().token).not.toBe(generateRefreshToken().token);
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});