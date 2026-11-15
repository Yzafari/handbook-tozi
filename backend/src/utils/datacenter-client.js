import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { AppError } from './response.util.js';

const baseUrl = () => (process.env.DATACENTER_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const token = () => process.env.DATACENTER_INTERNAL_TOKEN || '';

async function storageFetch(url, options) {
  try { return await fetch(url, options); }
  catch { throw new AppError(503, 'STORAGE_UNAVAILABLE', 'ارتباط با دیتاسنتر برقرار نشد'); }
}

function requireConfig() {
  if (!baseUrl()) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'سرویس ذخیره‌سازی اسناد تنظیم نشده است');
  if (process.env.NODE_ENV === 'production' && token().length < 32) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'توکن ارتباط با دیتاسنتر تنظیم نشده است');
}

export async function putDocumentFile(storageKey, localPath, mimeType, checksumSha256) {
  requireConfig();
  if (!/^[a-f0-9]{64}$/i.test(String(checksumSha256 || ''))) throw new AppError(400, 'INVALID_FILE_CHECKSUM', 'SHA-256 فایل برای ذخیره‌سازی معتبر نیست');
  const response = await storageFetch(`${baseUrl()}/internal/files/${encodeURIComponent(storageKey)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token()}`, 'content-type': mimeType, 'x-content-sha256': checksumSha256 },
    body: Readable.toWeb(createReadStream(localPath)),
    duplex: 'half',
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new AppError(response.status === 413 ? 413 : 502, 'STORAGE_UPLOAD_FAILED', 'ذخیره فایل در دیتاسنتر ناموفق بود');
  return response.json();
}

export async function getDocumentFile(storageKey, range) {
  requireConfig();
  const response = await storageFetch(`${baseUrl()}/internal/files/${encodeURIComponent(storageKey)}`, {
    headers: { authorization: `Bearer ${token()}`, ...(range ? { range } : {}) },
    signal: AbortSignal.timeout(120_000),
  });
  if (response.status === 404) throw new AppError(404, 'NOT_FOUND', 'فایل سند یافت نشد');
  if (![200, 206].includes(response.status)) throw new AppError(502, 'STORAGE_READ_FAILED', 'دریافت فایل از دیتاسنتر ناموفق بود');
  return response;
}

export async function headDocumentFile(storageKey) {
  requireConfig();
  const response = await storageFetch(`${baseUrl()}/internal/files/${encodeURIComponent(storageKey)}`, {
    method: 'HEAD', headers: { authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) throw new AppError(404, 'STORAGE_FILE_MISSING', 'فایل اصلی سند در دیتاسنتر پیدا نشد');
  if (response.status !== 200) throw new AppError(502, 'STORAGE_READ_FAILED', 'بررسی فایل در دیتاسنتر ناموفق بود');
  return { sizeBytes: Number(response.headers.get('content-length') || 0) };
}

export async function deleteDocumentFile(storageKey) {
  requireConfig();
  const response = await storageFetch(`${baseUrl()}/internal/files/${encodeURIComponent(storageKey)}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new AppError(502, 'STORAGE_DELETE_FAILED', 'حذف فایل از دیتاسنتر ناموفق بود');
  return true;
}
