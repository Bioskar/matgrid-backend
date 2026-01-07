import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum PaymentType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  ESCROW = 'escrow',
}

export enum PaymentDirection {
  SENT = 'sent',
  RECEIVED = 'received',
}

@Entity('payments')
@Index(['userId'])
@Index(['paymentType'])
@Index(['direction'])
@Index(['createdAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @Column({ type: 'varchar' })
  recipientName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.PAYMENT,
  })
  paymentType: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentDirection,
  })
  direction: PaymentDirection;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'completed',
  })
  status: string;

  @Column({ type: 'varchar' })
  transactionReference: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
