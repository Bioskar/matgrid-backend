import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../../materials/entities/user.entity';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { PinoLoggerService } from '../../../common/services/logger.service';

@Injectable()
export class AuthService {
  private readonly logger = new PinoLoggerService();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  /**
   * Register a new user with email/phone and password
   * Validates uniqueness and hashes password before storage
   */
  async register(registerDto: RegisterDto) {
    const { email, phoneNumber, password, fullName, company } = registerDto;

    // Validate at least one contact method provided
    if (!email && !phoneNumber) {
      this.logger.warn('Register attempt without email or phone', {
        hasEmail: !!email,
        hasPhone: !!phoneNumber,
      });
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
      this.logger.warn('Register attempt with existing user', {
        email: email?.toLowerCase(),
        phoneNumber,
      });
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
    });

    // Save to database
    await this.userRepository.save(user);

    // Generate JWT token
    const token = this.jwtService.sign({ userId: user.id });

    this.logger.log('User registered successfully', {
      userId: user.id,
      email: user.email,
      method: email ? 'email' : 'phone',
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        company: user.company,
      },
      token,
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
      this.logger.warn('Login attempt with non-existent user', {
        attemptedCredential: emailOrPhone,
        isEmail: emailOrPhone.includes('@'),
      });
      throw new BadRequestException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn('Login attempt with invalid password', {
        userId: user.id,
        email: user.email,
      });
      throw new BadRequestException('Invalid password');
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate JWT token
    const token = this.jwtService.sign({ userId: user.id });

    this.logger.log('User logged in successfully', {
      userId: user.id,
      email: user.email,
      method: emailOrPhone.includes('@') ? 'email' : 'phone',
      lastLogin: user.lastLogin,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        company: user.company,
      },
      token,
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
}
