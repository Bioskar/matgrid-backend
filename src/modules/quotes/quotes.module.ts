import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesController } from './controller/quotes.controller.ts';
import { QuotesService } from './service/quotes.service.ts';
import { Quote } from './entities/quote.entity.ts';
import { Material } from './entities/material.entity.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, Material]),
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
