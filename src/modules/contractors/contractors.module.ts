import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorsController } from './controller/contractors.controller';
import { ContractorsService } from './service/contractors.service';
import { Contractor } from './entities/contractor.entity';
import { User } from '../auth/entities/user.entity';
import { Material } from '../quotes/entities/material.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { SupplierQuote } from '../suppliers/entities/supplier-quote.entity';
import { Order } from '../orders/entities/order.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contractor, User, Material, Quote, SupplierQuote, Order]),
    LoggerProviderModule,
  ],
  controllers: [ContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService],
})
export class ContractorsModule {}
