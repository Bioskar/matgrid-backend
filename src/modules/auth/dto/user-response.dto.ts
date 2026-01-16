import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011',
    description: 'Unique user identifier'
  })
  id: string;

  @ApiProperty({ 
    example: 'user@example.com',
    description: 'User email address',
    required: false
  })
  email?: string;

  @ApiProperty({ 
    example: '08012345678',
    description: 'User phone number',
    required: false
  })
  phoneNumber?: string;

  @ApiProperty({ 
    example: 'John Doe',
    description: 'User full name'
  })
  fullName: string;

  @ApiProperty({ 
    example: 'Acme Construction Ltd',
    description: 'Company name'
  })
  company?: string;

  @ApiProperty({ 
    enum: UserRole,
    example: UserRole.CONTRACTOR,
    description: 'User role (contractor, supplier, or admin)'
  })
  userRole: UserRole;

  @ApiProperty({ 
    example: 'https://example.com/photos/profile.jpg',
    description: 'Profile photo URL',
    required: false
  })
  profilePhoto?: string;

  @ApiProperty({ 
    example: false,
    description: 'Whether email is verified'
  })
  isEmailVerified: boolean;

  @ApiProperty({ 
    example: true,
    description: 'Whether phone number is verified'
  })
  isPhoneVerified: boolean;

  @ApiProperty({ 
    example: true,
    description: 'Whether account is active'
  })
  isActive: boolean;

  @ApiProperty({ 
    example: '2025-12-16T10:00:00.000Z',
    description: 'Account creation date'
  })
  createdAt: Date;

  @ApiProperty({ 
    example: '2025-12-17T10:00:00.000Z',
    description: 'Last profile update date'
  })
  updatedAt: Date;

  @ApiProperty({ 
    example: '2025-12-17T09:00:00.000Z',
    description: 'Last login timestamp',
    required: false
  })
  lastLogin?: Date;
}

export class AuthResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Success status'
  })
  success: boolean;

  @ApiProperty({ 
    type: UserResponseDto,
    description: 'User profile information (without password)'
  })
  user: UserResponseDto;

  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token (valid for 7 days)'
  })
  accessToken: string;

  @ApiProperty({ 
    example: 'Login successful',
    description: 'Response message',
    required: false
  })
  message?: string;
}
