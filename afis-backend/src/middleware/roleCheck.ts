import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';
export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) { sendError(res, 'Authentication required.', 401); return; }
  if (!roles.includes(req.user.role)) { sendError(res, `Access denied. Required: ${roles.join(' or ')}`, 403); return; }
  next();
};
export const requireOperator = requireRole('operator');
export const requireIndustry = requireRole('industry');
export const requireAny = requireRole('industry', 'operator');
