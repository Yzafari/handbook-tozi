import express from 'express';
import { registerHandler, loginHandler, refreshHandler, logoutHandler, changePasswordHandler } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { csrfProtect } from '../middlewares/security.middleware.js';
import { issueCsrfToken } from '../middlewares/security.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, registerHandler);
router.post('/login', authLimiter, loginHandler);
router.post('/csrf-token', issueCsrfToken);
router.post('/refresh', authLimiter, csrfProtect, refreshHandler);
router.post('/logout', authLimiter, csrfProtect, logoutHandler);
router.post('/change-password', authLimiter, authenticate, changePasswordHandler);

export default router;
