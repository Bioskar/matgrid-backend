import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable/disable push notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable email alerts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable SMS alerts',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  smsAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable order update notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  orderUpdates?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable quote notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  quoteNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable marketing emails',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred language (en, fr, etc.)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Preferred currency',
    example: 'NGN',
  })
  @IsOptional()
  @IsString()
  preferredCurrency?: string;

  @ApiPropertyOptional({
    description: 'User timezone',
    example: 'Africa/Lagos',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
