import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { createBootstrapLogger, FilteredPinoLoggerService } from './config/logger.config';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { networkInterfaces } from 'os';

dotenv.config();

const bootstrapLogger = createBootstrapLogger();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  bootstrapLogger.error({ reason, promise, stack: (reason as Error)?.stack }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  bootstrapLogger.error({ error, stack: error.stack }, 'Uncaught Exception');
  process.exit(1);
});

function validatePostgresEnv(): void {
  const required = {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const error = `[FATAL] Missing PostgreSQL configuration!\n\nRequired environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nMake sure your .env file contains:\n  DB_HOST=localhost\n  DB_PORT=5432\n  DB_USERNAME=postgres\n  DB_PASSWORD=your_password\n  DB_NAME=matgridv2`;
    bootstrapLogger.error({ missing_vars: missing }, error);
    throw new Error(error);
  }

  const port = parseInt(required.DB_PORT, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    const error = `[FATAL] Invalid DB_PORT "${required.DB_PORT}". Must be 1-65535`;
    bootstrapLogger.error({ provided_port: required.DB_PORT }, error);
    throw new Error(error);
  }

  bootstrapLogger.info(
    { host: required.DB_HOST, port: required.DB_PORT, database: required.DB_NAME },
    '[BOOTSTRAP] PostgreSQL environment verified'
  );
}

function resolveAccessibleAddresses(port: number, host: string): string[] {
  if (host && host !== '0.0.0.0' && host !== '::') {
    return [`http://${host}:${port}`];
  }

  const nets = networkInterfaces();
  const addresses = new Set<string>([`http://localhost:${port}`]);

  Object.values(nets).forEach((adapters) => {
    adapters?.forEach((adapter) => {
      if (!adapter.internal && adapter.family === 'IPv4') {
        addresses.add(`http://${adapter.address}:${port}`);
      }
    });
  });

  return Array.from(addresses).sort();
}

async function bootstrap() {
  validatePostgresEnv();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: true,
    rawBody: false,
  });

  const pinoLogger = app.get(Logger);
  const filteredLogger = new FilteredPinoLoggerService(pinoLogger);
  app.useLogger(filteredLogger);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(compression());

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('MatGrid API')
      .setDescription('Material Grid Backend API - Material Request and Supplier Management System')
      .setVersion(process.env.API_VERSION || 'v1')
      .addTag('Authentication', 'User authentication and authorization endpoints')
      .addTag('Materials', 'Material management and quote operations')
      .addTag('Quotes', 'Quote management endpoints')
      .addTag('Suppliers', 'Supplier management and quote comparison')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your JWT token here (without "Bearer" prefix)',
          in: 'header',
        },
        'JWT-auth',
      )
      .addServer('http://localhost:3000', 'Local Development')
      .addServer(process.env.API_URL || 'https://api.matgrid.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'MatGrid API Documentation',
      customfavIcon: 'https://nestjs.com/img/logo_text.svg',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
    });

    const swaggerUrl = `http://localhost:${process.env.PORT || 3000}/api/docs`;
    bootstrapLogger.info({ url: swaggerUrl }, '[BOOTSTRAP] Swagger available');
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  
  // Start listening on the port
  await app.listen(port, host);

  const reachable = resolveAccessibleAddresses(port, host);

  bootstrapLogger.info(
    { env: process.env.NODE_ENV || 'development', urls: reachable },
    '[BOOTSTRAP] Application running'
  );
  bootstrapLogger.info(
    { urls: reachable.map((url) => `${url}/api/docs`) },
    '[BOOTSTRAP] API Docs'
  );
  
  // Keep server in scope to prevent garbage collection
  // Create a promise that never resolves - server keeps event loop alive
  await new Promise<never>(() => {
    bootstrapLogger.debug({}, '[BOOTSTRAP] Server listening, never-resolving promise created');
  });
}

bootstrap()
  .catch((err) => {
    console.error('[FATAL] Bootstrap error:', err);
    bootstrapLogger.error({ error: err, stack: err?.stack }, '[FATAL] Application failed to start');
    process.exit(1);
  })
  .finally(() => {
    // This should NOT be called if promise never resolves
    console.error('[FATAL] Bootstrap promise settled (should never happen)');
  });
