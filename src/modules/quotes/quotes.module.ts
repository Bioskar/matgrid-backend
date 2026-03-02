import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesController } from './controller/quotes.controller';
import { QuotesService } from './service/quotes.service';
import { Quote } from './entities/quote.entity';
import { Material } from './entities/material.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, Material]),
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
