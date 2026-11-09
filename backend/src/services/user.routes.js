import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { updateProfileSchema, paginationQuerySchema } from '../validators/user.validator.js';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';
import crypto from 'crypto';

const router = Router();

// تنظیمات آپلود فایل (Multer)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, env.UPLOAD_DIR || 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // حداکثر ۲ مگابایت
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('فقط تصاویر jpg, png, webp مجاز هستند'));
  }
});

// همه روت‌های این فایل نیاز به احراز هویت دارند
router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', validate({ body: updateProfileSchema }), userController.updateMe);
router.post('/me/avatar', upload.single('avatar'), userController.uploadAvatar);
router.get('/me/dashboard', userController.getDashboard);

router.get('/me/payments', validate({ query: paginationQuerySchema }), userController.getPayments);
router.get('/me/notifications', validate({ query: paginationQuerySchema }), userController.getNotifications);
router.patch('/me/notifications/:id/read', userController.readNotification);

export default router;