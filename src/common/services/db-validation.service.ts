import { Injectable, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import pino from 'pino';

/**
 * Database validation service for PostgreSQL
 */
@Injectable()
export class DbValidationService implements OnApplicationBootstrap {
  constructor(
    private dataSource: DataSource,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.validateDatabaseConnection();
    await this.validatePostgresType();
    await this.validateEnumSupport();
  }

  private async validateDatabaseConnection(): Promise<void> {
    try {
      const isConnected = this.dataSource.isInitialized;

      if (!isConnected) {
        throw new Error('DataSource not initialized');
      }

      const result = await this.dataSource.query('SELECT NOW()');
      this.logger.info(
        { connected: true, serverTime: result[0].now },
        'PostgreSQL connection verified'
      );
    } catch (error) {
      this.logger.error({ error: error.message }, 'Database connection failed');
      throw new Error(
        `Database connection failed. Ensure PostgreSQL is running and credentials are correct.\n${error.message}`,
      );
    }
  }

  private async validatePostgresType(): Promise<void> {
    const driver = this.dataSource.driver.options.type;

    if (driver !== 'postgres') {
      this.logger.error(
        { expectedType: 'postgres', actualType: driver },
        'CRITICAL: Wrong database type'
      );
      throw new Error(
        `CRITICAL: Database type is "${driver}", not "postgres".\n` +
        `Check src/config/database.config.ts - must have type: 'postgres'`,
      );
    }

    this.logger.info({ databaseType: driver }, 'Database type verified: PostgreSQL');
  }

  private async validateEnumSupport(): Promise<void> {
    try {
      const extensionCheck = await this.dataSource.query(
        `SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'`,
      );

      if (extensionCheck.length === 0) {
        this.logger.warn({}, 'uuid-ossp extension not found. Installing...');
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        this.logger.info({}, 'uuid-ossp extension installed');
      } else {
        this.logger.info({}, 'uuid-ossp extension already installed');
      }

      this.logger.info({}, 'PostgreSQL enum support verified');
    } catch (error) {
      this.logger.warn(
        { error: error.message },
        'Could not verify uuid-ossp extension (optional)',
      );
    }
  }
}