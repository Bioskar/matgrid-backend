import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './service/auth.service.ts';
import { AuthController } from './controller/auth.controller.ts';
import { JwtStrategy } from './strategies/jwt.strategy.ts';
import { User } from './entities/user.entity.ts';
import { UserOtp } from './entities/user-otp.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';
import { CommonModule } from '../../common/modules/common.module.ts';
import { jwtConfig } from '../../config/jwt.config.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOtp]),
    JwtModule.register({
      secret: jwtConfig.secret,
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule,
    LoggerProviderModule,
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
