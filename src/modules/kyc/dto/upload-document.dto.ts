import { IsEnum, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, DocumentSide } from '../entities/kyc-document.entity';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Type of document being uploaded',
    enum: DocumentType,
    example: DocumentType.CAC_CERTIFICATE,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({
    description: 'Document side (front or back)',
    enum: DocumentSide,
    example: DocumentSide.FRONT,
  })
  @IsOptional()
  @IsEnum(DocumentSide)
  documentSide?: DocumentSide;

  @ApiPropertyOptional({
    description: 'The uploaded file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  file?: any;

  @ApiPropertyOptional({
    description: 'Document number (e.g., NIN number, License number, CAC number)',
    example: '12345678901',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({
    description: 'Document issue date (YYYY-MM-DD)',
    example: '2020-01-15',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({
    description: 'Document expiry date (YYYY-MM-DD)',
    example: '2030-01-15',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class VerifyDocumentDto {
  @ApiProperty({
    description: 'Verification decision',
    enum: ['verified', 'rejected', 'request_resubmission'],
    example: 'verified',
  })
  @IsEnum(['verified', 'rejected', 'request_resubmission'])
  status: 'verified' | 'rejected' | 'request_resubmission';

  @ApiPropertyOptional({
    description: 'Reason for rejection or resubmission (required if status is rejected/request_resubmission)',
    example: 'Document is not clear/readable',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Document ID being reviewed',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  documentId?: string;
}

export class VerifyBvnDto {
  @ApiProperty({
    description: 'BVN number (11 digits)',
    example: '12345678901',
  })
  @IsString()
  bvnNumber: string;

  @ApiPropertyOptional({
    description: 'Phone number for verification match',
    example: '08012345678',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class KycStatusDto {
  @ApiProperty({
    description: 'Overall KYC status',
    enum: ['not_started', 'in_progress', 'verified', 'rejected', 'suspended'],
  })
  overallStatus: string;

  @ApiProperty({
    description: 'KYC tier level',
    enum: ['tier_1', 'tier_2', 'tier_3'],
  })
  tier: string;

  @ApiProperty({
    description: 'Percentage of KYC completion',
    example: 75,
  })
  completionPercentage: number;

  @ApiProperty({
    description: 'List of required documents for current tier',
    type: [String],
  })
  requiredDocuments: string[];

  @ApiProperty({
    description: 'List of submitted documents with their status',
    type: [Object],
  })
  submittedDocuments: Array<{
    id: string;
    type: string;
    status: string;
    uploadedAt: Date;
  }>;

  @ApiPropertyOptional({
    description: 'Timestamp when KYC was fully completed',
  })
  completedAt?: Date;
}

export class BvnVerificationResultDto {
  @ApiProperty({
    description: 'Whether BVN verification was successful',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'First name from BVN',
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name from BVN',
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Phone number from BVN',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Message describing result',
  })
  message?: string;
}
