import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Factory function to create PostgreSQL config from ConfigService
 * This ensures env vars are loaded before accessing them
 * Used in app.module.ts with TypeOrmModule.forRootAsync()
 */
export function getDatabaseConfig(configService: ConfigService): TypeOrmModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  
  return {
    type: 'postgres',

    host: configService.get<string>('DB_HOST') || 'localhost',
    port: configService.get<number>('DB_PORT') || 5432,
    username: configService.get<string>('DB_USERNAME') || 'postgres',
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME') || 'matgrid',

    entities: [__dirname + '/../**/*.entity{.ts,.js}'],

    // IMPORTANT: Disable synchronize in production, use migrations
    // In development, you can enable synchronize OR use migrations (not both)
    synchronize: nodeEnv === 'development', // Only true in dev for rapid prototyping
    
    logging: nodeEnv === 'production' ? ['error', 'warn'] : ['query', 'error', 'schema', 'warn'],
    maxQueryExecutionTime: nodeEnv === 'production' ? 1000 : undefined,

    ssl: configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,

    extra: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    },

    connectTimeoutMS: 10000,
    retryAttempts: 3,
    retryDelay: 3000,

    migrations: [__dirname + '/../database/migrations/**/*{.ts,.js}'],
    migrationsTableName: 'typeorm_migrations',
    migrationsRun: false, // Disable auto-run migrations for now

    dropSchema: false,
    cache: {
      duration: 30000,
    },

    uuidExtension: 'uuid-ossp',
  };
}

/**
 * Static config for DataSource (CLI only)
 * Used when running: typeorm migration:generate, typeorm migration:run
 * Falls back to environment variables
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'matgrid',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  // Errors only in all environments (no query logs)
  logging: ['error'],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  uuidExtension: 'uuid-ossp',
};

/**
 * DataSource for TypeORM CLI (migrations, seed, etc.)
 * Used when running: typeorm migration:generate, typeorm migration:run
 */
export const AppDataSource = new DataSource(databaseConfig as DataSourceOptions);
