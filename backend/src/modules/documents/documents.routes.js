import { Router } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { AppError } from '../../utils/response.util.js';
import * as controller from './documents.controller.js';
import { z } from 'zod';

const router = Router();
const MAX_FILE_BYTES = Number(process.env.DOCUMENT_MAX_FILE_BYTES || 100 * 1024 * 1024);
const upload = multer({
  dest: path.join(os.tmpdir(), 'handbook-document-ingest'),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    const allowed = new Set(['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp']);
    if (!allowed.has(file.mimetype)) return callback(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'نوع فایل مجاز نیست'));
    callback(null, true);
  },
});
await fs.mkdir(path.join(os.tmpdir(), 'handbook-document-ingest'), { recursive: true });

const listQuery = z.object({ cursor: z.string().trim().min(1).max(128).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const idParams = z.object({ id: z.string().trim().min(1).max(128) });
const adminListQuery = z.object({ cursor: z.string().trim().min(1).max(128).optional(), limit: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(120).optional(), status: z.enum(['PENDING', 'RUNNING', 'READY', 'INDEXED', 'RETRY', 'FAILED', 'DELETED']).optional(), includeDeleted: z.enum(['true', 'false']).default('true').transform(value => value === 'true') });

router.use(optionalAuthenticate);
router.get('/', validate({ query: listQuery }), controller.list);
router.get('/admin/metrics', authorizeRoles('ADMIN', 'SUPER_ADMIN'), controller.adminMetrics);
router.get('/admin/list', authorizeRoles('ADMIN', 'SUPER_ADMIN'), validate({ query: adminListQuery }), controller.adminList);
router.post('/', authorizeRoles('ADMIN', 'SUPER_ADMIN'), (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'UPLOAD_ERROR', 'بارگذاری فایل ناموفق بود'));
    return next(error);
  });
}, controller.upload);
router.get('/:id', validate({ params: idParams }), controller.detail);
router.get('/:id/open-link', validate({ params: idParams }), controller.createOpenLink);
router.get('/:id/content', validate({ params: idParams }), controller.contentTokenAuth, controller.content);
router.post('/:id/reindex', authorizeRoles('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), controller.reindex);
router.get('/:id/index-status', authorizeRoles('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), controller.indexStatus);
router.post('/:id/restore', authorizeRoles('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), controller.restore);
router.delete('/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), controller.remove);

export default router;
