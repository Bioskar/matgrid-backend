import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './controller/kyc.controller';
import { KycService } from './service/kyc.service';
import { BvnVerificationService } from './service/bvn-verification.service';
import { KycDocument } from './entities/kyc-document.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';
import { ContractorKycCompleteGuard } from './guards/contractor-kyc-complete.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument]),
    LoggerProviderModule,
  ],
  controllers: [KycController],
  providers: [KycService, BvnVerificationService, ContractorKycCompleteGuard],
  exports: [KycService, BvnVerificationService, ContractorKycCompleteGuard],
})
export class KycModule {}
