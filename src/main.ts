import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PinoLoggerService } from './common/services/logger.service';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * CRITICAL: Validate PostgreSQL configuration BEFORE app bootstrap
 * Prevents silent fallback to SQLite or connection failures
 */
function validatePostgresEnv(logger: PinoLoggerService): void {
  logger.setContext('PostgreSQL Config Validation');
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
    const error = `❌ FATAL: Missing PostgreSQL configuration!\n\nRequired environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nMake sure your .env file contains:\n  DB_HOST=localhost\n  DB_PORT=5432\n  DB_USERNAME=postgres\n  DB_PASSWORD=your_password\n  DB_NAME=matgridv2`;
    logger.error(error, { missing_vars: missing });
    throw new Error(error);
  }

  const port = parseInt(required.DB_PORT, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    const error = `❌ FATAL: Invalid DB_PORT "${required.DB_PORT}". Must be 1-65535`;
    logger.error(error, { provided_port: required.DB_PORT });
    throw new Error(error);
  }

  logger.log(`✅ PostgreSQL env vars verified: ${required.DB_HOST}:${required.DB_PORT}/${required.DB_NAME}`, {
    host: required.DB_HOST,
    port: required.DB_PORT,
    database: required.DB_NAME,
  });
}

async function bootstrap() {
  // Create Pino logger early for bootstrap logging
  const logger = new PinoLoggerService();
  logger.setContext('NestApplication');

  // Validate PostgreSQL config first
  validatePostgresEnv(logger);

  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });

  // Middleware
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ Global exception filter - catch all errors and return consistent format
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger API Documentation
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
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addServer('http://localhost:3000', 'Local Development')
      .addServer('https://api.matgrid.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'MatGrid API Documentation',
      customfavIcon: 'https://nestjs.com/img/logo_text.svg',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
    });

    const swaggerUrl = `http://localhost:${process.env.PORT || 3000}/api/docs`;
    logger.log(`📚 API Documentation available at ${swaggerUrl}`, { url: swaggerUrl });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Application running on http://localhost:${port}`, { port, environment: process.env.NODE_ENV || 'development' });
  logger.log(`📖 Swagger Docs: http://localhost:${port}/api/docs`, { url: `http://localhost:${port}/api/docs` });
}

bootstrap().catch((err) => {
  const logger = new PinoLoggerService();
  logger.setContext('Bootstrap');
  logger.error('Failed to start application', err);
  process.exit(1);
});
