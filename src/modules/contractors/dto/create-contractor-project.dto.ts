import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContractorProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'Office Building Construction',
  })
  @IsNotEmpty()
  @IsString()
  projectName: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: '5-story office building with parking',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Delivery location',
    example: 'Lagos, Nigeria',
  })
  @IsNotEmpty()
  @IsString()
  deliveryLocation: string;

  @ApiPropertyOptional({
    description: 'Expected delivery date',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Need quick delivery',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
