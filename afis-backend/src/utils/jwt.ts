import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';
export interface JwtPayload { id: string; email: string; role: string; }
export const generateToken = (user: IUser): string => {
  const payload: JwtPayload = { id: (user._id as string).toString(), email: user.email, role: user.role };
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });
};
export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
