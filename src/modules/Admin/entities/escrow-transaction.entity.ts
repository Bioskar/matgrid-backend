import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

@Entity('escrow_transactions')
@Index(['orderId'])
@Index(['escrowStatus'])
@Index(['contractorId'])
@Index(['supplierId'])
export class EscrowTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  escrowId: string; // ESC-XXXXX format

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'varchar' })
  orderNumber: string;

  @Column({ type: 'uuid' })
  contractorId: string;

  @Column({ type: 'varchar' })
  contractorName: string;

  @Column({ type: 'uuid' })
  supplierId: string;

  @Column({ type: 'varchar' })
  supplierName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['held', 'released', 'disputed'],
    default: 'held',
  })
  escrowStatus: 'held' | 'released' | 'disputed';

  @Column({
    type: 'enum',
    enum: ['in_transit', 'delivered', 'delivery_confirmed', 'awaiting_confirmation'],
    default: 'in_transit',
  })
  deliveryStatus: 'in_transit' | 'delivered' | 'delivery_confirmed' | 'awaiting_confirmation';

  @Column({ type: 'timestamp', nullable: true })
  releasedAt?: Date;

  @Column({ type: 'text', nullable: true })
  releaseNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateEscrowId() {
    if (!this.escrowId) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      this.escrowId = `ESC-${timestamp}${random}`;
    }
  }
}
