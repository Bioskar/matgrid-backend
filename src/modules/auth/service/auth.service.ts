import { Injectable, BadRequestException, Inject, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import pino from 'pino';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { UserOtp } from '../entities/user-otp.entity';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { SendOtpDto, VerifyOtpDto, CompleteRegistrationDto } from '../dto/otp-auth.dto';
import { SendSignInOtpDto, VerifySignInOtpDto } from '../dto/signin-otp.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UserResponseDto, AuthResponseDto } from '../dto/user-response.dto';
import { SmsService } from '../../../common/services/sms.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserOtp)
    private otpRepository: Repository<UserOtp>,
    private jwtService: JwtService,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
    private smsService: SmsService,
  ) {}

  /**
   * Register a new user with email/phone and password
   * Validates uniqueness and hashes password before storage
   */
  async register(registerDto: RegisterDto) {
    const { email, phoneNumber, password, fullName, company, userRole } = registerDto;

    // Validate at least one contact method provided
    if (!email && !phoneNumber) {
      this.logger.warn({ hasEmail: !!email, hasPhone: !!phoneNumber }, 'Register: No contact method provided');
      throw new BadRequestException('Either email or phone number is required');
    }

    // Check if user already exists with email or phone
    const existingUser = await this.userRepository.findOne({
      where: [
        { email: email?.toLowerCase() },
        { phoneNumber },
      ],
    });

    if (existingUser) {
      this.logger.warn(
        { email: email?.toLowerCase(), phoneNumber },
        'Register: User already exists'
      );
      throw new BadRequestException('User already exists with this email or phone number');
    }

    // Hash password with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user entity
    const user = this.userRepository.create({
      email: email?.toLowerCase(),
      phoneNumber,
      password: hashedPassword,
      fullName,
      company,
      userRole: (userRole || UserRole.CONTRACTOR) as UserRole,
    });

    // Save to database
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.userRole);

    this.logger.info(
      { userId: user.id, email: user.email, method: email ? 'email' : 'phone' },
      'User registered successfully'
    );

    // Return user without password
    const { password: _, refreshToken: __, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword as UserResponseDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Registration successful',
    };
  }

  /**
   * Login user with email/phone and password
   * Updates last login timestamp on successful authentication
   */
  async login(loginDto: LoginDto) {
    const { emailOrPhone, password } = loginDto;

    // Find user by email or phone number
    const user = await this.userRepository.findOne({
      where: [
        { email: emailOrPhone.toLowerCase() },
        { phoneNumber: emailOrPhone },
      ],
    });

    if (!user) {
      this.logger.warn(
        { attemptedCredential: emailOrPhone, isEmail: emailOrPhone.includes('@') },
        'Login: User not found'
      );
      throw new BadRequestException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(
        { userId: user.id, email: user.email },
        'Login: Invalid password'
      );
      throw new BadRequestException('Invalid password');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification
      const tempToken = this.jwtService.sign(
        { userId: user.id, type: '2fa', emailOrPhone },
        { expiresIn: '15m' }
      );

      this.logger.info({ userId: user.id }, 'Login: 2FA required');

      return {
        success: true,
        message: 'Two-factor authentication required',
        requires2FA: true,
        tempToken,
      };
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.userRole);

    this.logger.info(
      { userId: user.id, email: user.email, method: emailOrPhone.includes('@') ? 'email' : 'phone' },
      'User logged in successfully'
    );

    // Return user without password
    const { password: _, refreshToken: __, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword as UserResponseDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Login successful',
    };
  }

  /**
   * Get user by ID (excludes password)
   * Used for profile retrieval
   */
  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'phoneNumber', 'fullName', 'company', 'isEmailVerified', 'isPhoneVerified', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  /**
   * Update user profile information
   * Excludes password from response
   */
  async updateProfile(userId: string, updateData: any) {
    // Get existing user
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update fields
    Object.assign(user, updateData);

    // Save updated user
    await this.userRepository.save(user);

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Send OTP to user phone number (unified for contractors/suppliers)
   */
  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phoneNumber } = sendOtpDto;

    // Check for recent OTP requests (rate limiting - 1 per minute)
    const recentOtp = await this.otpRepository.findOne({
      where: {
        phoneNumber,
        createdAt: MoreThan(new Date(Date.now() - 60000)), // 1 minute
      },
      order: { createdAt: 'DESC' },
    });

    if (recentOtp) {
      const waitTime = Math.ceil((60000 - (Date.now() - recentOtp.createdAt.getTime())) / 1000);
      throw new BadRequestException(`Please wait ${waitTime} seconds before requesting another OTP`);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // Save OTP to database
    const otpEntity = this.otpRepository.create({
      phoneNumber,
      otp,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    await this.otpRepository.save(otpEntity);

    // Send OTP via SMS
    const smsSent = await this.smsService.sendOtp(phoneNumber, otp);

    if (!smsSent) {
      if (this.smsService.isServiceEnabled()) {
        // SMS service is enabled but failed to send
        this.logger.error({ phoneNumber }, 'Failed to send OTP SMS');
        throw new BadRequestException('Failed to send OTP. Please try again.');
      } else {
        // SMS service is disabled (no credentials)
        this.logger.warn({ phoneNumber, otp }, 'SMS service disabled - OTP not sent (DEV MODE)');
      }
    }

    // Log OTP in development mode only
    if (process.env.NODE_ENV === 'development') {
      this.logger.info(
        { phoneNumber, otp, expiresAt, smsSent },
        'OTP generated for user'
      );
    }

    return {
      success: true,
      message: smsSent 
        ? 'OTP sent to your phone number'
        : 'OTP generated (SMS disabled - DEV MODE ONLY)',
      phoneNumber,
      expiresAt,
      // Only include OTP in dev when SMS is completely disabled (no credentials)
      ...(process.env.NODE_ENV === 'development' && !this.smsService.isServiceEnabled() && { otp }),
    };
  }

  /**
   * Verify OTP and return temp token for registration
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, otp } = verifyOtpDto;

    // Find latest non-verified OTP for phone number
    const otpEntity = await this.otpRepository.findOne({
      where: {
        phoneNumber,
        verified: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpEntity) {
      throw new BadRequestException('No OTP found for this phone number');
    }

    // Check if OTP expired
    if (new Date() > otpEntity.expiresAt) {
      throw new BadRequestException('OTP has expired. Please request a new one');
    }

    // Check max attempts (3 attempts)
    if (otpEntity.attempts >= 3) {
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP');
    }

    // Verify OTP
    if (otpEntity.otp !== otp) {
      otpEntity.attempts += 1;
      await this.otpRepository.save(otpEntity);
      
      throw new BadRequestException(`Invalid OTP. ${3 - otpEntity.attempts} attempts remaining`);
    }

    // Mark as verified
    otpEntity.verified = true;
    await this.otpRepository.save(otpEntity);

    // Generate temporary token (15 minutes) for registration
    const tempToken = this.jwtService.sign(
      { phoneNumber, type: 'registration' },
      { expiresIn: '15m' }
    );

    this.logger.info({ phoneNumber }, 'User OTP verified successfully');

    return {
      success: true,
      message: 'Phone number verified successfully',
      tempToken,
      phoneNumber,
    };
  }

  /**
   * Complete registration after OTP verification
   */
  async completeRegistration(registrationDto: CompleteRegistrationDto, tempToken: string) {
    try {
      // Verify temp token
      const payload = this.jwtService.verify(tempToken);
      
      if (payload.type !== 'registration' || payload.phoneNumber !== registrationDto.phoneNumber) {
        throw new BadRequestException('Invalid registration token');
      }
    } catch (error) {
      throw new BadRequestException('Registration token expired or invalid. Please verify your phone number again');
    }

    // Verify OTP was completed
    const verifiedOtp = await this.otpRepository.findOne({
      where: {
        phoneNumber: registrationDto.phoneNumber,
        verified: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!verifiedOtp) {
      throw new BadRequestException('Phone number not verified. Please complete OTP verification first');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { phoneNumber: registrationDto.phoneNumber },
    });

    if (existingUser) {
      // Return existing user with tokens
      const tokens = await this.generateTokens(existingUser.id, existingUser.userRole);
      
      const { password: _, refreshToken: __, ...userWithoutPassword } = existingUser;
      
      return {
        success: true,
        message: 'User already registered',
        user: userWithoutPassword as UserResponseDto,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    // Create new user (no password required for OTP-based registration)
    const user = this.userRepository.create({
      phoneNumber: registrationDto.phoneNumber,
      fullName: registrationDto.fullName,
      userRole: registrationDto.userRole,
      company: registrationDto.company,
      profilePhoto: registrationDto.profilePhoto,
      password: '', // Empty password for OTP-based users
      isPhoneVerified: true,
    });

    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.userRole);

    this.logger.info(
      { userId: user.id, phoneNumber: user.phoneNumber, userRole: user.userRole },
      'User registered successfully via OTP'
    );

    // Return user without password
    const { password: _, refreshToken: __, ...userWithoutPassword } = user;

    return {
      success: true,
      message: 'Registration completed successfully',
      user: userWithoutPassword as UserResponseDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Helper method to generate access and refresh tokens
   */
  private async generateTokens(userId: string, userRole: string) {
    const accessToken = this.jwtService.sign(
      { userId, userRole },
      { expiresIn: '7d' }
    );

    const refreshToken = this.jwtService.sign(
      { userId, type: 'refresh' },
      { expiresIn: '30d' }
    );

    // Hash and store refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refreshToken: hashedRefreshToken });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify refresh token matches stored hash
      const isValidRefreshToken = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!isValidRefreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.userRole);

      this.logger.info({ userId: user.id }, 'Token refreshed successfully');

      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: 'Token refreshed successfully',
      };
    } catch (error) {
      this.logger.warn({ error: error.message }, 'Token refresh failed');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Send OTP for sign-in (2FA)
   */
  async sendSignInOtp(sendSignInOtpDto: SendSignInOtpDto) {
    const { emailOrPhone, password } = sendSignInOtpDto;

    // Find user by email or phone number
    const user = await this.userRepository.findOne({
      where: [
        { email: emailOrPhone.toLowerCase() },
        { phoneNumber: emailOrPhone },
      ],
    });

    if (!user) {
      this.logger.warn({ attemptedCredential: emailOrPhone }, 'SignIn OTP: User not found');
      throw new BadRequestException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn({ userId: user.id }, 'SignIn OTP: Invalid password');
      throw new BadRequestException('Invalid password');
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account');
    }

    // Check for recent OTP requests (rate limiting - 1 per minute)
    const recentOtp = await this.otpRepository.findOne({
      where: {
        phoneNumber: user.phoneNumber || emailOrPhone,
        createdAt: MoreThan(new Date(Date.now() - 60000)),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentOtp) {
      const waitTime = Math.ceil((60000 - (Date.now() - recentOtp.createdAt.getTime())) / 1000);
      throw new BadRequestException(`Please wait ${waitTime} seconds before requesting another OTP`);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // Save OTP to database
    const otpEntity = this.otpRepository.create({
      phoneNumber: user.phoneNumber || emailOrPhone,
      otp,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    await this.otpRepository.save(otpEntity);

    // Send OTP via SMS or Email
    const phoneNumber = user.phoneNumber || user.email;
    const smsSent = phoneNumber && phoneNumber.match(/^[0-9+\-\s()]+$/)
      ? await this.smsService.sendOtp(phoneNumber, otp)
      : false;

    if (!smsSent && process.env.NODE_ENV === 'development') {
      this.logger.info({ emailOrPhone, otp }, 'SignIn OTP generated (DEV MODE)');
    }

    return {
      success: true,
      message: smsSent 
        ? 'OTP sent to your phone number'
        : 'OTP generated (SMS disabled - DEV MODE ONLY)',
      emailOrPhone,
      expiresAt,
      ...(process.env.NODE_ENV === 'development' && !this.smsService.isServiceEnabled() && { otp }),
    };
  }

  /**
   * Verify sign-in OTP and complete login (2FA)
   */
  async verifySignInOtp(verifySignInOtpDto: VerifySignInOtpDto) {
    const { emailOrPhone, otp } = verifySignInOtpDto;

    // Find user
    const user = await this.userRepository.findOne({
      where: [
        { email: emailOrPhone.toLowerCase() },
        { phoneNumber: emailOrPhone },
      ],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Find latest non-verified OTP
    const otpEntity = await this.otpRepository.findOne({
      where: {
        phoneNumber: user.phoneNumber || emailOrPhone,
        verified: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpEntity) {
      throw new BadRequestException('No OTP found for this account');
    }

    // Check if OTP expired
    if (new Date() > otpEntity.expiresAt) {
      throw new BadRequestException('OTP has expired. Please request a new one');
    }

    // Check max attempts
    if (otpEntity.attempts >= 3) {
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP');
    }

    // Verify OTP
    if (otpEntity.otp !== otp) {
      otpEntity.attempts += 1;
      await this.otpRepository.save(otpEntity);
      throw new BadRequestException(`Invalid OTP. ${3 - otpEntity.attempts} attempts remaining`);
    }

    // Mark as verified
    otpEntity.verified = true;
    await this.otpRepository.save(otpEntity);

    // Update last login timestamp
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.userRole);

    this.logger.info({ userId: user.id }, 'User logged in successfully with 2FA');

    // Return user without password
    const { password: _, refreshToken: __, ...userWithoutPassword } = user;

    return {
      success: true,
      message: 'Login successful',
      user: userWithoutPassword as UserResponseDto,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Enable/disable two-factor authentication for user
   */
  async toggleTwoFactor(userId: string, enable: boolean) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify user has phone number for 2FA
    if (enable && !user.phoneNumber) {
      throw new BadRequestException('Phone number required to enable two-factor authentication');
    }

    user.twoFactorEnabled = enable;
    await this.userRepository.save(user);

    this.logger.info({ userId, enable }, '2FA toggled');

    return {
      success: true,
      message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully`,
      twoFactorEnabled: enable,
    };
  }
}
