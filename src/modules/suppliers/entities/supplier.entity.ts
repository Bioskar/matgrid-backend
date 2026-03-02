import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('suppliers')
@Index(['isActive'])
@Index(['rating'])
@Index(['name'])
export class Supplier {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  ownerName?: string;

  @Column({ type: 'varchar', nullable: true })
  website?: string;

  @Column({ type: 'text', nullable: true })
  shopAddress?: string;

  @Column({ type: 'json', nullable: true })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  @Column({ type: 'simple-array', default: '' })
  materialCategories: string[];

  @Column({ type: 'simple-array', default: '' })
  specialization: string[];

  @Column({ type: 'varchar', default: 'pending' })
  verificationStatus: 'pending' | 'verified' | 'rejected';

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column({ type: 'varchar', default: '7-14 days' })
  leadTime: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minimumOrderValue: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
