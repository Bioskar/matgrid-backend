import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportController } from './controller/support.controller';
import { SupportService } from './service/support.service';
import { Faq } from './entities/faq.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';

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
