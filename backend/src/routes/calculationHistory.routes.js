import express from 'express';
import { create, getAll } from '../controllers/calculationHistory.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', protect, create);
router.get('/', protect, getAll);

export default router;
