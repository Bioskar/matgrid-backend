import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import * as bcrypt from 'bcryptjs';
import { UserSettings } from '../entities/user-settings.entity';
import { User } from '../../auth/entities/user.entity';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private settingsRepository: Repository<UserSettings>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  /**
   * Get user settings, create default if not exists
   */
  async getUserSettings(userId: string) {
    let settings = await this.settingsRepository.findOne({
      where: { userId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = this.settingsRepository.create({
        userId,
        pushNotifications: true,
        emailAlerts: true,
        smsAlerts: true,
        orderUpdates: true,
        quoteNotifications: true,
        marketingEmails: true,
        language: 'en',
        preferredCurrency: 'NGN',
      });
      await this.settingsRepository.save(settings);

      this.logger.info({ userId }, 'Created default user settings');
    }

    return {
      success: true,
      settings: {
        pushNotifications: settings.pushNotifications,
        emailAlerts: settings.emailAlerts,
        smsAlerts: settings.smsAlerts,
        orderUpdates: settings.orderUpdates,
        quoteNotifications: settings.quoteNotifications,
        marketingEmails: settings.marketingEmails,
        language: settings.language,
        preferredCurrency: settings.preferredCurrency,
        timezone: settings.timezone,
      },
    };
  }

  /**
   * Update user settings
   */
  async updateSettings(userId: string, updateDto: UpdateSettingsDto) {
    let settings = await this.settingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({ userId });
    }

    // Update fields
    Object.assign(settings, updateDto);

    await this.settingsRepository.save(settings);

    this.logger.info(
      { userId, updatedFields: Object.keys(updateDto) },
      'User settings updated'
    );

    return {
      success: true,
      message: 'Settings updated successfully',
      settings,
    };
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      this.logger.warn({ userId }, 'Change password: Invalid current password');
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    this.logger.info({ userId }, 'Password changed successfully');

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}
