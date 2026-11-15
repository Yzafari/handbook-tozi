import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import prisma from '../../config/database.js';
import { AppError } from '../../utils/response.util.js';
import { putDocumentFile, getDocumentFile, headDocumentFile, deleteDocumentFile } from '../../utils/datacenter-client.js';
import { removeIndexedDocument } from '../search/public-api.js';
import { normalizePersian } from '../../utils/persian-text.js';
import { canAccessDocument } from './access.js';
import { JOB_ROLE_VALUES } from '../../config/job-roles.js';

const MAX_FILE_BYTES = Number(process.env.DOCUMENT_MAX_FILE_BYTES || 100 * 1024 * 1024);
const PUBLIC_FIELDS = { id: true, title: true, originalName: true, mimeType: true, sizeBytes: true, visibility: true, description: true, pageCount: true, language: true, indexStatus: true, indexedAt: true, createdAt: true, updatedAt: true };

function validateFile(file) {
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'فایل سند ارسال نشده است');
  if (!Number.isInteger(file.size) || file.size < 1) throw new AppError(400, 'EMPTY_FILE', 'فایل خالی قابل ثبت نیست');
  if (file.size > MAX_FILE_BYTES) throw new AppError(413, 'FILE_TOO_LARGE', 'حجم فایل از حد مجاز بیشتر است');
  const ext = file.originalname.toLowerCase().split('.').pop();
  const expectedMime = { pdf: ['application/pdf'], txt: ['text/plain'], md: ['text/markdown', 'text/plain'], png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], webp: ['image/webp'] };
  if (!expectedMime[ext]) throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'این نوع فایل پشتیبانی نمی‌شود');
  if (!expectedMime[ext].includes(file.mimetype)) throw new AppError(415, 'MIME_EXTENSION_MISMATCH', 'نوع محتوای فایل با پسوند آن مطابقت ندارد');
  return ext;
}

async function verifyMagicBytes(file, ext) {
  const handle = await fs.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    const valid = ext === 'pdf' ? head.toString('latin1').includes('%PDF-')
      : ext === 'png' ? head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ['jpg', 'jpeg'].includes(ext) ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
      : ext === 'webp' ? head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP'
      : true;
    if (!valid) throw new AppError(415, 'INVALID_FILE_CONTENT', 'محتوای فایل با پسوند آن مطابقت ندارد');
  } finally { await handle.close(); }
}

export async function createDocument({ file, metadata, user }) {
  const ext = validateFile(file);
  await verifyMagicBytes(file, ext);
  const checksumSha256 = await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file.path);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
  const duplicate = await prisma.document.findUnique({ where: { checksumSha256 } });
  if (duplicate) throw new AppError(409, 'DOCUMENT_ALREADY_EXISTS', 'این فایل قبلاً ثبت شده است؛ برای بازیابی سند غیرفعال باید از عملیات بازیابی استفاده شود');

  const originalName = String(file.originalname || 'document').replace(/\\/g, '/').split('/').pop().slice(0, 255);
  const title = normalizePersian(metadata.title || originalName).slice(0, 240);
  if (title.length < 2) throw new AppError(400, 'INVALID_TITLE', 'عنوان سند معتبر نیست');
  const visibility = metadata.visibility || 'PUBLIC';
  if (!['PUBLIC', 'ROLE_RESTRICTED', 'PRIVATE'].includes(visibility)) throw new AppError(400, 'INVALID_VISIBILITY', 'سطح دسترسی سند معتبر نیست');
  let suppliedRoles = metadata.accessJobRoles ?? [];
  if (typeof suppliedRoles === 'string') {
    try { suppliedRoles = JSON.parse(suppliedRoles); }
    catch { suppliedRoles = suppliedRoles.split(',').map(role => role.trim()).filter(Boolean); }
  }
  const roles = Array.isArray(suppliedRoles) ? [...new Set(suppliedRoles)] : [];
  const allowedRoles = new Set(JOB_ROLE_VALUES);
  if (roles.some(role => !allowedRoles.has(role))) throw new AppError(400, 'INVALID_ACCESS_JOB_ROLES', 'سمت شغلی انتخاب‌شده معتبر نیست');
  if (visibility === 'ROLE_RESTRICTED' && roles.length === 0) throw new AppError(400, 'ACCESS_JOB_ROLES_REQUIRED', 'برای سند محدود باید حداقل یک سمت شغلی انتخاب شود');

  const storageKey = randomUUID().replaceAll('-', '');
  const mimeByExt = { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  let uploaded = false;
  try {
    await putDocumentFile(storageKey, file.path, mimeByExt[ext], checksumSha256);
    uploaded = true;
    return await prisma.$transaction(async tx => {
      const document = await tx.document.create({
        data: {
          title,
          originalName,
          mimeType: mimeByExt[ext],
          sizeBytes: file.size,
          checksumSha256,
          storageKey,
          visibility,
          accessJobRoles: roles,
          ownerId: user.id,
          description: metadata.description ? normalizePersian(metadata.description).slice(0, 2000) : null,
          language: metadata.language === 'en' ? 'en' : metadata.language === 'ku' ? 'ku' : 'fa',
          indexStatus: 'PENDING',
        },
        select: PUBLIC_FIELDS,
      });
      await tx.documentIndexJob.create({ data: { documentId: document.id } });
      return document;
    });
  } catch (error) {
    if (uploaded) await deleteDocumentFile(storageKey).catch(() => {});
    throw error;
  }
}

