import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './controller/payments.controller.ts';
import { PaymentsService } from './service/payments.service.ts';
import { Payment } from './entities/payment.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    LoggerProviderModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
