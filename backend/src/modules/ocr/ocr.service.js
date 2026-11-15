import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import prisma from '../../config/database.js';
import { AppError } from '../../utils/response.util.js';
import { putDocumentFile, deleteDocumentFile } from '../../utils/datacenter-client.js';

const MAX_BYTES = Number(process.env.OCR_MAX_FILE_BYTES || 15 * 1024 * 1024);
const ALLOWED = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['application/pdf', 'pdf']]);

async function digest(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifySignature(file, ext) {
  const handle = await fs.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    const valid = ext === 'pdf' ? head.subarray(0, 5).toString() === '%PDF-'
      : ext === 'png' ? head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ext === 'jpg' ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
      : head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP';
    if (!valid) throw new AppError(415, 'INVALID_FILE_CONTENT', 'محتوای فایل با نوع اعلام‌شده مطابقت ندارد');
  } finally { await handle.close(); }
}

export async function createOcrJob(file, user) {
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'تصویر یا PDF ارسال نشده است');
  if (file.size < 1 || file.size > MAX_BYTES) throw new AppError(413, 'FILE_TOO_LARGE', 'حجم فایل باید کمتر از ۱۵ مگابایت باشد');
  const ext = ALLOWED.get(file.mimetype);
  if (!ext) throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'فقط PDF، JPEG، PNG و WebP پشتیبانی می‌شوند');
  await verifySignature(file, ext);
  const pendingCount = await prisma.ocrJob.count({ where: { userId: user.id, status: { in: ['PENDING', 'RUNNING', 'RETRY'] } } });
  if (pendingCount >= 5) throw new AppError(429, 'OCR_QUEUE_LIMIT', 'حداکثر ۵ درخواست تشخیص متن می‌تواند هم‌زمان در صف باشد');
  const checksumSha256 = await digest(file.path);
  const storageKey = randomUUID().replaceAll('-', '');
  let uploaded = false;
  try {
    await putDocumentFile(storageKey, file.path, file.mimetype, checksumSha256);
    uploaded = true;
    return await prisma.ocrJob.create({ data: {
      userId: user.id, storageKey, mimeType: file.mimetype, sizeBytes: file.size,
      checksumSha256, status: 'PENDING',
    }, select: { id: true, status: true, createdAt: true } });
  } catch (error) {
    if (uploaded) await deleteDocumentFile(storageKey).catch(() => {});
    throw error;
  }
}

export async function getOcrJob(jobId, userId) {
  const job = await prisma.ocrJob.findFirst({ where: { id: jobId, userId }, select: {
    id: true, status: true, resultText: true, confidence: true, errorMessage: true, createdAt: true, updatedAt: true,
  } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'درخواست OCR یافت نشد');
  return job;
}

export async function deleteOcrJob(jobId, userId) {
  const job = await prisma.ocrJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'درخواست OCR یافت نشد');
  await prisma.ocrJob.update({ where: { id: jobId }, data: { status: 'CANCELLED', lockedAt: null } });
  try {
    await deleteDocumentFile(job.storageKey);
    await prisma.ocrJob.update({ where: { id: jobId }, data: { storageDeleted: true } });
  } catch { /* The worker retries cleanup for cancelled jobs. */ }
  return { id: jobId, cancelled: true };
}


export async function retryOcrJob(jobId, userId) {
  const job = await prisma.ocrJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new AppError(404, 'NOT_FOUND', 'درخواست OCR یافت نشد');
  if (!['FAILED', 'RETRY'].includes(job.status)) throw new AppError(409, 'INVALID_JOB_STATE', 'فقط درخواست ناموفق قابل تلاش مجدد است');
  await prisma.ocrJob.update({ where: { id: jobId }, data: { status: 'PENDING', attempts: 0, availableAt: new Date(), lockedAt: null, errorMessage: null } });
  return { id: jobId, status: 'PENDING' };
}
