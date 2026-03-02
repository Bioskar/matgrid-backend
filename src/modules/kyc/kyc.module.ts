import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './controller/kyc.controller.ts';
import { KycService } from './service/kyc.service.ts';
import { KycDocument } from './entities/kyc-document.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument]),
    LoggerProviderModule,
  ],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
