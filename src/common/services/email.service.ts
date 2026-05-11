import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import pino from 'pino';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';

type TransactionalEmailPayload = {
  to: string;
  subject: string;
  html: string;
  recipientName?: string;
};

type EmailSender = {
  email: string;
  name: string;
};

@Injectable()
export class EmailService {
  private smtpHost: string;
  private smtpPort: number;
  private smtpSecure: boolean;
  private smtpUser: string;
  private smtpPassword: string;
  private smtpFromEmail: string;
  private smtpFromName: string;

  private zeptoApiUrl: string;
  private zeptoToken?: string;
  private zeptoFromEmail: string;
  private zeptoFromName: string;

  private primaryTransporter?: Transporter;

  constructor(
    private readonly configService: ConfigService,
    @Inject('PINO_LOGGER') private readonly logger: pino.Logger,
  ) {
    this.smtpHost = this.configService.get<string>('SMTP_HOST') || '';
    this.smtpPort = Number(this.configService.get<string>('SMTP_PORT') || 587);
    this.smtpSecure = (this.configService.get<string>('SMTP_SECURE') || 'false') === 'true';
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
    this.smtpPassword =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('SMTP_PASS') ||
      '';
    this.smtpFromEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.smtpUser;
    this.smtpFromName = this.configService.get<string>('SMTP_FROM_NAME') || 'MatGrid';

    this.zeptoApiUrl =
      this.configService.get<string>('ZEPTOMAIL_API_URL') ||
      'https://api.zeptomail.com/v1.1/email';
    this.zeptoToken = this.normalizeZeptoToken(
      this.configService.get<string>('ZEPTOMAIL_SEND_MAIL_TOKEN') || '',
    );
    this.zeptoFromEmail =
      this.configService.get<string>('ZEPTOMAIL_FROM_EMAIL') || this.smtpFromEmail;
    this.zeptoFromName =
      this.configService.get<string>('ZEPTOMAIL_FROM_NAME') || this.smtpFromName;

    if (this.isSmtpConfigured()) {
      this.primaryTransporter = this.createSmtpTransport(this.smtpPort, this.smtpSecure);
      this.logger.info(
        {
          host: this.smtpHost,
          port: this.smtpPort,
          secure: this.smtpSecure,
          fromEmail: this.smtpFromEmail,
        },
        'Email SMTP provider initialized',
      );
    } else {
      this.logger.warn({}, 'Email SMTP provider disabled - SMTP config incomplete');
    }

    if (this.zeptoToken) {
      const plusCount = (this.zeptoToken.match(/\+/g) || []).length;
      const slashCount = (this.zeptoToken.match(/\//g) || []).length;
      this.logger.info(
        {
          apiUrl: this.zeptoApiUrl,
          tokenFingerprint: this.getTokenFingerprint(this.zeptoToken),
          tokenLength: this.zeptoToken.length,
          plusCount,
          slashCount,
          tokenLooksBase64: this.looksLikeBase64(this.zeptoToken),
        },
        'ZeptoMail provider token diagnostics',
      );
    } else {
      this.logger.warn({}, 'ZeptoMail provider disabled - token missing');
    }
  }

  isServiceEnabled(): boolean {
    return this.isZeptoMailConfigured() || this.isSmtpConfigured();
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    const html = `<div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;"><p>${this.escapeHtml(
      text,
    ).replace(/\n/g, '<br/>')}</p></div>`;

    const result = await this.sendTransactionalEmail(
      { to, subject, html },
      { event: 'legacy_send_email' },
    );

    return result.success;
  }

  async sendTransactionalEmail(
    payload: TransactionalEmailPayload,
    context: Record<string, unknown> = {},
  ): Promise<{ success: boolean; provider: 'zeptomail' | 'smtp'; id?: string }> {
    try {
      return await this.sendEmailWithPreferredProvider(payload, context);
    } catch (error) {
      this.logger.error(
        {
          to: payload.to,
          subject: payload.subject,
          context,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Transactional email failed',
      );
      return { success: false, provider: 'smtp' };
    }
  }

  async sendVerificationEmail(
    email: string,
    verificationToken: string,
  ): Promise<{ success: boolean; provider: 'zeptomail' | 'smtp'; id?: string }> {
    const verificationBase =
      this.configService.get<string>('EMAIL_VERIFICATION_URL') ||
      'https://app.matgrid.com/auth/verify-email';

    const verificationUrl = `${verificationBase}?token=${encodeURIComponent(
      verificationToken,
    )}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">Verify your email address</h2>
        <p style="margin-bottom: 16px;">Please confirm your email to secure your MatGrid account.</p>
        <p style="margin-bottom: 20px;">
          <a href="${verificationUrl}" style="background: #E85E00; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p style="margin-bottom: 6px;">If the button does not work, use this link:</p>
        <p style="word-break: break-all; font-size: 13px; color: #333;">${verificationUrl}</p>
        <p style="margin-top: 20px; font-size: 13px; color: #666;">This link expires in 24 hours.</p>
      </div>
    `;

    return this.sendTransactionalEmail(
      {
        to: email,
        subject: 'Verify your MatGrid email address',
        html,
      },
      { event: 'email_verification' },
    );
  }

  private isZeptoMailConfigured(): boolean {
    return !!(this.zeptoApiUrl && this.zeptoToken && this.zeptoFromEmail);
  }

  private isSmtpConfigured(): boolean {
    return !!(
      this.smtpHost &&
      this.smtpPort &&
      this.smtpUser &&
      this.smtpPassword &&
      this.smtpFromEmail
    );
  }

  private getEmailSender(provider: 'zeptomail' | 'smtp'): EmailSender {
    if (provider === 'zeptomail') {
      return {
        email: this.zeptoFromEmail,
        name: this.zeptoFromName,
      };
    }

    return {
      email: this.smtpFromEmail,
      name: this.smtpFromName,
    };
  }

  private async sendViaZeptoMail(
    payload: TransactionalEmailPayload,
    context: Record<string, unknown>,
  ): Promise<string | undefined> {
    if (!this.zeptoToken) {
      throw new Error('ZeptoMail token missing');
    }

    const sender = this.getEmailSender('zeptomail');

    const response = await axios.post(
      this.zeptoApiUrl,
      {
        from: {
          address: sender.email,
          name: sender.name,
        },
        to: [
          {
            email_address: {
              address: payload.to,
              name: payload.recipientName || payload.to,
            },
          },
        ],
        subject: payload.subject,
        htmlbody: payload.html,
      },
      {
        headers: {
          Authorization: `Zoho-enczapikey ${this.zeptoToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    const requestId =
      (response.headers?.['x-request-id'] as string | undefined) ||
      (response.headers?.['x-zm-tracking-id'] as string | undefined);

    const messageId =
      (response.data?.data?.[0]?.message_id as string | undefined) ||
      (response.data?.message_id as string | undefined);

    this.logger.info(
      {
        provider: 'zeptomail',
        requestId,
        messageId,
        to: payload.to,
        context,
      },
      'Transactional email sent via ZeptoMail',
    );

    return messageId || requestId;
  }

  private createSmtpTransport(port: number, secure: boolean): Transporter {
    return nodemailer.createTransport({
      host: this.smtpHost,
      port,
      secure,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPassword,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  private isTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = (error as Error & { code?: string }).code;
    return ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(code || '');
  }

  private async sendMailWithFallback(
    mailOptions: SendMailOptions,
    context: Record<string, unknown>,
  ) {
    if (!this.primaryTransporter || !this.isSmtpConfigured()) {
      throw new Error('SMTP provider not configured');
    }

    try {
      const result = await this.primaryTransporter.sendMail(mailOptions);
      this.logger.info(
        {
          provider: 'smtp',
          smtpPort: this.smtpPort,
          secure: this.smtpSecure,
          messageId: result.messageId,
          to: mailOptions.to,
          context,
        },
        'Transactional email sent via SMTP primary',
      );

      return result;
    } catch (error) {
      if (!this.isTimeoutError(error)) {
        throw error;
      }

      this.logger.warn(
        {
          provider: 'smtp',
          smtpPort: this.smtpPort,
          secure: this.smtpSecure,
          error: error instanceof Error ? error.message : 'Unknown error',
          context,
        },
        'SMTP primary timed out, retrying with TLS 465',
      );

      const fallback465 = this.createSmtpTransport(465, true);
      const fallbackResult = await fallback465.sendMail(mailOptions);

      this.logger.info(
        {
          provider: 'smtp',
          smtpPort: 465,
          secure: true,
          messageId: fallbackResult.messageId,
          to: mailOptions.to,
          context,
        },
        'Transactional email sent via SMTP 465 fallback',
      );

      return fallbackResult;
    }
  }

  private async sendEmailWithPreferredProvider(
    payload: TransactionalEmailPayload,
    context: Record<string, unknown>,
  ): Promise<{ success: boolean; provider: 'zeptomail' | 'smtp'; id?: string }> {
    if (this.isZeptoMailConfigured()) {
      try {
        const id = await this.sendViaZeptoMail(payload, context);
        return { success: true, provider: 'zeptomail', id };
      } catch (error) {
        this.logger.error(
          {
            provider: 'zeptomail',
            to: payload.to,
            subject: payload.subject,
            context,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'ZeptoMail failed, falling back to SMTP',
        );
      }
    }

    const sender = this.getEmailSender('smtp');

    const mailOptions: SendMailOptions = {
      from: `"${sender.name}" <${sender.email}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    };

    const smtpResult = await this.sendMailWithFallback(mailOptions, context);
    return { success: true, provider: 'smtp', id: smtpResult.messageId };
  }

  private normalizeZeptoToken(rawToken: string): string | undefined {
    if (!rawToken) {
      return undefined;
    }

    let token = rawToken.trim();
    token = token.replace(/^Zoho-enczapikey\s*/i, '').trim();
    token = token.replace(/[\r\n\t]/g, '');

    if (token.includes(' ')) {
      token = token.replace(/ /g, '+');
    }

    token = token.replace(/\s+/g, '');

    return token || undefined;
  }

  private looksLikeBase64(value: string): boolean {
    if (!value || value.length < 16) {
      return false;
    }

    return /^[A-Za-z0-9+/=]+$/.test(value);
  }

  private getTokenFingerprint(token: string): string {
    if (!token || token.length < 10) {
      return 'short-token';
    }

    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
