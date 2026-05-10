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
  private termiiBaseUrl: string;
  private termiiOtpUrl: string;
  private termiiVerifyUrl: string;
  private termiiMessageUrl: string;

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
    this.termiiBaseUrl = this.configService.get<string>('TERMII_BASE_URL') || 'https://api.ng.termii.com';
    this.termiiOtpUrl = `${this.termiiBaseUrl}/api/sms/otp/send`;
    this.termiiVerifyUrl = `${this.termiiBaseUrl}/api/sms/otp/verify`;
    this.termiiMessageUrl = `${this.termiiBaseUrl}/api/sms/send`;
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
   * @returns Object with success status, pinId (for Termii), and otp (for Twilio dev mode)
   */
  async sendOtp(phoneNumber: string): Promise<{ success: boolean; pinId?: string; otp?: string }> {
    const isNigerian = this.isNigerianNumber(phoneNumber);
    
    if (isNigerian) {
      return this.sendViaTermii(phoneNumber);
    } else {
      return this.sendViaTwilio(phoneNumber);
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
   * Verify OTP via Termii's API (only for Nigerian numbers)
   * For international numbers (Twilio), verification is done locally
   */
  async verifyOtpWithTermii(pinId: string, pin: string): Promise<boolean> {
    if (!this.termiiEnabled) {
      this.logger.warn({ pinId }, 'Termii disabled - Cannot verify OTP');
      return false;
    }

    try {
      const response = await axios.post(this.termiiVerifyUrl, {
        api_key: this.termiiApiKey,
        pin_id: pinId,
        pin,
      });

      if (response.data.verified === true || response.data.verified === 'True') {
        this.logger.info({ pinId }, 'OTP verified successfully via Termii');
        return true;
      }

      this.logger.warn(
        { pinId, response: response.data },
        'OTP verification failed via Termii'
      );
      return false;
    } catch (error) {
      this.logger.error(
        { 
          pinId, 
          error: error.response?.data || error.message,
        },
        'Error verifying OTP via Termii'
      );
      return false;
    }
  }

  /**
   * Send OTP via Termii (Nigerian numbers) - Uses Termii's OTP API
   */
  private async sendViaTermii(phoneNumber: string): Promise<{ success: boolean; pinId?: string }> {
    if (!this.termiiEnabled) {
      this.logger.warn(
        { phoneNumber },
        'Termii disabled - Nigerian number cannot be sent'
      );
      return { success: false };
    }

    const formattedNumber = this.formatNigerianNumber(phoneNumber);

    try {
      const response = await axios.post(this.termiiOtpUrl, {
        api_key: this.termiiApiKey,
        pin_type: 'NUMERIC',
        to: formattedNumber,
        from: this.termiiSenderId,
        channel: 'dnd', // Use DND route for OTP/transactional messages
        pin_attempts: 3,
        pin_time_to_live: 10, // 10 minutes
        pin_length: 6,
        pin_placeholder: '< 123456 >',
        message_text: 'Your MatGrid verification code is < 123456 >. Valid for 10 minutes. Do not share this code.',
      });

      if (response.data.pinId || response.data.pin_id) {
        const pinId = response.data.pinId || response.data.pin_id;
        this.logger.info(
          { 
            phoneNumber: formattedNumber, 
            pinId,
            provider: 'Termii',
            status: response.data.smsStatus,
          },
          'OTP sent successfully via Termii OTP API'
        );
        return { success: true, pinId };
      }

      this.logger.error(
        { phoneNumber: formattedNumber, response: response.data },
        'Termii OTP API send failed'
      );
      return { success: false };
    } catch (error) {
      this.logger.error(
        { 
          phoneNumber: formattedNumber, 
          error: error.response?.data || error.message,
          provider: 'Termii',
        },
        'Failed to send OTP via Termii OTP API'
      );
      return { success: false };
    }
  }

  /**
   * Send OTP via Twilio (International numbers)
   * Twilio doesn't have OTP API, so we generate OTP here
   */
  private async sendViaTwilio(phoneNumber: string): Promise<{ success: boolean; otp?: string }> {
    if (!this.twilioEnabled) {
      this.logger.warn(
        { phoneNumber },
        'Twilio disabled - International number cannot be sent'
      );
      return { success: false };
    }

    // Generate 6-digit OTP for Twilio (Twilio doesn't have OTP API)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const formattedNumber = this.formatInternationalNumber(phoneNumber);
    const message = `Your MatGrid verification code is ${otp}. Valid for 10 minutes. Do not share this code.`;

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

      const success = ['queued', 'sent', 'delivered'].includes(response.data.status);
      return { success, otp: success ? otp : undefined };
    } catch (error) {
      this.logger.error(
        { 
          phoneNumber: formattedNumber, 
          error: error.response?.data || error.message,
          provider: 'Twilio',
        },
        'Failed to send OTP SMS via Twilio'
      );
      return { success: false };
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

  /**
   * Send transactional notification SMS (non-OTP)
   */
  async sendNotificationMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isServiceEnabled()) {
      return false;
    }

    const isNigerian = this.isNigerianNumber(phoneNumber);
    if (isNigerian) {
      return this.sendMessageViaTermii(phoneNumber, message);
    }

    return this.sendMessageViaTwilio(phoneNumber, message);
  }

  private async sendMessageViaTermii(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.termiiEnabled) {
      return false;
    }

    const formattedNumber = this.formatNigerianNumber(phoneNumber);

    try {
      await axios.post(this.termiiMessageUrl, {
        api_key: this.termiiApiKey,
        to: formattedNumber,
        from: this.termiiSenderId,
        sms: message,
        type: 'plain',
        channel: 'dnd',
      });

      return true;
    } catch (error) {
      this.logger.error(
        {
          phoneNumber: formattedNumber,
          error: (error as any)?.response?.data || (error as any)?.message,
        },
        'Failed to send notification SMS via Termii',
      );
      return false;
    }
  }

  private async sendMessageViaTwilio(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.twilioEnabled) {
      return false;
    }

    const formattedNumber = this.formatInternationalNumber(phoneNumber);

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
        },
      );

      return ['queued', 'sent', 'delivered'].includes(response.data.status);
    } catch (error) {
      this.logger.error(
        {
          phoneNumber: formattedNumber,
          error: (error as any)?.response?.data || (error as any)?.message,
        },
        'Failed to send notification SMS via Twilio',
      );
      return false;
    }
  }
}
