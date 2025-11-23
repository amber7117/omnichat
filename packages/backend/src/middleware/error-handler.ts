import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

// Centralized error handler to avoid leaking stack traces in production.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const defaultMessage = err instanceof Error ? err.message : 'Unexpected error';
  const status = err instanceof ApiError ? err.status : 500;
  const body = {
    message: defaultMessage,
    code: err instanceof ApiError ? err.code : undefined,
  };

  if (status >= 500) {
    logger.error({ err }, 'Unhandled server error');
  }

  res.status(status).json(body);
}
