import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';

/**
 * Custom Pino Logger Service for NestJS
 * Integrates Pino structured logging with NestJS logger interface
 * 
 * Usage in services:
 * - constructor(private logger: PinoLoggerService) {}
 * - this.logger.info('User created', { userId: user.id, email: user.email });
 * - this.logger.error('Database error', error, { query: 'SELECT * FROM users' });
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  private pinoLogger: pino.Logger;
  private context: string = 'NestApplication';

  constructor() {
    // Create Pino logger instance
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

    this.pinoLogger = pino({
      level: logLevel,
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        },
      },
      timestamp: () => {
        return `, "timestamp":"${new Date(Date.now()).toISOString()}"`;
      },
      // Development: Pretty print
      ...(process.env.NODE_ENV !== 'production' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            messageFormat: '{levelLabel} [{context}] {msg}',
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    });
  }

  /**
   * Set context for logging (e.g., service name, controller name)
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log informational message
   */
  log(message: string, context?: string): void;
  log(message: string, meta?: Record<string, any>, context?: string): void;
  log(message: string, metaOrContext?: Record<string, any> | string, context?: string): void {
    const ctx = context || (typeof metaOrContext === 'string' ? metaOrContext : this.context);
    const meta = typeof metaOrContext === 'object' ? metaOrContext : {};

    this.pinoLogger.info({ ...meta, context: ctx }, message);
  }

  /**
   * Log error message with stack trace
   */
  error(message: string, trace?: string, context?: string): void;
  error(message: string, error?: Error | Record<string, any>, context?: string): void;
  error(message: string, errorOrTrace?: Error | Record<string, any> | string, context?: string): void {
    const ctx = context || this.context;
    let errorMeta: Record<string, any> = { context: ctx };

    if (errorOrTrace instanceof Error) {
      errorMeta = {
        ...errorMeta,
        error: errorOrTrace.message,
        stack: errorOrTrace.stack,
      };
    } else if (typeof errorOrTrace === 'string') {
      errorMeta = {
        ...errorMeta,
        stack: errorOrTrace,
      };
    } else if (typeof errorOrTrace === 'object') {
      errorMeta = { ...errorMeta, ...errorOrTrace };
    }

    this.pinoLogger.error(errorMeta, message);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: string): void;
  warn(message: string, meta?: Record<string, any>, context?: string): void;
  warn(message: string, metaOrContext?: Record<string, any> | string, context?: string): void {
    const ctx = context || (typeof metaOrContext === 'string' ? metaOrContext : this.context);
    const meta = typeof metaOrContext === 'object' ? metaOrContext : {};

    this.pinoLogger.warn({ ...meta, context: ctx }, message);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: string): void;
  debug(message: string, meta?: Record<string, any>, context?: string): void;
  debug(message: string, metaOrContext?: Record<string, any> | string, context?: string): void {
    const ctx = context || (typeof metaOrContext === 'string' ? metaOrContext : this.context);
    const meta = typeof metaOrContext === 'object' ? metaOrContext : {};

    this.pinoLogger.debug({ ...meta, context: ctx }, message);
  }

  /**
   * Log verbose message (if logger supports it)
   */
  verbose(message: string, context?: string): void;
  verbose(message: string, meta?: Record<string, any>, context?: string): void;
  verbose(message: string, metaOrContext?: Record<string, any> | string, context?: string): void {
    const ctx = context || (typeof metaOrContext === 'string' ? metaOrContext : this.context);
    const meta = typeof metaOrContext === 'object' ? metaOrContext : {};

    this.pinoLogger.trace({ ...meta, context: ctx }, message);
  }

  /**
   * Get the underlying Pino logger instance for advanced usage
   */
  getPinoLogger(): pino.Logger {
    return this.pinoLogger;
  }
}
