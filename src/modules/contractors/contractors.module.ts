import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorsController } from './controller/contractors.controller';
import { ContractorsService } from './service/contractors.service';
import { BOQParserService } from './service/boq-parser.service';
import { FileBOQParserService } from './service/file-boq-parser.service';
import { Contractor } from './entities/contractor.entity';
import { ContractorProject } from './entities/project.entity';
import { User } from '../auth/entities/user.entity';
import { Material } from '../quotes/entities/material.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { SupplierQuote } from '../suppliers/entities/supplier-quote.entity';
import { Order } from '../orders/entities/order.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';
import { KycModule } from '../kyc/kyc.module';

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
