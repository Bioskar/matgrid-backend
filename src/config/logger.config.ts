import { Params } from 'nestjs-pino';
import { LoggerService } from '@nestjs/common';
import pino from 'pino';

/**
 * Pino Logger Configuration
 * Production: JSON logs | Development: Pretty-printed
 */

export function getPinoHttpConfig(): Params {
  const isDev = process.env.NODE_ENV !== 'production';
  const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

  return {
    pinoHttp: {
      level: logLevel,
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              levelFirst: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname,req.headers,req.remoteAddress,req.remotePort',
              messageFormat: '{levelLabel} - {msg}',
            },
          }
        : undefined,
    },
    exclude: ['/health', '/api/docs', '/api/docs-json', '/', '/favicon.ico'],
    ...(isDev && {
      serializers: {
        req: (req: any) => ({
          method: req.method,
          url: req.url,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode,
        }),
      },
    }),
  };
}


export function createBootstrapLogger(): pino.Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

  if (isDev) {
    return pino({
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: false,
          levelFirst: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino({
    level: logLevel,
    formatters: {
      level(label) {
        return { level: label.toUpperCase() };
      },
    },
  });
}

/**
 * Filters NestJS internal INFO logs while preserving errors and warnings
 */
export class FilteredPinoLoggerService implements LoggerService {
  private readonly isDev: boolean;
  private readonly nestInternalContexts = [
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
    'NestFactory',
    'TypeOrmModule',
    'TypeOrmCoreModule',
    'ApplicationReferenceHost',
    'ModuleRef',
    'NestApplication',
  ];

  constructor(private readonly logger: any) {
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  log(message: any, context?: string): any {
    if (this.isDev && context && this.nestInternalContexts.includes(context)) {
      return;
    }
    return this.logger.log(message, context);
  }

  error(message: any, stack?: string, context?: string): any {
    return this.logger.error(message, stack, context);
  }

  warn(message: any, context?: string): any {
    return this.logger.warn(message, context);
  }

  debug(message: any, context?: string): any {
    return this.logger.debug(message, context);
  }

  verbose(message: any, context?: string): any {
    return this.logger.verbose?.(message, context);
  }
}


export const typeOrmLoggingConfig = {
  logging: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['error'],
  maxQueryExecutionTime: process.env.NODE_ENV === 'production' ? 1000 : undefined,
  logger: process.env.NODE_ENV === 'production' ? 'advanced-console' : 'simple-console',
};

