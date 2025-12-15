import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TypeORMError } from 'typeorm';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Global Exception Filter
 * Catches all exceptions and returns consistent error responses
 * Handles:
 * - HTTP exceptions (400, 401, 403, 404, etc)
 * - Database errors (TypeORM)
 * - Validation errors
 * - Unexpected errors
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorType = 'InternalServerError';

    // Handle HTTP Exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, any>;
        message = response.message || exception.message;
        errorType = response.error || 'HttpException';
      } else {
        message = exception.message;
      }

      this.logger.warn(
        `HTTP ${status} - ${request.method} ${request.path}: ${message}`,
      );
    }
    // Handle TypeORM Database Errors
    else if (exception instanceof TypeORMError || exception instanceof Error) {
      const error = exception as any;

      // Specific TypeORM error handling
      if (error.code === '23505') {
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        message = 'Duplicate entry: This record already exists';
        errorType = 'DuplicateEntry';
      } else if (error.code === '23503') {
        // Foreign key constraint violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference: Related record not found';
        errorType = 'InvalidReference';
      } else if (error.code === '42P01') {
        // Table does not exist
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database table not found';
        errorType = 'DatabaseError';
        this.logger.error(`Database table missing: ${error.message}`);
      } else if (error.name === 'QueryFailedError') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database query failed';
        errorType = 'QueryError';
        this.logger.error(`Query failed: ${error.message}`);
      } else {
        // Generic database error
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database operation failed';
        errorType = 'DatabaseError';
        this.logger.error(`Unhandled database error: ${error.message}`);
      }
    }
    // Handle unexpected errors
    else {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : JSON.stringify(exception)}`,
      );
    }

    // Construct consistent error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: errorType,
      timestamp,
      path: request.path,
      method: request.method,
    };

    // Log sensitive errors
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled error at ${request.method} ${request.path}:`,
        exception,
      );
    }

    response.status(status).json(errorResponse);
  }
}
