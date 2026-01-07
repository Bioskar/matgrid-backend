import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './controller/settings.controller';
import { SettingsService } from './service/settings.service';
import { UserSettings } from './entities/user-settings.entity';
import { User } from '../auth/entities/user.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';

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
