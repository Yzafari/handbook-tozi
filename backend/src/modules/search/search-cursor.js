import { AppError } from '../../utils/response.util.js';

export function encodeCursor(sort) {
  return sort ? Buffer.from(JSON.stringify(sort)).toString('base64url') : null;
}

export function decodeCursor(cursor) {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(value) || value.length !== 5) throw new Error('invalid');
    if (typeof value[0] !== 'number' || !Number.isFinite(value[0])) throw new Error('invalid');
    if (!((typeof value[1] === 'string' && !Number.isNaN(Date.parse(value[1]))) || (typeof value[1] === 'number' && Number.isFinite(value[1])))) throw new Error('invalid');
    if (typeof value[2] !== 'string' || value[2].length < 1 || value[2].length > 128) throw new Error('invalid');
    if (!(value[3] === null || (typeof value[3] === 'number' && Number.isInteger(value[3]) && value[3] >= 0))) throw new Error('invalid');
    if (typeof value[4] !== 'number' || !Number.isInteger(value[4]) || value[4] < 0) throw new Error('invalid');
    return value;
  } catch { throw new AppError(400, 'INVALID_CURSOR', 'نشانگر صفحه‌بندی جستجو معتبر نیست'); }
}
