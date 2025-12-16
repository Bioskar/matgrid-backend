import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email or phone number',
    example: 'john.doe@example.com'
  })
  @IsString()
  emailOrPhone: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!'
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
