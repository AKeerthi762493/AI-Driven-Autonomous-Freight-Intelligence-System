import { Response } from 'express';

export const sendSuccess = (res: Response, data: unknown, message = 'Success', statusCode = 200): Response =>
  res.status(statusCode).json({ success: true, message, data, timestamp: new Date().toISOString() });

export const sendError = (res: Response, message = 'Internal Server Error', statusCode = 500, errors?: unknown): Response =>
  res.status(statusCode).json({ success: false, message, errors, timestamp: new Date().toISOString() });
