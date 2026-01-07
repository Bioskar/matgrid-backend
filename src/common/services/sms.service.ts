import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import axios from 'axios';

@Injectable()
export class SmsService {
  // Termii configuration (for Nigerian numbers)
  private termiiApiKey: string;
  private termiiSenderId: string;
  private termiiEnabled: boolean;
  private termiiApiUrl = 'https://api.ng.termii.com/api/sms/send';

  // Twilio configuration (for international numbers)
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioFromNumber: string;
  private twilioEnabled: boolean;
  private twilioApiUrl: string;

  constructor(
    private configService: ConfigService,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {
    // Initialize Termii
    this.termiiApiKey = this.configService.get<string>('TERMII_API_KEY') || '';
    this.termiiSenderId = this.configService.get<string>('TERMII_SENDER_ID') || 'MatGrid';
    this.termiiEnabled = !!this.termiiApiKey;

    // Initialize Twilio
    this.twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.twilioFromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';
    this.twilioEnabled = !!(this.twilioAccountSid && this.twilioAuthToken && this.twilioFromNumber);
    this.twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;

    // Log service status
    if (this.termiiEnabled && this.twilioEnabled) {
      this.logger.info({}, 'SMS service enabled - Termii (Nigeria) + Twilio (International)');
    } else if (this.termiiEnabled) {
      this.logger.info({}, 'SMS service enabled - Termii only (Nigerian numbers)');
    } else if (this.twilioEnabled) {
      this.logger.info({}, 'SMS service enabled - Twilio only (International numbers)');
    } else {
      this.logger.warn({}, 'SMS service disabled - No credentials configured');
    }
  }

  /**
   * Send OTP via SMS - Routes to Termii or Twilio based on country code
   * @param phoneNumber - Phone number (e.g., 08012345678 or +16175551212)
   * @param otp - 6-digit OTP code
   */
  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const isNigerian = this.isNigerianNumber(phoneNumber);
    
    if (isNigerian) {
      return this.sendViaTermii(phoneNumber, otp);
    } else {
      return this.sendViaTwilio(phoneNumber, otp);
    }
  }

  /**
   * Check if phone number is Nigerian
   */
  private isNigerianNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Nigerian numbers start with:
    // - 0 (local format: 0803, 0701, etc.)
    // - 234 (international: 234803, etc.)
    // - +234 (international with +)
    return cleaned.startsWith('0') || 
           cleaned.startsWith('234') || 
           phoneNumber.startsWith('+234');
  }

  /**
   * Send OTP via Termii (Nigerian numbers)
   */
  private async sendViaTermii(phoneNumber: string, otp: string): Promise<boolean> {
    if (!this.termiiEnabled) {
      this.logger.warn(
        { phoneNumber, otp },
        'Termii disabled - Nigerian number cannot be sent'
      );
      return false;
    }

    const formattedNumber = this.formatNigerianNumber(phoneNumber);
    const message = `Your MatGrid OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;

    try {
      const response = await axios.post(this.termiiApiUrl, {
        to: formattedNumber,
        from: this.termiiSenderId,
        sms: message,
        type: 'plain',
        channel: 'dnd', // Use DND route for OTP/transactional messages
        api_key: this.termiiApiKey,
      });

      if (response.data.message_id) {
        this.logger.info(
          { 
            phoneNumber: formattedNumber, 
            messageId: response.data.message_id,
            balance: response.data.balance,
            provider: 'Termii',
          },
          'OTP SMS sent successfully via Termii'
        );
        return true;
      }

      this.logger.error(
        { phoneNumber: formattedNumber, response: response.data },
        'Termii SMS send failed'
      );
      return false;
    } catch (error) {
      this.logger.error(
        { 
          phoneNumber: formattedNumber, 
          error: error.response?.data || error.message,
          provider: 'Termii',
        },
        'Failed to send OTP SMS via Termii'
      );
      return false;
    }
  }

  /**
   * Send OTP via Twilio (International numbers)
   */
  private async sendViaTwilio(phoneNumber: string, otp: string): Promise<boolean> {
    if (!this.twilioEnabled) {
      this.logger.warn(
        { phoneNumber, otp },
        'Twilio disabled - International number cannot be sent'
      );
      return false;
    }

    const formattedNumber = this.formatInternationalNumber(phoneNumber);
    const message = `Your MatGrid OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;

    try {
      const response = await axios.post(
        this.twilioApiUrl,
        new URLSearchParams({
          To: formattedNumber,
          From: this.twilioFromNumber,
          Body: message,
        }),
        {
          auth: {
            username: this.twilioAccountSid,
            password: this.twilioAuthToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.logger.info(
        { 
          phoneNumber: formattedNumber, 
          sid: response.data.sid, 
          status: response.data.status,
          provider: 'Twilio',
        },
        'OTP SMS sent successfully via Twilio'
      );

      return ['queued', 'sent', 'delivered'].includes(response.data.status);
    } catch (error) {
      this.logger.error(
        { 
          phoneNumber: formattedNumber, 
          error: error.response?.data || error.message,
          provider: 'Twilio',
        },
        'Failed to send OTP SMS via Twilio'
      );
      return false;
    }
  }

  /**
   * Format Nigerian phone number for Termii
   * Termii accepts: 2348012345678 (no + prefix)
   */
  private formatNigerianNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If starts with 0, replace with 234
    if (cleaned.startsWith('0')) {
      cleaned = '234' + cleaned.substring(1);
    }

    // Remove + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Ensure it starts with 234
    if (!cleaned.startsWith('234')) {
      cleaned = '234' + cleaned;
    }

    return cleaned;
  }

  /**
   * Format international phone number for Twilio
   * Twilio requires: +16175551212 (with + prefix)
   */
  private formatInternationalNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add + prefix if not present
    if (!phoneNumber.startsWith('+')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if SMS service is enabled (either Termii or Twilio)
   */
  isServiceEnabled(): boolean {
    return this.termiiEnabled || this.twilioEnabled;
  }
}
