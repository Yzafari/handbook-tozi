import express from 'express';
import { registerHandler, loginHandler, refreshHandler, logoutHandler, changePasswordHandler } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { csrfProtect } from '../middlewares/security.middleware.js';
import { issueCsrfToken } from '../middlewares/security.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/auth.validator.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), registerHandler);
router.post('/login', authLimiter, validate(loginSchema), loginHandler);
router.get('/csrf-token', issueCsrfToken);
router.post('/csrf-token', issueCsrfToken); // backward compatibility
router.post('/refresh', authLimiter, csrfProtect, refreshHandler);
router.post('/logout', authLimiter, csrfProtect, logoutHandler);
router.post('/change-password', authLimiter, authenticate, validate(changePasswordSchema), changePasswordHandler);

export default router;
