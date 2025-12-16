import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, Index } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

export enum UserRole {
  CONTRACTOR = 'contractor',
  SUPPLIER = 'supplier',
  ADMIN = 'admin'
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

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
