import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from '../service/settings.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user settings',
    description: `
      **Retrieves user notification preferences and settings**
      
      **Returns:**
      - Notification preferences (push, email, SMS)
      - Language preference
      - Currency preference
      - Timezone settings
      
      **Use for:**
      - Settings page display
      - Populating settings form
      - Reading user preferences
      
      **Default values:**
      - All notifications enabled by default
      - Language: English (en)
      - Currency: NGN
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Settings retrieved successfully',
    schema: {
      example: {
        success: true,
        settings: {
          pushNotifications: true,
          emailAlerts: true,
          smsAlerts: false,
          orderUpdates: true,
          quoteNotifications: true,
          marketingEmails: false,
          language: 'en',
          preferredCurrency: 'NGN',
          timezone: 'Africa/Lagos'
        }
      }
    }
  })
  async getSettings(@Request() req) {
    return this.settingsService.getUserSettings(req.user.userId);
  }

  @Put()
  @ApiOperation({
    summary: 'Update user settings',
    description: `
      **Updates user notification preferences and settings**
      
      **Updatable fields:**
      - pushNotifications: Enable/disable push notifications
      - emailAlerts: Enable/disable email alerts
      - smsAlerts: Enable/disable SMS alerts
      - orderUpdates: Enable/disable order update notifications
      - quoteNotifications: Enable/disable quote notifications
      - marketingEmails: Enable/disable promotional emails
      - language: User interface language
      - preferredCurrency: Display currency
      - timezone: User timezone
      
      **All fields are optional** - only send fields you want to update
      
      **Frontend implementation:**
      - Use toggle switches for boolean settings
      - Show instant feedback when toggled
      - Save automatically or on "Save" button
      - Display success message
      
      **Use for:**
      - Settings page toggles
      - Notification preferences
      - Language switching
      - Currency selection
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Settings updated successfully',
        settings: {
          pushNotifications: true,
          emailAlerts: false,
          language: 'en'
        }
      }
    }
  })
  async updateSettings(
    @Request() req,
    @Body() updateDto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(req.user.userId, updateDto);
  }

  @Post('change-password')
  @ApiOperation({
    summary: 'Change user password',
    description: `
      **Changes user account password**
      
      **Required fields:**
      - currentPassword: User's current password
      - newPassword: New password (min 8 characters, must include uppercase, lowercase, number, special character)
      
      **Validation:**
      - Current password must be correct
      - New password must be different from current
      - New password must meet strength requirements
      
      **Password requirements:**
      - Minimum 8 characters
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one number
      - At least one special character (@$!%*?&)
      
      **Security:**
      - Passwords are bcrypt hashed
      - Failed attempts are logged
      - No password history sent in response
      
      **Frontend implementation:**
      - Show password strength meter
      - Toggle show/hide password
      - Validate before submitting
      - Clear form on success
      - Show success message
      - Optionally logout user after change
      
      **Error handling:**
      - 400: Invalid current password → "Current password is incorrect"
      - 400: Same password → "New password must be different"
      - 400: Weak password → Show specific requirement that failed
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      example: {
        success: true,
        message: 'Password changed successfully'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password or password requirements not met'
  })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.settingsService.changePassword(req.user.userId, changePasswordDto);
  }
}
