import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './controller/settings.controller.ts';
import { SettingsService } from './service/settings.service.ts';
import { UserSettings } from './entities/user-settings.entity.ts';
import { User } from '../auth/entities/user.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSettings, User]),
    LoggerProviderModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
