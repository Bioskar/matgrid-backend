import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+1234567890',
    required: false
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'SecurePass123',
    minLength: 6
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    required: false
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Corporation',
    required: false
  })
  @IsOptional()
  @IsString()
  company?: string;
}
