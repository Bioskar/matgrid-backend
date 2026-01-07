import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParseBOQDto {
  @ApiProperty({
    description: 'Bill of Quantities text to parse - can be pasted from Excel, Word, or any text format',
    example: `Item 1: 500 Bags of Cement (Dangote/Lafarge)
Item 2: 25 Tons of Sharp Sand
Item 3: 15 Lengths of 16mm Reinforcement Steel
Item 4: 10 Rolls of PVC Water Pipes (2 inch)`,
  })
  @IsNotEmpty()
  @IsString()
  boqText: string;

  @ApiPropertyOptional({
    description: 'Project ID to associate parsed materials with',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class ParsedMaterialItem {
  @ApiProperty({
    description: 'Material name extracted from text',
    example: 'Cement (Dangote)',
  })
  name: string;

  @ApiProperty({
    description: 'Quantity extracted',
    example: 50,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'bags',
  })
  unit: string;

  @ApiProperty({
    description: 'Original text line',
    example: 'Item 1: 500 Bags of Cement (Dangote/Lafarge)',
  })
  originalText: string;

  @ApiProperty({
    description: 'Confidence score of the parsing (0-1)',
    example: 0.95,
  })
  confidence: number;
}

export class ParseBOQResponseDto {
  @ApiProperty({
    description: 'Number of items found',
    example: 4,
  })
  itemsFound: number;

  @ApiProperty({
    description: 'Parsed materials',
    type: [ParsedMaterialItem],
  })
  materials: ParsedMaterialItem[];

  @ApiProperty({
    description: 'Any warnings or notes about the parsing',
    example: ['Some quantities were estimated', 'Please review Sharp Sand quantity'],
  })
  warnings: string[];
}

export class CreateProjectWithBOQDto {
  @ApiProperty({
    description: 'Project name',
    example: 'Lekki 3 bedroom flat',
  })
  @IsNotEmpty()
  @IsString()
  projectName: string;

  @ApiProperty({
    description: 'Delivery address',
    example: '3 Bake Lekki',
  })
  @IsNotEmpty()
  @IsString()
  deliveryAddress: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Construction of 3 bedroom apartment',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddParsedMaterialsDto {
  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsString()
  projectId: string;

  @ApiProperty({
    description: 'Parsed materials to add',
    type: [ParsedMaterialItem],
  })
  @IsArray()
  materials: ParsedMaterialItem[];
}
