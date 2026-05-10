import { Module } from '@nestjs/common';
import { HealthController } from '../controllers/health.controller';
import { RootController } from '../controllers/root.controller';
import { SmsService } from '../services/sms.service';
import { EmailService } from '../services/email.service';
import { LoggerProviderModule } from './logger.module';

@Module({
  imports: [LoggerProviderModule],
  controllers: [HealthController, RootController],
  providers: [SmsService, EmailService],
  exports: [SmsService, EmailService],
})
export class CommonModule {}
