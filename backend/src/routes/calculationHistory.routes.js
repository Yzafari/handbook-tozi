import express from 'express';
import {
  create,
  getAll,
  syncHistory,
} from '../controllers/calculationHistory.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/sync', authenticate, syncHistory);
router.post('/', authenticate, create);
router.get('/', authenticate, getAll);

export default router;
