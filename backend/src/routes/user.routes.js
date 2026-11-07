import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middlewares/auth.middleware.js';
import { AppError } from '../utils/response.util.js';
import * as userController from '../controllers/user.controller.js';

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME.get(file.mimetype) || '.bin';
    const userId = req.user?.id ?? 'anon';
    cb(null, `avatar-${userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new AppError(400, 'VALIDATION_ERROR', 'فرمت فایل پشتیبانی نمی‌شود'));
    }
    cb(null, true);
  },
});

function uploadAvatar(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'حجم فایل بیش از حد مجاز است'
        : 'خطا در آپلود فایل';
      return next(new AppError(400, 'VALIDATION_ERROR', message));
    }
    return next(err);
  });
}

router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.post('/me/avatar', uploadAvatar, userController.uploadAvatar);
router.get('/me/dashboard', userController.getDashboard);
router.get('/me/payments', userController.getPayments);
router.get('/me/notifications', userController.getNotifications);
router.patch('/me/notifications/:id/read', userController.readNotification);

export default router;
