import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const IV_LENGTH = 12;

function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY must be configured as 64 hexadecimal characters');
  }
  return Buffer.from(raw, 'hex');
}

export function hashPassword(password) { return bcrypt.hash(password, SALT_ROUNDS); }
export async function comparePassword(password, hash) { return bcrypt.compare(password, hash); }

export function encrypt(text) {
  if (text === null || text === undefined || text === '') return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decrypt(value) {
  if (!value) return null;
  const [ivHex, encryptedHex, tagHex] = String(value).split(':');
  if (!ivHex || !encryptedHex || !tagHex) throw new Error('Encrypted value has an invalid format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}
