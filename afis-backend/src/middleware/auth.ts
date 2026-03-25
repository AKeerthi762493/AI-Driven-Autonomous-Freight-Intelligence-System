import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/apiResponse';
import User from '../models/User';
declare global { namespace Express { interface Request { user?: JwtPayload & { _id?: string }; } } }
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) { sendError(res, 'No token provided.', 401); return; }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) { sendError(res, 'User no longer exists.', 401); return; }
    req.user = { ...decoded, _id: decoded.id };
    next();
  } catch { sendError(res, 'Invalid or expired token.', 401); }
};
