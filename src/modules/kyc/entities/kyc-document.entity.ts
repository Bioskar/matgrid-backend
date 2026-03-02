import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum DocumentType {
  NIN_SLIP = 'nin_slip',
  DRIVERS_LICENSE = 'drivers_license',
  VOTERS_CARD = 'voters_card',
  CAC_CERTIFICATE = 'cac_certificate',
}

export enum VerificationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('kyc_documents')
@Index(['userId', 'documentType'])
@Index(['verificationStatus'])
export class KycDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({ type: 'varchar', length: 500 })
  documentUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentNumber?: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fileSize?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
