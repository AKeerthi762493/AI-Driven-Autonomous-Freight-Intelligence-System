import { Router } from 'express';
import { body } from 'express-validator';
import { optimizeRoute, getAllRoutes } from '../controllers/routeController';
import { authenticate } from '../middleware/auth';
import { requireOperator, requireAny } from '../middleware/roleCheck';

const router = Router();

// GET — any authenticated user can fetch routes (for AI suggestions in booking)
router.get('/', authenticate, requireAny, getAllRoutes);

// POST optimize — any authenticated user can get a route suggestion
// (operators can save/apply it, industry users see it as a suggestion only)
router.post(
  '/optimize',
  authenticate,
  requireAny,           // ← was requireOperator, now allows industry users too
  [
    body('source').notEmpty().withMessage('Source is required'),
    body('destination').notEmpty().withMessage('Destination is required'),
  ],
  optimizeRoute
);

export default router;