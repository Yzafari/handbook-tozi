import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { AppError } from '../utils/response.util.js';
import { updateProfileSchema, paginationQuerySchema } from '../validators/user.validator.js';
import {
  me,
  updateMe,
  uploadAvatar,
  dashboard,
  myPayments,
  myNotifications,
  readNotification,
} from '../controllers/user.controller.js';

const router = Router();

const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomHex}${ext}`);
  },
});

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'VALIDATION_ERROR', 'فقط فرمت‌های PNG، JPG، JPEG و WEBP مجاز هستند'));
    }
  },
});

router.use(authenticate);

router.get('/me', me);
router.patch('/me', validate({ body: updateProfileSchema }), updateMe);
router.post('/me/avatar', upload.single('avatar'), uploadAvatar);
router.get('/me/dashboard', dashboard);
router.get('/me/payments', validate({ query: paginationQuerySchema }), myPayments);
router.get('/me/notifications', validate({ query: paginationQuerySchema }), myNotifications);
router.patch('/me/notifications/:id/read', readNotification);

export default router;