import { Router } from 'express';
import * as controller from './health.controller.js';

const router = Router();
router.get('/live', controller.live);
router.get('/ready', controller.ready);
export default router;
