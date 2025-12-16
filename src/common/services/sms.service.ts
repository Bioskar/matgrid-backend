import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import * as twilio from 'twilio';

@Injectable()
export class SmsService {
  private twilioClient: twilio.Twilio | null = null;
  private fromNumber: string;
  private isEnabled: boolean;

  constructor(
    private configService: ConfigService,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    // Only enable if credentials are provided
    this.isEnabled = !!(accountSid && authToken && this.fromNumber);

    if (this.isEnabled) {
      this.twilioClient = twilio.default(accountSid, authToken);
      this.logger.info({}, 'SMS service enabled with Twilio');
    } else {
      this.logger.warn({}, 'SMS service disabled - Twilio credentials not configured');
    }
  }

  /**
   * Send OTP via SMS
   * @param phoneNumber - International format (e.g., +2348012345678)
   * @param otp - 6-digit OTP code
   */
  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    // Ensure phone number is in international format
    const formattedNumber = this.formatPhoneNumber(phoneNumber);

    const message = `Your MatGrid OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;

    if (!this.isEnabled) {
      this.logger.warn(
        { phoneNumber: formattedNumber, otp },
        'SMS service disabled - OTP not sent (DEV MODE)'
      );
      return false;
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedNumber,
      });

      this.logger.info(
        { 
          phoneNumber: formattedNumber, 
          sid: result.sid, 
          status: result.status 
        },
        'OTP SMS sent successfully'
      );

      return result.status === 'queued' || result.status === 'sent' || result.status === 'delivered';
    } catch (error) {
      this.logger.error(
        { 
          phoneNumber: formattedNumber, 
          error: error.message, 
          code: error.code 
        },
        'Failed to send OTP SMS'
      );
      return false;
    }
  }

  /**
   * Format phone number to international format
   * Assumes Nigerian numbers if no country code provided
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If starts with 0, replace with +234 (Nigeria)
    if (cleaned.startsWith('0')) {
      cleaned = '234' + cleaned.substring(1);
    }

    // Add + if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if SMS service is enabled
   */
  isServiceEnabled(): boolean {
    return this.isEnabled;
  }
}
