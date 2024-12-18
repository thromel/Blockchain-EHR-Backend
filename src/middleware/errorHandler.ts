/**
 * @file Error Handler Middleware
 * @description Centralized error handling
 */

import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction): void {
  console.error('❌ Error:', err);

  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any;

  // Handle known AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }
  // Handle validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'AUTH_TOKEN_INVALID';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'AUTH_TOKEN_EXPIRED';
    message = 'Authentication token expired';
  }
  // Handle database errors
  else if (err.name === 'QueryResultError') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
  }
  // Handle other known errors
  else if (err.message) {
    message = err.message;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    },
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      details: {
        method: req.method,
        path: req.path,
      },
    },
  });
}

/**
 * Async handler wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
