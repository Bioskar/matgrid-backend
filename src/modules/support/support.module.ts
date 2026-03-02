import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportController } from './controller/support.controller.ts';
import { SupportService } from './service/support.service.ts';
import { Faq } from './entities/faq.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([Faq]),
    LoggerProviderModule,
  ],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
