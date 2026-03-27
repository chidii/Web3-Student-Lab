import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Request Logger Middleware
 * Logs HTTP method, URL, and timestamp for each incoming request
 */
<<<<<<< HEAD
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  console.log(`[${timestamp}] ${method} ${url}`);
=======
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const method = req.method;
  const url = req.originalUrl || req.url;

  logger.info(`${method} ${url}`);
>>>>>>> main

  next();
};
