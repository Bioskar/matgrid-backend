import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Quote } from '../../quotes/entities/quote.entity';

export enum ProjectStatus {
  DRAFT = 'draft',
  REVIEW_QUOTES = 'review_quotes',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('contractor_projects')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['userId', 'status'])
export class ContractorProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Quote, quote => quote.project)
  quotes: Quote[];

  @Column({ type: 'varchar' })
  projectName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar' })
  deliveryLocation: string;

  @Column({ type: 'timestamp', nullable: true })
  expectedDeliveryDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  status: ProjectStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalBudget: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalSpent: number;

  @Column({ type: 'int', default: 0 })
  quotesCount: number;

  @Column({ type: 'int', default: 0 })
  materialsCount: number;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
