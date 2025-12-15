import { LoggerOptions } from 'pino';

/**
 * Pino Logger Configuration
 * Provides environment-aware logging:
 * - Development: Pretty-printed, human-readable logs with colors
 * - Production: JSON-formatted logs for log aggregation (ELK, Datadog, CloudWatch)
 */
export function getPinoLoggerConfig(): LoggerOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  const baseConfig: LoggerOptions = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: () => {
      return `, "timestamp":"${new Date(Date.now()).toISOString()}"`;
    },
  };

  // Development: Pretty-printed logs for human readability
  if (process.env.NODE_ENV !== 'production') {
    return {
      ...baseConfig,
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
    } as LoggerOptions;
  }

  // Production: JSON logs for structured logging and aggregation
  // Logs can be piped to: CloudWatch, DataDog, ELK, Splunk, etc.
  return {
    ...baseConfig,
    // JSON format is default - no transport needed
  };
}
