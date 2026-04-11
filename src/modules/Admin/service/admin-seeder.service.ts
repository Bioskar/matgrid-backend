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
      // Check if an admin already exists
      const existingAdmin = await this.userRepository.findOne({
        where: { userRole: UserRole.ADMIN },
      });

      if (existingAdmin) {
        this.logger.log('Admin user already exists. Skipping seeded admin creation.');
        return;
      }

      this.logger.log('No admin user found. Creating default admin...');

      // Admin credentials
      const email = 'admin@matgrid.com';
      const password = 'Admin@Pass123!';

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create admin user
      const adminUser = this.userRepository.create({
        email,
        password: hashedPassword,
        fullName: 'System Admin',
        userRole: UserRole.ADMIN,
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      });

      await this.userRepository.save(adminUser);

      this.logger.log('Default admin user successfully created with email: admin@matgrid.com');
    } catch (error) {
      this.logger.error('Failed to seed admin user', error.stack);
    }
  }
}
