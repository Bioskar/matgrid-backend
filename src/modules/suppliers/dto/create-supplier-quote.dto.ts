import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class CreateSupplierQuoteDto {
  @IsString()
  quoteId: string;

  @IsString()
  supplierId: string;

  @IsArray()
  @IsOptional()
  materials?: any[];

  @IsOptional()
  @IsString()
  notes?: string;
}
