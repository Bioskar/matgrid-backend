import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
