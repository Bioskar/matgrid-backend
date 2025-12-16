import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './controller/materials.controller';
import { MaterialsService } from './service/materials.service';
import { Quote } from '../quotes/entities/quote.entity';
import { Material } from '../quotes/entities/material.entity';
import { FileParserService } from '../../common/parsers/file-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, Material]),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService, FileParserService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
