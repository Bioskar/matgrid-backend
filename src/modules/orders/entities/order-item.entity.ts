import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Order } from './order.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Material } from '../../quotes/entities/material.entity';

@Entity('order_items')
@Index(['orderId'])
@Index(['supplierId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({ type: 'uuid', nullable: true })
  materialId?: string;

  @ManyToOne(() => Material, { nullable: true })
  @JoinColumn({ name: 'materialId' })
  material?: Material;

  @Column({ type: 'varchar' })
  itemName: string;

  @Column({ type: 'varchar', nullable: true })
  category?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar' })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  pricePerUnit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({ type: 'varchar', nullable: true })
  deliveryTime?: string;

  @Column({ type: 'varchar', nullable: true })
  availability?: string;

  @Column({ 
    type: 'enum',
    enum: ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  })
  status: string;
}
