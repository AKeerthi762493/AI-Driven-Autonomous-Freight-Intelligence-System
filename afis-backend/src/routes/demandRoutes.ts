import { Router } from 'express';
import { body } from 'express-validator';
import { getDemandPrediction, trainDemandModel } from '../controllers/demandController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/predict',authenticate,getDemandPrediction);
router.post('/train-model',authenticate,requireOperator,[body('station').notEmpty(),body('commodity').notEmpty()],trainDemandModel);
export default router;
