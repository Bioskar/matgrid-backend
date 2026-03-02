import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../entities/kyc-document.entity';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Type of document being uploaded',
    enum: DocumentType,
    example: DocumentType.CAC_CERTIFICATE,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({
    description: 'Document number (e.g., NIN number, License number)',
    example: '12345678901',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;
}

export class VerifyDocumentDto {
  @ApiProperty({
    description: 'Verification decision',
    enum: ['verified', 'rejected'],
    example: 'verified',
  })
  @IsEnum(['verified', 'rejected'])
  status: 'verified' | 'rejected';

  @ApiPropertyOptional({
    description: 'Reason for rejection (required if status is rejected)',
    example: 'Document is not clear/readable',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
