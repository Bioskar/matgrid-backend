import { Module } from '@nestjs/common';
import { HealthController } from '../controllers/health.controller.ts';
import { RootController } from '../controllers/root.controller.ts';
import { SmsService } from '../services/sms.service.ts';
import { LoggerProviderModule } from './logger.module.ts';

@Module({
  imports: [LoggerProviderModule],
  controllers: [HealthController, RootController],
  providers: [SmsService],
  exports: [SmsService],
})
export class CommonModule {}
