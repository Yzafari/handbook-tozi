import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validation.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { csrfProtect } from '../middlewares/security.middleware.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// GET /api/auth/csrf-token
router.get('/csrf-token', authLimiter, authController.csrfToken);

// POST /api/auth/refresh  (cookie gh_refresh + X-CSRF-Token)
router.post('/refresh', authLimiter, csrfProtect, authController.refresh);

// POST /api/auth/logout  (cookie gh_refresh + X-CSRF-Token)
router.post('/logout', authLimiter, csrfProtect, authController.logout);

// POST /api/auth/change-password  (Bearer)
router.post(
  '/change-password',
  authLimiter,
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;