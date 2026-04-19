import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './controller/materials.controller';
import { MaterialsService } from './service/materials.service';
import { Quote } from '../quotes/entities/quote.entity';
import { Material } from '../quotes/entities/material.entity';
import { FileParserService } from '../../common/parsers/file-parser.service';
import { LoggerProviderModule } from '../../common/modules/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, Material]),
    LoggerProviderModule,
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService, FileParserService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
