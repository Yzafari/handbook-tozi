import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { promises as fs } from 'node:fs';
import asyncHandler from '../../utils/asyncHandler.util.js';
import { ok, created, AppError } from '../../utils/response.util.js';
import * as service from './documents.service.js';

export const upload = asyncHandler(async (req, res) => {
  try {
    const document = await service.createDocument({ file: req.file, metadata: req.body || {}, user: req.user });
    return created(res, document, 'سند ثبت شد و در صف ایندکس قرار گرفت');
  } finally {
    if (req.file?.path) await fs.rm(req.file.path, { force: true }).catch(() => {});
  }
});

export const list = asyncHandler(async (req, res) => {
  const result = await service.listDocuments({ cursor: req.query.cursor, limit: Number(req.query.limit || 20), user: req.user });
  return ok(res, result.items, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
});

export const adminMetrics = asyncHandler(async (_req, res) => {
  return ok(res, await service.getAdminMetrics());
});

export const adminList = asyncHandler(async (req, res) => {
  const result = await service.listAdminDocuments({ ...req.query, limit: Number(req.query.limit || 20), user: req.user });
  return ok(res, result.items, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
});

export const detail = asyncHandler(async (req, res) => ok(res, (await service.getDocument(req.params.id, req.user)).document));

export const content = asyncHandler(async (req, res) => {
  const { document, response } = await service.openDocumentContent(req.params.id, req.user, req.headers.range);
  res.status(response.status);
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.originalName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`);
  res.setHeader('Accept-Ranges', response.headers.get('accept-ranges') || 'bytes');
  for (const header of ['content-length', 'content-range']) {
    const value = response.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  if (!response.body) return res.end();
  return pipeline(Readable.fromWeb(response.body), res);
});

export const remove = asyncHandler(async (req, res) => ok(res, await service.deleteDocument(req.params.id), 'سند حذف شد'));

export const restore = asyncHandler(async (req, res) => ok(res, await service.restoreDocument(req.params.id), 'سند بازیابی شد و در صف ایندکس قرار گرفت'));
export const indexStatus = asyncHandler(async (req, res) => ok(res, await service.getIndexStatus(req.params.id)));
export const reindex = asyncHandler(async (req, res) => ok(res, await service.reindexDocument(req.params.id), 'سند برای ایندکس مجدد در صف قرار گرفت'));

export const createOpenLink = asyncHandler(async (req, res) => {
  const { document, storageKey } = await service.getDocument(req.params.id, req.user);
  if (env.DATACENTER_PUBLIC_URL) {
    const payload = Buffer.from(JSON.stringify({
      key: storageKey, scope: 'document:read', mimeType: document.mimeType,
      exp: Math.floor(Date.now() / 1000) + 120,
    })).toString('base64url');
    const signature = createHmac('sha256', env.DATACENTER_SIGNING_SECRET).update(payload).digest('base64url');
    const token = `${payload}.${signature}`;
    const base = env.DATACENTER_PUBLIC_URL.replace(/\/$/, '');
    const url = `${base}/public/files/${encodeURIComponent(storageKey)}?token=${encodeURIComponent(token)}`;
    return ok(res, { url, expiresInSeconds: 120, delivery: 'direct-storage' });
  }
  const token = jwt.sign({
    sub: req.user?.id ?? 'guest', role: req.user?.role ?? 'GUEST', jobRole: req.user?.jobRole ?? null,
    purpose: 'document-content', docId: document.id,
  }, env.JWT_ACCESS_SECRET, { expiresIn: '60s', audience: 'document-content' });
  const url = `${req.protocol}://${req.get('host')}/api/v1/documents/${encodeURIComponent(document.id)}/content?downloadToken=${encodeURIComponent(token)}`;
  return ok(res, { url, expiresInSeconds: 60, delivery: 'api-proxy' });
});

export function contentTokenAuth(req, res, next) {
  if (req.user?.id) return next();
  const token = req.query.downloadToken;
  if (typeof token !== 'string' || !token) return next(new AppError(401, 'UNAUTHORIZED', 'دسترسی به سند نیازمند ورود است'));
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { audience: 'document-content' });
    if (payload.purpose !== 'document-content' || payload.docId !== req.params.id) throw new Error('invalid content token');
    req.user = payload.sub === 'guest' ? null : { id: payload.sub, role: payload.role, jobRole: payload.jobRole ?? null };
    return next();
  } catch {
    return next(new AppError(401, 'INVALID_DOWNLOAD_TOKEN', 'پیوند دریافت سند منقضی یا نامعتبر است'));
  }
}
