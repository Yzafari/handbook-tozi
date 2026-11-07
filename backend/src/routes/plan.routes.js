import express from 'express';
import * as planController from '../controllers/plan.controller.js';

const router = express.Router();

router.get('/', planController.getPlans);

export default router;
