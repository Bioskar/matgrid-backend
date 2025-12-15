import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Quote } from '../../quotes/entities/quote.entity';
import { Supplier } from './supplier.entity';

export interface SupplierQuoteMaterial {
  materialId?: string;
  unitPrice?: number;
  totalPrice?: number;
  leadTime?: string;
  notes?: string;
}

@Entity('supplier_quotes')
@Index(['quoteId']) // Index for quote's supplier quotes
@Index(['supplierId']) // Index for supplier's quotes
@Index(['status']) // Index for filtering by status
@Index(['quoteId', 'status']) // Composite index for common query
export class SupplierQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quoteId: string;

  @ManyToOne(() => Quote, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quoteId' })
  quote: Quote;

  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({ type: 'json', default: '[]' })
  materials: SupplierQuoteMaterial[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCost: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDelivery?: Date;

  @Column({ type: 'enum', enum: ['pending', 'quoted', 'accepted', 'rejected'], default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
