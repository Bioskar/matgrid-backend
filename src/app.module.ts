import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './modules/auth/auth.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ContractorsModule } from './modules/contractors/contractors.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KycModule } from './modules/kyc/kyc.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SupportModule } from './modules/support/support.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CommonModule } from './common/modules/common.module';
import { LoggerProviderModule } from './common/modules/logger.module';
import { getDatabaseConfig } from './config/database.config';
import { DbValidationService } from './common/services/db-validation.service';
import { getPinoHttpConfig } from './config/logger.config';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

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
