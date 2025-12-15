import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { getDatabaseConfig } from './config/database.config';
import { DbValidationService } from './common/services/db-validation.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ✅ Use forRootAsync() to ensure ConfigService is available
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
    }),
    // ✅ Rate limiting: 100 requests per 60 seconds globally
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // milliseconds
        limit: 100, // requests per window
      },
    ]),
    AuthModule,
    MaterialsModule,
    QuotesModule,
    SuppliersModule,
  ],
  providers: [
    DbValidationService,
    // ✅ Register ThrottlerGuard globally for all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
