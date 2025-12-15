import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersController } from './controller/suppliers.controller';
import { SuppliersService } from './service/suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { SupplierQuote } from './entities/supplier-quote.entity';
import { Material } from '../materials/entities/material.entity';
import { Quote } from '../quotes/entities/quote.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierQuote, Material, Quote]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
