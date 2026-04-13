import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../auth/entities/user.entity';

@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
  }

  private async seedAdmin() {
    try {
      // Admin credentials from env or defaults
      const email = process.env.ADMIN_SEED_EMAIL || 'admin@matgrid.com';
      const password = process.env.ADMIN_SEED_PASSWORD || 'Admin@matgrid1';

      // Check if an admin already exists with this email
      const existingAdmin = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      if (existingAdmin) {
        this.logger.log(
          `Admin user (${email}) already exists. Skipping seeded admin creation.`,
        );
        return;
      }

      // Check if ANY admin exists (to be safe)
      const anyAdmin = await this.userRepository.findOne({
        where: { userRole: UserRole.ADMIN },
      });

      if (anyAdmin) {
        this.logger.log(
          'An admin user already exists in the system. Skipping seeding.',
        );
        return;
      }

      this.logger.log(`No admin user found. Creating default admin (${email})...`);

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create admin user
      const adminUser = this.userRepository.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName: 'MatGrid Admin',
        userRole: UserRole.ADMIN,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        twoFactorEnabled: false,
      });

      await this.userRepository.save(adminUser);

      this.logger.log(
        `✓ Default admin user successfully created: ${email}`,
      );
    } catch (error) {
      this.logger.error('Failed to seed admin user', error.stack);
    }
  }
}
