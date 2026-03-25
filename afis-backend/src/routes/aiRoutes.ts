import { Router } from 'express';
import { body } from 'express-validator';
import { getAIRecommendations, executeAIAction } from '../controllers/aiController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/recommendations',authenticate,getAIRecommendations);
router.post('/execute-action',authenticate,requireOperator,[body('action').notEmpty()],executeAIAction);
export default router;
