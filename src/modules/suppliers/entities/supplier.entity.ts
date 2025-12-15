import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('suppliers')
@Index(['isActive']) // Index for filtering active suppliers
@Index(['rating']) // Index for sorting by rating
@Index(['name']) // Index for name search
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  email?: string;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber?: string;

  @Column({ type: 'varchar', nullable: true })
  website?: string;

  @Column({ type: 'json', nullable: true })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  @Column({ type: 'simple-array', default: '' })
  specialization: string[];

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
