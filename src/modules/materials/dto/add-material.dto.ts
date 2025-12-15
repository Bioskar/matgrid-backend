import { IsString, IsNumber, IsOptional } from 'class-validator';

export class AddMaterialDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string = 'pcs';

  @IsOptional()
  @IsString()
  specification?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  estimatedUnitPrice?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
