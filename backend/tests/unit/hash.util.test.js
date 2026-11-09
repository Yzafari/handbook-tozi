import {
  hashPassword,
  comparePassword,
  encrypt,
  decrypt,
  randomToken,
} from '../../src/utils/hash.util.js';

describe('password hashing', () => {
  test('hashes and verifies a password', async () => {
    const hash = await hashPassword('Str0ngPass');
    expect(hash).not.toBe('Str0ngPass');
    expect(hash.startsWith('$2')).toBe(true);
    await expect(comparePassword('Str0ngPass', hash)).resolves.toBe(true);
  });

  test('rejects a wrong password', async () => {
    const hash = await hashPassword('Str0ngPass');
    await expect(comparePassword('WrongPass1', hash)).resolves.toBe(false);
  });

  test('same password produces different hashes (salted)', async () => {
    const [a, b] = await Promise.all([hashPassword('Str0ngPass'), hashPassword('Str0ngPass')]);
    expect(a).not.toBe(b);
  });

  test('comparePassword returns false for invalid inputs', async () => {
    await expect(comparePassword(undefined, undefined)).resolves.toBe(false);
  });
});

describe('AES-256-GCM encrypt/decrypt', () => {
  test('round-trips plain and unicode text', () => {
    for (const text of ['09123456789', 'شماره تماس ۰۹۱۲۳۴۵۶۷۸۹', '']) {
      expect(decrypt(encrypt(text))).toBe(text);
    }
  });

  test('payload has iv:tag:cipher format', () => {
    const parts = encrypt('hello').split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12-byte iv in hex
    expect(parts[1]).toHaveLength(32); // 16-byte tag in hex
  });

  test('same plaintext encrypts differently each time', () => {
    expect(encrypt('hello')).not.toBe(encrypt('hello'));
  });

  test('tampered ciphertext is rejected', () => {
    const [iv, tag, data] = encrypt('sensitive').split(':');
    const flipped = (data[0] === 'a' ? 'b' : 'a') + data.slice(1);
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  test('malformed payload is rejected', () => {
    expect(() => decrypt('not-a-valid-payload')).toThrow();
  });
});

describe('randomToken', () => {
  test('returns hex of requested size and is unique', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(randomToken(16)).toHaveLength(32);
  });
});