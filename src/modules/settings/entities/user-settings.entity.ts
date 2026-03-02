import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'boolean', default: true })
  pushNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  emailAlerts: boolean;

  @Column({ type: 'boolean', default: true })
  smsAlerts: boolean;

  @Column({ type: 'boolean', default: true })
  orderUpdates: boolean;

  @Column({ type: 'boolean', default: true })
  quoteNotifications: boolean;

  @Column({ type: 'boolean', default: true })
  marketingEmails: boolean;

  @Column({ type: 'varchar', default: 'en' })
  language: string;

  @Column({ type: 'varchar', default: 'NGN' })
  preferredCurrency: string;

  @Column({ type: 'varchar', nullable: true })
  timezone?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
