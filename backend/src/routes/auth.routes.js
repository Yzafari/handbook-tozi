import express from 'express';
import { registerHandler, loginHandler, refreshHandler, logoutHandler, changePasswordHandler } from '../controllers/auth.controller';
import { authLimiter, csrfProtect, authenticate } from '../middlewares';
import { issueCsrfToken } from '../middlewares/security.middleware';

const router = express.Router();

router.post('/register', authLimiter, registerHandler);
router.post('/login', authLimiter, loginHandler);
router.post('/csrf-token', issueCsrfToken);
router.post('/refresh', authLimiter, csrfProtect, refreshHandler);
router.post('/logout', authLimiter, csrfProtect, logoutHandler);
router.post('/change-password', authLimiter, authenticate, changePasswordHandler);

export default router;
