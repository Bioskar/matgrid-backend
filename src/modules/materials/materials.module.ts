import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './controller/materials.controller.ts';
import { MaterialsService } from './service/materials.service.ts';
import { Quote } from '../quotes/entities/quote.entity.ts';
import { Material } from '../quotes/entities/material.entity.ts';
import { FileParserService } from '../../common/parsers/file-parser.service.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, Material]),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService, FileParserService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
