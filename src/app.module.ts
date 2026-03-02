import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './modules/auth/auth.module.ts';
import { MaterialsModule } from './modules/materials/materials.module.ts';
import { QuotesModule } from './modules/quotes/quotes.module.ts';
import { SuppliersModule } from './modules/suppliers/suppliers.module.ts';
import { ContractorsModule } from './modules/contractors/contractors.module.ts';
import { OrdersModule } from './modules/orders/orders.module.ts';
import { KycModule } from './modules/kyc/kyc.module.ts';
import { PaymentsModule } from './modules/payments/payments.module.ts';
import { SupportModule } from './modules/support/support.module.ts';
import { SettingsModule } from './modules/settings/settings.module.ts';
import { CommonModule } from './common/modules/common.module.ts';
import { LoggerProviderModule } from './common/modules/logger.module.ts';
import { getDatabaseConfig } from './config/database.config.ts';
import { DbValidationService } from './common/services/db-validation.service.ts';
import { getPinoHttpConfig } from './config/logger.config.ts';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.ts';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRoot(getPinoHttpConfig()),
    CommonModule,
    LoggerProviderModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    MaterialsModule,
    QuotesModule,
    SuppliersModule,
    ContractorsModule,
    OrdersModule,
    KycModule,
    PaymentsModule,
    SupportModule,
    SettingsModule,
  ],
  providers: [
    DbValidationService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');
  }
}
