import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UserPayload } from '../../../common/interfaces/user-payload.interface';
import { assertAllowedQueryKeys } from '../../../common/utils/query-validation.util';
import { NotificationsService } from '../service/notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private validateListQuery(rawQuery: Record<string, any>) {
    assertAllowedQueryKeys(rawQuery, ['limit', 'offset', 'unreadOnly']);
  }

  @Get()
  async getNotifications(
    @CurrentUser() user: UserPayload,
    @Query() rawQuery: Record<string, any>,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    this.validateListQuery(rawQuery);

    if (unreadOnly !== undefined && unreadOnly !== 'true' && unreadOnly !== 'false') {
      throw new BadRequestException(
        'unreadOnly must be either "true" or "false"',
      );
    }

    return this.notificationsService.getNotificationsForUser(user.userId, {
      limit,
      offset,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: UserPayload) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  @Patch(':notificationId/read')
  async markAsRead(
    @CurrentUser() user: UserPayload,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(user.userId, notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: UserPayload) {
    return this.notificationsService.markAllAsRead(user.userId);
  }
}
