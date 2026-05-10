import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Notification, NotificationType } from '../entities/notification.entity';
import { UserSettings } from '../../settings/entities/user-settings.entity';
import { User } from '../../auth/entities/user.entity';
import { SmsService } from '../../../common/services/sms.service';
import { EmailService } from '../../../common/services/email.service';

type NotificationCategory = 'quote' | 'order' | 'security' | 'account';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  category?: NotificationCategory;
  force?: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(UserSettings)
    private settingsRepository: Repository<UserSettings>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
    private smsService: SmsService,
    private emailService: EmailService,
  ) {}

  private async canReceive(userId: string, category: NotificationCategory, force?: boolean) {
    if (force || category === 'security' || category === 'account') {
      return true;
    }

    const settings = await this.settingsRepository.findOne({ where: { userId } });

    if (!settings) {
      return true;
    }

    if (!settings.pushNotifications) {
      return false;
    }

    if (category === 'quote') {
      return settings.quoteNotifications;
    }

    if (category === 'order') {
      return settings.orderUpdates;
    }

    return true;
  }

  async createNotification(input: CreateNotificationInput) {
    const category = input.category || 'account';
    const allowed = await this.canReceive(input.userId, category, input.force);

    if (!allowed) {
      this.logger.info(
        { userId: input.userId, type: input.type, category },
        '[Notifications] Skipped notification due to user preferences',
      );
      return null;
    }

    const notification = this.notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
    });

    const saved = await this.notificationRepository.save(notification);

    await this.dispatchChannels(input, category);

    this.logger.info(
      { userId: input.userId, notificationId: saved.id, type: saved.type },
      '[Notifications] Notification created',
    );

    return saved;
  }

  private async dispatchChannels(
    input: CreateNotificationInput,
    category: NotificationCategory,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: input.userId },
      select: ['id', 'email', 'phoneNumber'],
    });

    if (!user) {
      return;
    }

    const settings = await this.settingsRepository.findOne({ where: { userId: input.userId } });
    const force = !!input.force;

    const canSendEmail =
      !!user.email &&
      (force || ((settings?.emailAlerts ?? true) && this.channelCategoryAllowed(settings, category)));

    const canSendSms =
      !!user.phoneNumber &&
      (force || ((settings?.smsAlerts ?? true) && this.channelCategoryAllowed(settings, category)));

    if (canSendEmail) {
      await this.emailService.sendEmail(user.email!, input.title, input.message);
    }

    if (canSendSms) {
      await this.smsService.sendNotificationMessage(user.phoneNumber!, input.message);
    }
  }

  private channelCategoryAllowed(settings: UserSettings | null, category: NotificationCategory) {
    if (!settings) {
      return true;
    }

    if (category === 'quote') {
      return settings.quoteNotifications;
    }

    if (category === 'order') {
      return settings.orderUpdates;
    }

    return true;
  }

  async createForUsers(inputs: CreateNotificationInput[]) {
    for (const input of inputs) {
      await this.createNotification(input);
    }
  }

  async getNotificationsForUser(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean },
  ) {
    const limit = Math.max(1, Math.min(100, options?.limit ?? 20));
    const offset = Math.max(0, options?.offset ?? 0);

    const where: any = { userId };
    if (options?.unreadOnly) {
      where.isRead = false;
    }

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      success: true,
      notifications: items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return {
      success: true,
      unreadCount,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }

    return {
      success: true,
      message: 'Notification marked as read',
      notification,
    };
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }
}
