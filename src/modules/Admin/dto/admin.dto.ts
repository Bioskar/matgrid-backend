import { IsString, IsEmail, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ── Query Filters ──────────────────────────────────────────────────────────────

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

// ── Platform Settings ──────────────────────────────────────────────────────────

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  supportPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  escrowHoldPeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  autoApproveVerifiedSuppliers?: boolean;
}

// ── KYC Actions ───────────────────────────────────────────────────────────────

export class RejectKycDto {
  @IsString()
  reason: string;
}

// ── Dispute Resolution ────────────────────────────────────────────────────────

export class ResolveDisputeDto {
  @IsOptional()
  @IsString()
  resolution?: string;
}

// ── Escrow Release ────────────────────────────────────────────────────────────

export class ReleaseEscrowDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
