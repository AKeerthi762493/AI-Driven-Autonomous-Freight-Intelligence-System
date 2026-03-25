import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import logger from '../utils/logger';
interface AppError extends Error { statusCode?: number; code?: number; path?: string; value?: string; keyValue?: Record<string, string>; errors?: Record<string, { message: string }>; }
export const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error(err.message, { stack: err.stack });
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  if (err.code === 11000 && err.keyValue) { statusCode = 400; message = `${Object.keys(err.keyValue)[0]} already exists.`; }
  if (err instanceof MongooseError.ValidationError) { statusCode = 400; message = Object.values(err.errors).map((e) => e.message).join(', '); }
  if (err instanceof MongooseError.CastError) { statusCode = 400; message = `Invalid ${err.path}: ${err.value}`; }
  res.status(statusCode).json({ success: false, message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }), timestamp: new Date().toISOString() });
};
export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Route not found', timestamp: new Date().toISOString() });
};
