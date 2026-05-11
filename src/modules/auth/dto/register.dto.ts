import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength, IsIn, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

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
    description: 'User password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
    example: 'SecurePass123!#',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  )
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

  @ApiProperty({
    description: 'Company name (legacy alias)',
    example: 'Acme Corporation',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({
    description: 'User role: contractor (buyer) or supplier (seller)',
    example: 'contractor',
    enum: [UserRole.CONTRACTOR, UserRole.SUPPLIER],
    default: UserRole.CONTRACTOR
  })
  @IsOptional()
  @IsIn([UserRole.CONTRACTOR, UserRole.SUPPLIER], {
    message: 'userRole must be either contractor or supplier',
  })
  userRole?: UserRole;
}
