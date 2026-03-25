import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
const router = Router();
router.post('/register',[body('name').trim().isLength({min:2}),body('email').isEmail().normalizeEmail(),body('password').isLength({min:6}),body('role').optional().isIn(['industry','operator'])],register);
router.post('/login',[body('email').isEmail().normalizeEmail(),body('password').notEmpty()],login);
router.get('/me',authenticate,getMe);
export default router;
