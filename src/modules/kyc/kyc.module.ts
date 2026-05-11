import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './controller/kyc.controller';
import { KycService } from './service/kyc.service';
import { BvnVerificationService } from './service/bvn-verification.service';
import { KycDocument } from './entities/kyc-document.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument]),
    LoggerProviderModule,
  ],
  controllers: [KycController],
  providers: [KycService, BvnVerificationService],
  exports: [KycService, BvnVerificationService],
})
export class KycModule {}
