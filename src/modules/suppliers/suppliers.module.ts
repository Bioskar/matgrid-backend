import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersController } from './controller/suppliers.controller';
import { SuppliersService } from './service/suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { SupplierQuote } from './entities/supplier-quote.entity';
import { User } from '../auth/entities/user.entity';
import { Material } from '../quotes/entities/material.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';

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
