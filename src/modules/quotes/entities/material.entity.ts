import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Quote } from '../../quotes/entities/quote.entity';

@Entity('materials')
@Index(['quoteId']) // Index for quote lookups - most common query
@Index(['category']) // Index for filtering by category
@Index(['isReviewed']) // Index for filtering reviewed materials
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quoteId: string;

  @ManyToOne(() => Quote, quote => quote.materials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quoteId' })
  quote: Quote;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', default: 'pcs' })
  unit: string;

  @Column({ type: 'text', nullable: true })
  specification?: string;

  @Column({ type: 'varchar', nullable: true })
  category?: string;

  @Column({ type: 'varchar', nullable: true })
  brand?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedUnitPrice?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedTotalPrice?: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'enum', enum: ['upload', 'paste', 'manual'], default: 'manual' })
  sourceMethod: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', default: false })
  isReviewed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
