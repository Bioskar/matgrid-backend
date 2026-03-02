import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersController } from './controller/suppliers.controller.ts';
import { SuppliersService } from './service/suppliers.service.ts';
import { Supplier } from './entities/supplier.entity.ts';
import { SupplierQuote } from './entities/supplier-quote.entity.ts';
import { User } from '../auth/entities/user.entity.ts';
import { Material } from '../quotes/entities/material.entity.ts';
import { Quote } from '../quotes/entities/quote.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, User, SupplierQuote, Material, Quote]),
    LoggerProviderModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
