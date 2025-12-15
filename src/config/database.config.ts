import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Factory function to create PostgreSQL config from ConfigService
 * This ensures env vars are loaded before accessing them
 * Used in app.module.ts with TypeOrmModule.forRootAsync()
 */
export function getDatabaseConfig(configService: ConfigService): TypeOrmModuleOptions {
  return {
    // ✅ CRITICAL: Explicitly set type to 'postgres' (NOT 'sqlite', 'pg', or from env)
    type: 'postgres',

    // ✅ PostgreSQL connection details from ConfigService (not process.env directly)
    host: configService.get<string>('DB_HOST') || 'localhost',
    port: configService.get<number>('DB_PORT') || 5432,
    username: configService.get<string>('DB_USERNAME') || 'postgres',
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME') || 'matgrid',

    // ✅ Entity discovery: Works with both .ts (dev) and .js (production)
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],

    // ✅ Auto-sync schema only in development
    // NEVER use in production - use migrations instead
    synchronize: configService.get<string>('NODE_ENV') !== 'production',

    // ✅ Detailed logging for development
    logging: configService.get<string>('NODE_ENV') === 'development',

    // ✅ SSL for production databases (e.g., AWS RDS, Azure Database)
    // In development: ssl: false
    // In production: set DB_SSL=true and ensure proper certs
    ssl: configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,

    // ✅ Connection pooling (NestJS + TypeORM defaults are good)
    // Customize if needed for high-load scenarios
    extra: {
      max: 20, // Max connections in pool
      min: 2,  // Min connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },

    // ✅ Migrations (set up when ready)
    migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    migrationsRun: false, // Set to true if auto-running migrations

    // ✅ Better error messages
    dropSchema: false,
    cache: {
      duration: 30000, // 30 seconds query caching
    },

    // ✅ UUID support (your entities use uuid)
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
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  uuidExtension: 'uuid-ossp',
};

/**
 * DataSource for TypeORM CLI (migrations, seed, etc.)
 * Used when running: typeorm migration:generate, typeorm migration:run
 */
export const AppDataSource = new DataSource(databaseConfig as DataSourceOptions);
