import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authLimiter, sessionLimiter } from '../../middlewares/rateLimit.middleware.js';
import { registerSchema, loginSchema, changePasswordSchema, refreshTokenSchema } from '../../validators/auth.validator.js';
import * as controller from '../../controllers/v1/auth.controller.js';

const router = Router();
router.post('/register', authLimiter, validate(registerSchema), controller.registerMobile);
router.post('/login', authLimiter, validate(loginSchema), controller.loginMobile);
// Token rotation is not a credential attempt: the mobile client refreshes on
// every launch and after each 401, so it gets its own, larger budget.
router.post('/refresh', sessionLimiter, validate({ body: refreshTokenSchema }), controller.refreshMobile);
router.post('/logout', sessionLimiter, validate({ body: refreshTokenSchema }), controller.logoutMobile);
router.post('/change-password', authLimiter, authenticate, validate(changePasswordSchema), controller.changePasswordMobile);
export default router;