export async function listDocuments({ cursor, limit = 20, user }) {
  const where = !user
    ? { isActive: true, visibility: 'PUBLIC' }
    : user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
      ? { isActive: true }
      : { isActive: true, OR: [
        { visibility: 'PUBLIC' },
        ...(user.jobRole ? [{ visibility: 'ROLE_RESTRICTED', accessJobRoles: { has: user.jobRole } }] : []),
        { visibility: 'PRIVATE', ownerId: user.id },
      ] };
  const items = await prisma.document.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
    select: PUBLIC_FIELDS,
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasMore ? page.at(-1).id : null, hasMore };
}

export async function getAdminMetrics() {
  const [total, active, deleted, pending, running, ready, failed, bytes, ocrPending, ocrFailed] = await Promise.all([
    prisma.document.count(),
    prisma.document.count({ where: { isActive: true } }),
    prisma.document.count({ where: { isActive: false } }),
    prisma.document.count({ where: { isActive: true, indexStatus: { in: ['PENDING', 'RETRY'] }, NOT: { indexJobs: { some: { status: 'RUNNING' } } } } }),
    prisma.document.count({ where: { isActive: true, indexJobs: { some: { status: 'RUNNING' } } } }),
    prisma.document.count({ where: { isActive: true, indexStatus: { in: ['READY', 'INDEXED'] } } }),
    prisma.document.count({ where: { isActive: true, indexStatus: 'FAILED' } }),
    prisma.document.aggregate({ where: { isActive: true }, _sum: { sizeBytes: true } }),
    prisma.ocrJob.count({ where: { status: { in: ['PENDING', 'RETRY', 'RUNNING'] } } }),
    prisma.ocrJob.count({ where: { status: 'FAILED' } }),
  ]);
  return { total, active, deleted, pending, running, ready, failed, registeredBytes: Number(bytes._sum.sizeBytes ?? 0), ocrPending, ocrFailed };
}

export async function listAdminDocuments({ cursor, limit = 20, q, status, includeDeleted = true }) {
  const where = {
    ...(includeDeleted ? {} : { isActive: true }),
    ...(status === 'DELETED' ? { isActive: false } : status === 'RUNNING' ? { isActive: true, indexJobs: { some: { status: 'RUNNING' } } } : status === 'READY' || status === 'INDEXED' ? { isActive: true, indexStatus: { in: ['READY', 'INDEXED'] } } : status === 'PENDING' ? { isActive: true, indexStatus: 'PENDING', NOT: { indexJobs: { some: { status: 'RUNNING' } } } } : status ? { isActive: true, indexStatus: status } : {}),
    ...(q ? { OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { originalName: { contains: q, mode: 'insensitive' } },
    ] } : {}),
  };
  const items = await prisma.document.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
    select: {
      ...PUBLIC_FIELDS, isActive: true, sourcePath: true, ownerId: true, accessJobRoles: true,
      indexJobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, attempts: true, lastError: true, availableAt: true, updatedAt: true } },
    },
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page.map(({ indexJobs, ...document }) => ({ ...document, latestJob: indexJobs[0] ?? null })), nextCursor: hasMore ? page.at(-1).id : null, hasMore };
}

