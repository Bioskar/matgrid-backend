import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerProviderModule } from '../../common/modules/logger.module';
import { CommonModule } from '../../common/modules/common.module';
import { User } from '../auth/entities/user.entity';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './controller/notifications.controller';
import { NotificationsService } from './service/notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, UserSettings, User]),
    LoggerProviderModule,
    CommonModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
