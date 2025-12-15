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
 * Global exception filter for consistent error responses
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
    else if (exception instanceof TypeORMError || exception instanceof Error) {
      const error = exception as any;

      if (error.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'Duplicate entry: This record already exists';
        errorType = 'DuplicateEntry';
      } else if (error.code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference: Related record not found';
        errorType = 'InvalidReference';
      } else if (error.code === '42P01') {
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
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database operation failed';
        errorType = 'DatabaseError';
        this.logger.error(`Unhandled database error: ${error.message}`);
      }
    }
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
