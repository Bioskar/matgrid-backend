import { IsString, IsNotEmpty, IsArray, IsNumber, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SelectedSupplierItem {
  @ApiProperty({
    description: 'Supplier ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({
    description: 'Material ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @ApiProperty({
    description: 'Material name',
    example: '12mm Steel Rods'
  })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiProperty({
    description: 'Material category',
    example: 'Steel & Iron'
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: 'Quantity',
    example: 50
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pieces'
  })
  @IsString()
  unit: string;

  @ApiProperty({
    description: 'Price per unit',
    example: 15000
  })
  @IsNumber()
  pricePerUnit: number;

  @ApiProperty({
    description: 'Delivery time',
    example: 'Same Day'
  })
  @IsString()
  @IsOptional()
  deliveryTime?: string;

  @ApiProperty({
    description: 'Availability status',
    example: 'In Stock'
  })
  @IsString()
  @IsOptional()
  availability?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Quote ID reference',
    example: '507f1f77bcf86cd799439011',
    required: false
  })
  @IsString()
  @IsOptional()
  quoteId?: string;

  @ApiProperty({
    description: 'Selected items from suppliers',
    type: [SelectedSupplierItem]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedSupplierItem)
  items: SelectedSupplierItem[];

  @ApiProperty({
    description: 'Contact name',
    example: 'John Doe'
  })
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+2348012345678'
  })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @ApiProperty({
    description: 'Delivery address',
    example: '123 Main Street, Lagos, Nigeria'
  })
  @IsString()
  @IsNotEmpty()
  deliveryAddress: string;

  @ApiProperty({
    description: 'Delivery notes',
    example: 'Please call before delivery',
    required: false
  })
  @IsString()
  @IsOptional()
  deliveryNotes?: string;
}

export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Payment method',
    example: 'card',
    enum: ['card', 'bank', 'ussd', 'transfer']
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['card', 'bank', 'ussd', 'transfer'])
  paymentMethod: string;
}
