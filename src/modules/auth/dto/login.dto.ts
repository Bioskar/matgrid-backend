import { IsString } from 'class-validator';
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
    example: 'SecurePass123'
  })
  @IsString()
  password: string;
}
