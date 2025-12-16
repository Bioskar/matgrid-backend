import { IsString, IsNotEmpty, IsNumber, IsPositive, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitQuoteItemDto {
  @ApiProperty({
    description: 'Material ID from the quote request',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @ApiProperty({
    description: 'Price per unit',
    example: 15000
  })
  @IsNumber()
  @IsPositive()
  pricePerUnit: number;

  @ApiProperty({
    description: 'Delivery time',
    example: 'Same Day',
    enum: ['Same Day', 'Next Day', '2-3 Days', '1 Week']
  })
  @IsString()
  @IsNotEmpty()
  deliveryTime: string;

  @ApiProperty({
    description: 'Stock availability',
    example: 'In Stock'
  })
  @IsString()
  @IsNotEmpty()
  availability: string;
}

export class SubmitSupplierQuoteDto {
  @ApiProperty({
    description: 'Quote request ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  quoteId: string;

  @ApiProperty({
    description: 'Supplier ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({
    description: 'Quote items with pricing',
    type: [SubmitQuoteItemDto]
  })
  @IsNotEmpty()
  items: SubmitQuoteItemDto[];
}
