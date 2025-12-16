import { IsString, IsNotEmpty, Length, Matches, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class SendOtpDto {
  @ApiProperty({
    description: 'User phone number',
    example: '08012345678'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+\-\s()]+$/, { message: 'Invalid phone number format' })
  phoneNumber: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User phone number',
    example: '08012345678'
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456'
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}

export class CompleteRegistrationDto {
  @ApiProperty({
    description: 'Verified phone number',
    example: '08012345678'
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe'
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'User role',
    example: 'contractor',
    enum: UserRole
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  userRole: UserRole;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Construction',
    required: false
  })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({
    description: 'Profile photo URL',
    example: 'https://example.com/photo.jpg',
    required: false
  })
  @IsString()
  @IsOptional()
  profilePhoto?: string;
}
