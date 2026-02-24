import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSignInOtpDto {
  @ApiProperty({
    description: 'User email or phone number',
    example: 'john@example.com'
  })
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!'
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifySignInOtpDto {
  @ApiProperty({
    description: 'User email or phone number',
    example: 'john@example.com'
  })
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string;

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
