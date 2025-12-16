import { Controller, Post, Get, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../service/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { SendOtpDto, VerifyOtpDto, CompleteRegistrationDto } from '../dto/otp-auth.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description: 'Send 6-digit OTP for phone verification (contractors/suppliers). Rate limited to 3 requests per minute per IP'
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 201,
    description: 'OTP sent successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: '08012345678',
        expiresAt: '2025-12-16T08:00:00.000Z',
        otp: '123456'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Rate limit exceeded or invalid phone' })
  @ApiResponse({ status: 429, description: 'Too many requests - rate limit exceeded' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiOperation({
    summary: 'Verify OTP code',
    description: 'Verify 6-digit OTP and receive temporary token for registration'
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 201,
    description: 'OTP verified successfully',
    schema: {
      example: {
        success: true,
        message: 'Phone number verified successfully',
        tempToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        phoneNumber: '08012345678'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP or OTP expired' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('complete-registration')
  @Throttle({ default: { limit: 3, ttl: 300 } })
  @ApiOperation({
    summary: 'Complete user registration',
    description: 'Complete registration with profile details after OTP verification'
  })
  @ApiBody({ type: CompleteRegistrationDto })
  @ApiResponse({
    status: 201,
    description: 'Registration completed successfully',
    schema: {
      example: {
        success: true,
        message: 'Registration completed successfully',
        user: {
          id: '507f1f77bcf86cd799439011',
          phoneNumber: '08012345678',
          fullName: 'John Doe',
          userRole: 'contractor',
          company: 'Acme Construction',
          profilePhoto: null,
          createdAt: '2025-12-16T07:00:00.000Z'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid token or registration data' })
  async completeRegistration(
    @Body() registrationDto: CompleteRegistrationDto,
    @Headers('authorization') authorization: string,
  ) {
    // Extract temp token from Authorization header
    const tempToken = authorization?.replace('Bearer ', '');
    
    if (!tempToken) {
      throw new Error('Authorization token required');
    }

    return this.authService.completeRegistration(registrationDto, tempToken);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600 } })
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account with email/phone and password'
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      example: {
        success: true,
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          phoneNumber: '+1234567890',
          fullName: 'John Doe',
          company: 'Acme Corp'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input or user already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 3600 } })
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate user with email/phone and password'
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    schema: {
      example: {
        success: true,
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          fullName: 'John Doe'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Retrieve the authenticated user\'s profile information'
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        success: true,
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          phoneNumber: '+1234567890',
          fullName: 'John Doe',
          company: 'Acme Corp',
          createdAt: '2024-01-01T00:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async getProfile(@Req() req: any) {
    return {
      success: true,
      user: await this.authService.getUserById(req.user.userId),
    };
  }
}
