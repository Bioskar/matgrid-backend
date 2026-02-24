import { Controller, Post, Get, Body, UseGuards, Headers, Put, Param } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserPayload } from '../../../common/interfaces/user-payload.interface';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../service/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { SendOtpDto, VerifyOtpDto, CompleteRegistrationDto } from '../dto/otp-auth.dto';
import { SendSignInOtpDto, VerifySignInOtpDto } from '../dto/signin-otp.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthResponseDto, UserResponseDto } from '../dto/user-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description: `
      **Sends a 6-digit verification code to the provided phone number via SMS**
      
      **Process:**
      1. User enters phone number (08012345678 or +2348012345678)
      2. System generates random 6-digit OTP
      3. SMS sent via Termii (Nigeria) or Twilio (International)
      4. OTP valid for 10 minutes
      5. Returns OTP expiry time
      
      **Phone number formats:**
      - Nigerian: 08012345678, 2348012345678, or +2348012345678
      - International: +16175551212 (country code required)
      
      **Rate limits:**
      - 3 OTP requests per minute per IP address
      - 1 OTP per phone number per minute
      - After exceeding limit, wait 1 minute before retrying
      
      **Frontend checklist:**
      - Show loading spinner during request
      - Disable send button after clicking
      - Start 60-second countdown timer
      - Handle 429 error (show "Too many attempts, please wait")
      - Navigate to OTP verification screen on success
      - Store phoneNumber for next step
      
      **Common issues:**
      - SMS not received? Check phone number format
      - "Wait X seconds" error? Previous OTP still valid
      - 429 error? Rate limit exceeded, wait 1 minute
      
      **Next step:** Call POST /verify-otp with the received 6-digit code
    `
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
    description: `
      **Verifies the 6-digit OTP code and issues a temporary token for registration**
      
      **Process:**
      1. User enters the 6-digit OTP received via SMS
      2. System validates OTP against database
      3. Checks if OTP is expired (>10 minutes old)
      4. If valid, issues temporary JWT token (valid for 15 minutes)
      5. Returns tempToken and verified phone number
      
      **OTP validation:**
      - Must be exactly 6 digits
      - Case-insensitive (but only numbers accepted)
      - Expires after 10 minutes
      - Can only be used once
      - Automatically deleted after verification
      
      **Frontend checklist:**
      - Show 6-digit input (numeric keyboard on mobile)
      - Disable verify button during validation
      - Store tempToken in memory (not localStorage)
      - Add tempToken to Authorization header for next request
      - Navigate to complete-registration on success
      - Show "Resend OTP" option if expired
      
      **Error handling:**
      - 400: Invalid OTP or phone number → Show "Invalid code, try again"
      - 400: OTP expired → Show "Code expired, request new one"
      - 429: Too many attempts → Show "Too many attempts, wait X seconds"
      
      **Next step:** Call POST /complete-registration with tempToken in Authorization header
    `
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
    description: `
      **Completes user registration with profile details after OTP verification**
      
      **Process:**
      1. User provides profile information (name, company, role)
      2. System validates tempToken from Authorization header
      3. Creates Contractor or Supplier entity based on userRole
      4. Issues permanent JWT token (valid for 7 days)
      5. Returns user profile and access token
      
      **Required fields:**
      - fullName: User's full name (min 2 characters)
      - company: Company name (min 2 characters)
      - userRole: Either "contractor" or "supplier"
      - deliveryAddress: Delivery/business address (contractors only)
      - Authorization header: Bearer {tempToken} from verify-otp
      
      **Optional fields:**
      - profilePhoto: URL to profile image
      - businessAddress: Business location (suppliers)
      
      **User roles:**
      - contractor: Can request quotes, view supplier responses, create orders
      - supplier: Can view quote requests, submit bids, manage inventory
      
      **Frontend checklist:**
      - Validate all required fields before submission
      - Include tempToken in Authorization: Bearer {token}
      - Store returned JWT token in secure storage
      - Store user.id and user.userRole for role-based UI
      - Redirect to appropriate dashboard (contractor/supplier)
      - Clear tempToken from memory
      
      **Error handling:**
      - 400: Missing required fields → Show field-specific errors
      - 400: Invalid tempToken → Redirect to send-otp (restart flow)
      - 400: TempToken expired → Redirect to send-otp
      - 409: Phone already registered → Show "Account exists, please login"
      
      **Next step:** Use returned JWT token for all authenticated requests
    `
  })
  @ApiBody({ type: CompleteRegistrationDto })
  @ApiResponse({
    status: 201,
    description: 'Registration completed successfully',
    type: AuthResponseDto,
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
          isEmailVerified: false,
          isPhoneVerified: true,
          isActive: true,
          createdAt: '2025-12-16T07:00:00.000Z',
          updatedAt: '2025-12-16T07:00:00.000Z'
        },
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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
    summary: 'Register a new user (Alternative method)',
    description: `
      **Creates a new user account with email/phone and password**
      
      **Note:** This is an alternative registration method. The recommended flow is:
      1. POST /send-otp (phone verification)
      2. POST /verify-otp (verify code)
      3. POST /complete-registration (finish setup)
      
      **Required fields:**
      - phoneNumber: Phone number (08012345678 or +2348012345678)
      - fullName: Full name (min 2 characters)
      - password: Strong password (min 8 characters, includes uppercase, lowercase, number)
      - userRole: Either "contractor" or "supplier"
      - company: Company name
      
      **Optional fields:**
      - email: Email address
      - deliveryAddress: Delivery address (contractors)
      - businessAddress: Business address (suppliers)
      
      **Password requirements:**
      - Minimum 8 characters
      - At least 1 uppercase letter
      - At least 1 lowercase letter
      - At least 1 number
      - At least 1 special character (!@#$%^&*)
      
      **Frontend validation:**
      - Check password strength before submission
      - Show password requirements
      - Confirm password match
      - Validate phone number format
      
      **Returns:**
      - Complete user profile object (without password)
      - JWT access token as 'accessToken' (valid for 7 days - store securely)
      
      **Rate limit:** 5 registrations per hour per IP
      
      **Next step:** Use returned accessToken for authenticated requests
      - Store accessToken in secure storage
      - Include in Authorization header: Bearer {accessToken}
    `
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Registration successful',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          phoneNumber: '+1234567890',
          fullName: 'John Doe',
          company: 'Acme Corp',
          userRole: 'contractor',
          profilePhoto: null,
          isEmailVerified: false,
          isPhoneVerified: false,
          isActive: true,
          createdAt: '2025-12-16T07:00:00.000Z',
          updatedAt: '2025-12-16T07:00:00.000Z'
        },
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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
    summary: 'Login with phone/email and password',
    description: `
      **Authenticates user and returns access token**
      
      **Credentials:**
      - identifier: Phone number or email address
      - password: Account password
      
      **Login identifier formats:**
      - Phone: 08012345678, +2348012345678
      - Email: user@example.com
      
      **Process:**
      1. User enters phone/email and password
      2. System validates credentials
      3. Checks account status (active/suspended)
      4. Updates last login timestamp
      5. Issues JWT token (valid for 7 days)
      6. Returns complete user profile (without password) and access token
      
      **Response structure:**
      - success: true/false
      - message: 'Login successful'
      - user: Complete user object (id, email, phoneNumber, fullName, company, userRole, etc.)
      - accessToken: JWT token for authenticated requests
      
      **Token usage:**
      - Include in all authenticated requests
      - Header format: Authorization: Bearer {accessToken}
      - Token contains: userId, userRole
      - Expires after 7 days (user must re-login)
      
      **Frontend implementation:**
      \`\`\`javascript
      // Store token and user info securely
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Add to requests
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
      }
      \`\`\`
      
      **Security:**
      - Passwords are hashed (bcrypt)
      - Failed attempts logged
      - Rate limited: 10 attempts per hour
      
      **Error handling:**
      - 400: Invalid credentials → Show "Incorrect phone/email or password"
      - 401: Account suspended → Show "Account suspended, contact support"
      - 404: User not found → Show "Account not found, please register"
      - 429: Too many attempts → Show "Too many login attempts, try again later"
      
      **Frontend checklist:**
      - Show loading indicator during login
      - Store token securely (localStorage/SecureStore)
      - Redirect to appropriate dashboard based on userRole
      - Handle "Remember me" option
      - Provide "Forgot password" link
      
      **Next step:** Use token to access protected endpoints
    `
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Login successful',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          phoneNumber: '08012345678',
          fullName: 'John Doe',
          company: 'Acme Corp',
          userRole: 'contractor',
          profilePhoto: null,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
          lastLogin: '2025-12-16T10:30:00.000Z',
          createdAt: '2025-12-01T07:00:00.000Z',
          updatedAt: '2025-12-16T10:30:00.000Z'
        },
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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
  async getProfile(@CurrentUser() user: UserPayload) {
    return {
      success: true,
      user: await this.authService.getUserById(user.userId),
    };
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: `
      **Generates a new access token using a valid refresh token**
      
      **Process:**
      1. Client sends refresh token
      2. System validates refresh token
      3. Verifies token hasn't been revoked
      4. Issues new access and refresh tokens
      
      **Token lifecycle:**
      - Access token: Valid for 7 days
      - Refresh token: Valid for 30 days
      - Refresh tokens are single-use (new one issued on refresh)
      
      **Frontend implementation:**
      \`\`\`javascript
      async function refreshAccessToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        
        const response = await fetch('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        
        const data = await response.json();
        
        // Store new tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        
        return data;
      }
      \`\`\`
      
      **Error handling:**
      - 401: Invalid refresh token → Redirect to login
      - 401: Token expired → Redirect to login
      - 401: Token revoked → Redirect to login
    `
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      example: {
        success: true,
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        message: 'Token refreshed successfully'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('send-signin-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send OTP for sign-in (2FA)',
    description: `
      **Sends OTP for two-factor authentication during login**
      
      **Prerequisites:**
      - User must have 2FA enabled
      - Valid email/phone and password
      
      **Process:**
      1. User enters credentials (email/phone + password)
      2. System validates credentials
      3. Checks if 2FA is enabled
      4. Sends 6-digit OTP via SMS
      5. Returns tempToken for OTP verification
      
      **Use case:**
      - When login returns \`requires2FA: true\`
      - User must verify OTP to complete login
      
      **Rate limits:**
      - 3 OTP requests per minute per IP
      - 1 OTP per account per minute
      
      **Next step:** Call POST /verify-signin-otp with OTP code
    `
  })
  @ApiBody({ type: SendSignInOtpDto })
  @ApiResponse({
    status: 201,
    description: 'OTP sent successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent to your phone number',
        emailOrPhone: 'john@example.com',
        expiresAt: '2026-02-24T08:10:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: '2FA not enabled or invalid credentials' })
  async sendSignInOtp(@Body() sendSignInOtpDto: SendSignInOtpDto) {
    return this.authService.sendSignInOtp(sendSignInOtpDto);
  }

  @Post('verify-signin-otp')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiOperation({
    summary: 'Verify sign-in OTP (2FA)',
    description: `
      **Completes login by verifying 2FA OTP**
      
      **Process:**
      1. User enters 6-digit OTP from SMS
      2. System validates OTP
      3. Issues access and refresh tokens
      4. Returns user profile and tokens
      
      **OTP validation:**
      - Must be exactly 6 digits
      - Valid for 10 minutes
      - Maximum 3 attempts
      - Single-use only
      
      **Success response includes:**
      - User profile
      - Access token (7 days validity)
      - Refresh token (30 days validity)
      
      **Frontend implementation:**
      - Store both tokens securely
      - Redirect to dashboard based on userRole
      - Clear tempToken from memory
    `
  })
  @ApiBody({ type: VerifySignInOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Login successful',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'john@example.com',
          phoneNumber: '08012345678',
          fullName: 'John Doe',
          userRole: 'contractor',
          twoFactorEnabled: true
        },
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifySignInOtp(@Body() verifySignInOtpDto: VerifySignInOtpDto) {
    return this.authService.verifySignInOtp(verifySignInOtpDto);
  }

  @Put('toggle-2fa/:enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Enable or disable two-factor authentication',
    description: `
      **Toggles 2FA for the authenticated user**
      
      **Requirements:**
      - User must be authenticated
      - Phone number required to enable 2FA
      
      **Process:**
      1. User requests to enable/disable 2FA
      2. System validates user has phone number (for enable)
      3. Updates user's 2FA setting
      
      **When enabled:**
      - Login will require OTP verification
      - User receives SMS with 6-digit code
      - Must verify OTP to complete login
      
      **When disabled:**
      - Login with password only
      - No OTP required
    `
  })
  @ApiResponse({
    status: 200,
    description: '2FA setting updated',
    schema: {
      example: {
        success: true,
        message: 'Two-factor authentication enabled successfully',
        twoFactorEnabled: true
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Phone number required to enable 2FA' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async toggleTwoFactor(
    @CurrentUser() user: UserPayload,
    @Param('enable') enable: string,
  ) {
    const enableBool = enable === 'true' || enable === '1';
    return this.authService.toggleTwoFactor(user.userId, enableBool);
  }
}
