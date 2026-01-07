import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from '../service/payments.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaymentDirection } from '../entities/payment.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get payment history',
    description: `
      **Retrieves complete payment transaction history**
      
      **Returns:**
      - All payment transactions (sent and received)
      - Transaction details (amount, recipient, date, status)
      - Payment method and reference
      - Total amount spent
      
      **Filtering:**
      - direction=sent: Only outgoing payments
      - direction=received: Only incoming payments/refunds
      - No filter: All transactions
      
      **Use for:**
      - Payments page with tabs (All/Sent/Received)
      - Financial tracking and reports
      - Transaction history
      - Expense management
      
      **Payment types:**
      - payment: Regular payment to supplier
      - refund: Money returned from supplier
      - escrow: Money held in escrow
      
      **Frontend display:**
      - Show in reverse chronological order
      - Color code: sent=red/orange, received=green
      - Display amount with currency symbol
      - Show recipient name and transaction reference
      - Filter tabs for Sent/Received
      - Total spent at top of page
    `
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: PaymentDirection,
    description: 'Filter by payment direction (sent or received)'
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
    schema: {
      example: {
        success: true,
        payments: [
          {
            id: '507f1f77bcf86cd799439011',
            recipientName: 'BuildDirect',
            amount: 450000,
            currency: 'NGN',
            paymentType: 'payment',
            direction: 'sent',
            status: 'completed',
            transactionReference: 'TXN-1234567890',
            paymentMethod: 'card',
            description: 'Payment for Order #12345678',
            createdAt: '2025-12-17T10:00:00.000Z'
          },
          {
            id: '507f1f77bcf86cd799439012',
            recipientName: 'Escrow Refund: Order #88521',
            amount: 450000,
            currency: 'NGN',
            paymentType: 'refund',
            direction: 'received',
            status: 'completed',
            transactionReference: 'REF-9876543210',
            paymentMethod: 'bank',
            description: 'Refund for cancelled order',
            createdAt: '2025-12-16T15:30:00.000Z'
          }
        ],
        totalSpent: 2020000,
        count: 4
      }
    }
  })
  async getPayments(
    @Request() req,
    @Query('direction') direction?: PaymentDirection,
  ) {
    return this.paymentsService.getUserPayments(req.user.userId, direction);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get payment statistics',
    description: `
      **Provides payment analytics and totals**
      
      **Returns:**
      - Total amount sent (expenses)
      - Total amount received (refunds)
      - Total number of transactions
      
      **Use for:**
      - Dashboard widgets
      - Financial overview cards
      - Spending analytics
      - Budget tracking
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Payment statistics',
    schema: {
      example: {
        success: true,
        totalSent: 2020000,
        totalReceived: 450000,
        totalPayments: 8
      }
    }
  })
  async getPaymentStats(@Request() req) {
    return this.paymentsService.getPaymentStats(req.user.userId);
  }
}
