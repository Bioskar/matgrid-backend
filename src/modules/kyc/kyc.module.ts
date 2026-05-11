import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './controller/kyc.controller';
import { KycService } from './service/kyc.service';
import { BvnVerificationService } from './service/bvn-verification.service';
import { KycDocument } from './entities/kyc-document.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';
import { ContractorKycCompleteGuard } from './guards/contractor-kyc-complete.guard';
import { User } from '../auth/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { R2StorageService } from '../../common/services/r2-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument, User]),
    LoggerProviderModule,
    NotificationsModule,
  ],
  controllers: [KycController],
  providers: [KycService, BvnVerificationService, ContractorKycCompleteGuard, R2StorageService],
  exports: [KycService, BvnVerificationService, ContractorKycCompleteGuard],
})
export class KycModule {}
