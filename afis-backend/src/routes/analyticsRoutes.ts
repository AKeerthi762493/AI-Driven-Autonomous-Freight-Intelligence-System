import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';
import { requireOperator } from '../middleware/roleCheck';
const router = Router();
router.get('/dashboard',authenticate,requireOperator,getDashboardAnalytics);
export default router;
