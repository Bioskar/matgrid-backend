import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private smtpHost: string;
  private smtpPort: number;
  private smtpUser: string;
  private smtpPass: string;
  private smtpFrom: string;
  private enabled: boolean;
  private transporter?: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {
    this.smtpHost = this.configService.get<string>('SMTP_HOST') || '';
    this.smtpPort = Number(this.configService.get<string>('SMTP_PORT') || 587);
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
    this.smtpPass = this.configService.get<string>('SMTP_PASS') || '';
    this.smtpFrom = this.configService.get<string>('SMTP_FROM') || this.smtpUser;

    this.enabled = !!(this.smtpHost && this.smtpPort && this.smtpUser && this.smtpPass);

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });

      this.logger.info({}, 'Email service enabled');
    } else {
      this.logger.warn({}, 'Email service disabled - SMTP config incomplete');
    }
  }

  isServiceEnabled() {
    return this.enabled;
  }

  async sendEmail(to: string, subject: string, text: string) {
    if (!this.enabled || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpFrom,
        to,
        subject,
        text,
      });

      return true;
    } catch (error) {
      this.logger.error(
        {
          to,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to send notification email',
      );
      return false;
    }
  }
}
