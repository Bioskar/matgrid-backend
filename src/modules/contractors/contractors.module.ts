import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorsController } from './controller/contractors.controller.ts';
import { ContractorsService } from './service/contractors.service.ts';
import { BOQParserService } from './service/boq-parser.service.ts';
import { FileBOQParserService } from './service/file-boq-parser.service.ts';
import { Contractor } from './entities/contractor.entity.ts';
import { ContractorProject } from './entities/project.entity.ts';
import { User } from '../auth/entities/user.entity.ts';
import { Material } from '../quotes/entities/material.entity.ts';
import { Quote } from '../quotes/entities/quote.entity.ts';
import { SupplierQuote } from '../suppliers/entities/supplier-quote.entity.ts';
import { Order } from '../orders/entities/order.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';
import { KycModule } from '../kyc/kyc.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contractor,
      ContractorProject,
      User,
      Material,
      Quote,
      SupplierQuote,
      Order,
    ]),
    LoggerProviderModule,
    KycModule,
  ],
  controllers: [ContractorsController],
  providers: [ContractorsService, BOQParserService, FileBOQParserService],
  exports: [ContractorsService, BOQParserService, FileBOQParserService],
})
export class ContractorsModule {}
