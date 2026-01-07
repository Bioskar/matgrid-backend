import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ManualMaterialDto {
  @ApiProperty({
    description: 'Material name',
    example: 'Cement (Dangote)',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Quantity needed',
    example: 50,
  })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'bags',
  })
  @IsNotEmpty()
  @IsString()
  unit: string;

  @ApiPropertyOptional({
    description: 'Additional description or specifications',
    example: '50kg bags, Dangote brand preferred',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Brand preference',
    example: 'Dangote',
  })
  @IsOptional()
  @IsString()
  brand?: string;
}

export class CreateQuickQuoteDto {
  @ApiPropertyOptional({
    description: 'Project name (optional for quick quotes)',
    example: 'New Construction Project',
  })
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional({
    description: 'Delivery location',
    example: 'Lekki, Lagos',
  })
  @IsOptional()
  @IsString()
  deliveryLocation?: string;

  @ApiProperty({
    description: 'List of materials to request quotes for',
    type: [ManualMaterialDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualMaterialDto)
  materials: ManualMaterialDto[];

  @ApiPropertyOptional({
    description: 'Additional notes for suppliers',
    example: 'Need delivery within 5 days',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
