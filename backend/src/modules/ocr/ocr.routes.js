import { Router } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { ocrLimiter } from '../../middlewares/rateLimit.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { AppError } from '../../utils/response.util.js';
import * as controller from './ocr.controller.js';

const router = Router();
const MAX_BYTES = Number(process.env.OCR_MAX_FILE_BYTES || 15 * 1024 * 1024);
const uploadDir = path.join(os.tmpdir(), 'handbook-ocr-ingest');
await fs.mkdir(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: MAX_BYTES, files: 1 }, fileFilter(req, file, callback) {
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'نوع فایل برای OCR پشتیبانی نمی‌شود'));
  callback(null, true);
} });
const idParams = z.object({ id: z.string().trim().min(1).max(128) });

router.use(authenticate);
router.post('/', ocrLimiter, (req, res, next) => upload.single('file')(req, res, error => {
  if (!error) return next();
  if (error instanceof multer.MulterError) return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'UPLOAD_ERROR', 'بارگذاری تصویر ناموفق بود'));
  return next(error);
}), controller.create);
router.get('/:id', validate({ params: idParams }), controller.get);
router.post('/:id/retry', validate({ params: idParams }), controller.retry);
router.delete('/:id', validate({ params: idParams }), controller.cancel);
export default router;
