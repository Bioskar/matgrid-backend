import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Payment, PaymentDirection } from '../entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  /**
   * Get all payments for a user with optional filtering
   */
  async getUserPayments(userId: string, direction?: PaymentDirection) {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId })
      .orderBy('payment.createdAt', 'DESC');

    if (direction) {
      queryBuilder.andWhere('payment.direction = :direction', { direction });
    }

    const payments = await queryBuilder.getMany();

    // Calculate total spent (sent payments only)
    const totalSpent = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.userId = :userId', { userId })
      .andWhere('payment.direction = :direction', { direction: PaymentDirection.SENT })
      .andWhere('payment.status = :status', { status: 'completed' })
      .getRawOne();

    this.logger.info(
      { userId, direction, count: payments.length },
      'Retrieved user payments'
    );

    return {
      success: true,
      payments: payments.map(payment => ({
        id: payment.id,
        recipientName: payment.recipientName,
        amount: payment.amount,
        currency: payment.currency,
        paymentType: payment.paymentType,
        direction: payment.direction,
        status: payment.status,
        transactionReference: payment.transactionReference,
        paymentMethod: payment.paymentMethod,
        description: payment.description,
        createdAt: payment.createdAt,
      })),
      totalSpent: parseFloat(totalSpent?.total || '0'),
      count: payments.length,
    };
  }

  /**
   * Get payment statistics for user
   */
  async getPaymentStats(userId: string) {
    const [totalSent, totalReceived, allPayments] = await Promise.all([
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .where('payment.userId = :userId', { userId })
        .andWhere('payment.direction = :direction', { direction: PaymentDirection.SENT })
        .andWhere('payment.status = :status', { status: 'completed' })
        .getRawOne(),
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .where('payment.userId = :userId', { userId })
        .andWhere('payment.direction = :direction', { direction: PaymentDirection.RECEIVED })
        .andWhere('payment.status = :status', { status: 'completed' })
        .getRawOne(),
      this.paymentRepository.count({ where: { userId } }),
    ]);

    return {
      success: true,
      totalSent: parseFloat(totalSent?.total || '0'),
      totalReceived: parseFloat(totalReceived?.total || '0'),
      totalPayments: allPayments,
    };
  }

  /**
   * Record a payment transaction
   */
  async recordPayment(paymentData: Partial<Payment>) {
    const payment = this.paymentRepository.create(paymentData);
    await this.paymentRepository.save(payment);

    this.logger.info(
      { 
        paymentId: payment.id, 
        userId: payment.userId, 
        amount: payment.amount,
        direction: payment.direction,
      },
      'Payment recorded'
    );

    return {
      success: true,
      payment,
    };
  }
}
