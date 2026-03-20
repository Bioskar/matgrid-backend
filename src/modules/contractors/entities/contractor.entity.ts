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

@Entity('contractors')
@Index('IDX_contractor_is_active', ['isActive'])
@Index('IDX_contractor_user_id', ['userId'])
export class Contractor {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: false })
  fullName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profilePhoto?: string;

  @Column({ type: 'text', nullable: true })
  businessAddress?: string;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    defaultLocation?: string;
    defaultDeliveryAddress?: string;
    preferredSuppliers?: string[];
  };

  @Column({
    type: 'enum',
    enum: ['active', 'pending', 'suspended'],
    default: 'active',
  })
  status: 'active' | 'pending' | 'suspended';

  @Column({ type: 'boolean', default: true, nullable: false })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
