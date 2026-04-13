import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  orderNumber: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => OrderItem, orderItem => orderItem.order)
  items: OrderItem[];

  @Column({ type: 'uuid', nullable: true })
  quoteId?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deliveryFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  serviceFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed', 'completed'],
    default: 'pending'
  })
  status: string;

  @Column({
    type: 'enum',
    enum: ['none', 'funds_held', 'released_to_client', 'disputed'],
    default: 'none',
  })
  escrowStatus: string;

  @Column({ 
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  })
  paymentStatus: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod?: string;

  @Column({ type: 'varchar', nullable: true })
  transactionReference?: string;

  @Column({ type: 'varchar' })
  contactName: string;

  @Column({ type: 'varchar' })
  contactPhone: string;

  @Column({ type: 'text' })
  deliveryAddress: string;

  @Column({ type: 'text', nullable: true })
  deliveryNotes?: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  shippedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  disputedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