export async function getDocument(documentId, user) {
  const document = await prisma.document.findFirst({ where: { id: documentId, isActive: true }, select: { ...PUBLIC_FIELDS, storageKey: true, ownerId: true, accessJobRoles: true, isActive: true } });
  if (!document || !canAccessDocument(document, user)) throw new AppError(404, 'NOT_FOUND', 'سند یافت نشد');
  const { storageKey, ownerId, accessJobRoles, isActive, ...publicDocument } = document;
  return { document: publicDocument, storageKey };
}

export async function openDocumentContent(documentId, user, range) {
  const { document, storageKey } = await getDocument(documentId, user);
  const response = await getDocumentFile(storageKey, range);
  return { document, response };
}

export async function deleteDocument(documentId) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new AppError(404, 'NOT_FOUND', 'سند یافت نشد');
  await prisma.document.update({ where: { id: documentId }, data: { isActive: false, indexStatus: 'DELETED' } });
  await removeIndexedDocument(documentId).catch(() => {});
  // Keep the original object in storage during the soft-delete retention window
  // so an administrator can restore it without re-uploading the source file.
  return { id: documentId, deleted: true };
}

export async function restoreDocument(documentId) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new AppError(404, 'NOT_FOUND', 'سند یافت نشد');
  if (document.isActive) return { id: documentId, restored: true, alreadyActive: true };
  await headDocumentFile(document.storageKey);
  await prisma.$transaction(async tx => {
    await tx.document.update({ where: { id: documentId }, data: { isActive: true, indexStatus: 'PENDING' } });
    const running = await tx.documentIndexJob.findFirst({ where: { documentId, status: 'RUNNING' } });
    if (!running) {
      const pending = await tx.documentIndexJob.findFirst({ where: { documentId, status: { in: ['PENDING', 'RETRY'] } }, orderBy: { createdAt: 'desc' } });
      if (pending) await tx.documentIndexJob.update({ where: { id: pending.id }, data: { status: 'PENDING', attempts: 0, availableAt: new Date(), lastError: null } });
      else await tx.documentIndexJob.create({ data: { documentId } });
    }
  });
  return { id: documentId, restored: true };
}

export async function reindexDocument(documentId) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || !document.isActive) throw new AppError(404, 'NOT_FOUND', 'سند فعال یافت نشد');
  const result = await prisma.$transaction(async tx => {
    const running = await tx.documentIndexJob.findFirst({ where: { documentId, status: 'RUNNING' } });
    if (running) return { alreadyRunning: true };
    const pending = await tx.documentIndexJob.findFirst({ where: { documentId, status: { in: ['PENDING', 'RETRY'] } }, orderBy: { createdAt: 'desc' } });
    if (pending) await tx.documentIndexJob.update({ where: { id: pending.id }, data: { status: 'PENDING', attempts: 0, availableAt: new Date(), lastError: null } });
    else await tx.documentIndexJob.create({ data: { documentId } });
    await tx.document.update({ where: { id: documentId }, data: { indexStatus: 'PENDING', indexedAt: null } });
    return { alreadyRunning: false };
  });
  return { id: documentId, queued: true, alreadyRunning: result.alreadyRunning };
}

export async function getIndexStatus(documentId) {
  const document = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, indexStatus: true, indexedAt: true, isActive: true } });
  if (!document) throw new AppError(404, 'NOT_FOUND', 'سند یافت نشد');
  const job = await prisma.documentIndexJob.findFirst({ where: { documentId }, orderBy: { createdAt: 'desc' }, select: { status: true, attempts: true, availableAt: true, lastError: true, updatedAt: true } });
  return { ...document, job };
}


export async function getSearchDocumentsByIds(ids, user) {
  if (!ids.length) return [];
  const where = !user
    ? { id: { in: ids }, isActive: true, visibility: 'PUBLIC' }
    : user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
      ? { id: { in: ids }, isActive: true }
      : { id: { in: ids }, isActive: true, OR: [
        { visibility: 'PUBLIC' },
        ...(user.jobRole ? [{ visibility: 'ROLE_RESTRICTED', accessJobRoles: { has: user.jobRole } }] : []),
        { visibility: 'PRIVATE', ownerId: user.id },
      ] };
  const docs = await prisma.document.findMany({ where, select: PUBLIC_FIELDS });
  const byId = new Map(docs.map(doc => [doc.id, doc]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}
