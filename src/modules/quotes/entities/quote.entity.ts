import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Material } from './material.entity';

@Entity('quotes')
@Index(['userId']) // Index for user's quotes lookup
@Index(['status']) // Index for filtering by status
@Index(['createdAt']) // Index for sorting by date
@Index(['userId', 'status']) // Composite index for user + status queries
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Material, material => material.quote)
  materials: Material[];

  @Column({ type: 'varchar', nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ['draft', 'in-review', 'finalized', 'archived'], default: 'draft' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEstimatedCost: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  materialsCount: number;

  @Column({ type: 'int', default: 0 })
  suppliersCount: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp', nullable: true })
  deadline?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
