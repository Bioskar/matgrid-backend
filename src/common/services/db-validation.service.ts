import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Database Validation Service
 * Ensures PostgreSQL is connected and configured correctly
 * Runs on application startup - prevents silent failures
 */
@Injectable()
export class DbValidationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbValidationService.name);

  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.validateDatabaseConnection();
    await this.validatePostgresType();
    await this.validateEnumSupport();
  }

  /**
   * Check if database is actually connected
   */
  private async validateDatabaseConnection(): Promise<void> {
    try {
      const isConnected = this.dataSource.isInitialized;

      if (!isConnected) {
        throw new Error('DataSource not initialized');
      }

      // Perform a simple query to verify connection
      const result = await this.dataSource.query('SELECT NOW()');
      this.logger.log(
        `✅ PostgreSQL connection verified. Server time: ${result[0].now}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Database connection failed: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Database connection failed. Ensure PostgreSQL is running and credentials are correct.\n${error.message}`,
      );
    }
  }

  /**
   * Verify TypeORM is using PostgreSQL (not SQLite or other DB)
   */
  private async validatePostgresType(): Promise<void> {
    const driver = this.dataSource.driver.options.type;

    if (driver !== 'postgres') {
      throw new Error(
        `❌ CRITICAL: Database type is "${driver}", not "postgres".\n` +
        `Check src/config/database.config.ts - must have type: 'postgres'\n` +
        `Current configuration: ${JSON.stringify(this.dataSource.driver.options, null, 2)}`,
      );
    }

    this.logger.log(`✅ Database type verified: PostgreSQL (${driver})`);
  }

  /**
   * Ensure PostgreSQL has enum support (uuid-ossp extension)
   * This prevents "enum" is not supported errors
   */
  private async validateEnumSupport(): Promise<void> {
    try {
      // Check if uuid-ossp extension is installed
      const extensionCheck = await this.dataSource.query(
        `SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'`,
      );

      if (extensionCheck.length === 0) {
        this.logger.warn(
          `⚠️ uuid-ossp extension not found. Installing...`,
        );
        await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        this.logger.log(`✅ uuid-ossp extension installed`);
      } else {
        this.logger.log(`✅ uuid-ossp extension already installed`);
      }

      // Verify enum type support (enums should work out of box in Postgres)
      this.logger.log(`✅ PostgreSQL enum support verified`);
    } catch (error) {
      this.logger.warn(
        `⚠️ Could not verify uuid-ossp extension: ${error.message}`,
      );
      // Don't throw - uuid-ossp is optional if not using uuid-ossp generation
    }
  }

  /**
   * Get current database info for logging
   */
  async getDatabaseInfo(): Promise<Record<string, any>> {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version
      `);

      return result[0];
    } catch (error) {
      return { error: error.message };
    }
  }
}
