import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // General Settings
  @Column({ type: 'varchar', default: 'MatGrid' })
  platformName: string;

  @Column({ type: 'varchar', nullable: true })
  supportEmail?: string;

  @Column({ type: 'varchar', nullable: true })
  supportPhone?: string;

  // Payment & Escrow
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.5 })
  platformFeePercent: number;

  @Column({ type: 'int', default: 7 })
  escrowHoldPeriodDays: number;

  // Notifications
  @Column({ type: 'boolean', default: false })
  maintenanceMode: boolean;

  @Column({ type: 'boolean', default: true })
  smsNotifications: boolean;

  // Security & Access
  @Column({ type: 'boolean', default: false })
  autoApproveVerifiedSuppliers: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
