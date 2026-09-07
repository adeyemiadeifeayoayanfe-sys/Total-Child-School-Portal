import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Handle Supabase errors
  const supabaseError = err as any;
  if (supabaseError?.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'A record with the same unique value already exists',
    });
  }

  if (supabaseError?.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Related record does not exist',
    });
  }

  if (supabaseError?.code === '23514') {
    return res.status(400).json({
      success: false,
      error: 'Invalid value provided',
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}