import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { AUTH } from '../config/constants.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, AUTH.BCRYPT_ROUNDS);
}

export async function comparePassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string') return false;
  return bcrypt.compare(plain, hash);
}

function key() {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

// AES-256-GCM -> "iv:tag:cipher" (all hex)
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload) {
  const parts = String(payload ?? '').split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload');
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}