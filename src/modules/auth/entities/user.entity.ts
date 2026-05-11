import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, Index } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

export enum UserRole {
  CONTRACTOR = 'contractor',
  SUPPLIER = 'supplier',
  ADMIN = 'admin'
}

export enum UserType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business'
}

export enum KycTier {
  NOT_STARTED = 'not_started',
  TIER_1 = 'tier_1',
  TIER_2 = 'tier_2',
  TIER_3 = 'tier_3'
}

@Entity('users')
@Index(['isActive'])
@Index(['userRole'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  email?: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  phoneNumber?: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'varchar', nullable: true })
  fullName?: string;

  @Column({ type: 'varchar', nullable: true })
  company?: string;

  @Column({ 
    type: 'enum',
    enum: UserRole,
    default: UserRole.CONTRACTOR
  })
  userRole: UserRole;

  @Column({ type: 'text', nullable: true })
  profilePhoto?: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: false })
  isPhoneVerified: boolean;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.INDIVIDUAL,
  })
  userType: UserType;

  @Column({ type: 'varchar', nullable: true, unique: true })
  bvnNumber?: string;

  @Column({
    type: 'enum',
    enum: KycTier,
    default: KycTier.NOT_STARTED,
  })
  kycTier: KycTier;

  @Column({ type: 'timestamp', nullable: true })
  kycCompletedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isBvnVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateEmailOrPhone() {
    if (!this.email && !this.phoneNumber) {
      throw new BadRequestException('Either email or phone number must be provided');
    }
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    if (this.phoneNumber) {
      this.phoneNumber = this.phoneNumber.trim();
    }
  }
}
