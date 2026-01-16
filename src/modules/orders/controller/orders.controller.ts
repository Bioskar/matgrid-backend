import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserPayload } from '../../../common/interfaces/user-payload.interface';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../service/orders.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateOrderDto, ProcessPaymentDto } from '../dto/create-order.dto';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create order from accepted quotes',
    description: `
      **Creates an order after contractor accepts supplier quote(s)**
      
      **Process:**
      1. Contractor reviews supplier quotes
      2. Selects best quote(s) for materials
      3. Creates order with selected items
      4. System generates order number
      5. Returns order ready for payment
      
      **Required fields:**
      - quoteId: The original material quote
      - supplierQuoteIds: Array of accepted supplier quote IDs
      - deliveryAddress: Confirmed delivery address
      - contactName: Who to contact for delivery
      - contactPhone: Contact phone number
      
      **Optional fields:**
      - deliveryNotes: Special delivery instructions
      - preferredDeliveryDate: When you need delivery
      
      **Order includes:**
      - All selected materials with agreed prices
      - Subtotal of all items
      - Delivery fee (calculated by distance)
      - Service fee (5% platform fee)
      - Grand total
      
      **Order statuses:**
      - pending: Awaiting payment
      - paid: Payment completed, processing
      - confirmed: Suppliers confirmed order
      - shipped: Items dispatched
      - delivered: Order completed
      
      **Frontend flow:**
      1. Show order summary with totals
      2. Confirm delivery details
      3. Create order
      4. Redirect to payment page
      
      **Next step:** Process payment via POST /orders/:orderId/pay
    `
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    schema: {
      example: {
        success: true,
        message: 'Order created successfully',
        order: {
          id: '507f1f77bcf86cd799439011',
          orderNumber: '#12345678',
          subtotal: 1950000,
          deliveryFee: 50000,
          serviceFee: 25000,
          totalAmount: 2025000,
          currency: 'NGN',
          status: 'pending',
          paymentStatus: 'pending',
          contactName: 'John Doe',
          contactPhone: '+2348012345678',
          deliveryAddress: '123 Main Street, Lagos',
          items: [],
          createdAt: '2025-12-16T08:00:00.000Z'
        }
      }
    }
  })
  async createOrder(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: UserPayload) {
    const userId = user.userId;
    return this.ordersService.createOrder(userId, createOrderDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all user orders',
    description: `
      **Retrieves complete order history for authenticated user**
      
      **Returns:**
      - All orders (past and current)
      - Order number, date, status
      - Total amount per order
      - Payment status
      - Delivery status
      
      **Order sorting:**
      - Newest orders first
      - Can filter by status
      - Searchable by order number
      
      **Use for:**
      - Order history page
      - Tracking current orders
      - Reordering materials
      - Generating reports
      
      **Frontend display:**
      - Show in table or card list
      - Display: Order #, Date, Total, Status
      - Color code by status (pending=yellow, delivered=green)
      - "View Details" for each order
      - Filter buttons (All, Pending, Completed)
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      example: [
        {
          id: '507f1f77bcf86cd799439011',
          orderNumber: '#12345678',
          totalAmount: 2025000,
          status: 'delivered',
          paymentStatus: 'completed',
          createdAt: '2025-12-15T10:00:00.000Z',
          deliveredAt: '2025-12-17T10:00:00.000Z'
        }
      ]
    }
  })
  async getUserOrders(@CurrentUser() user: UserPayload) {
    const userId = user.userId;
    return this.ordersService.getUserOrders(userId);
  }

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get order details',
    description: 'Get detailed order information including items and suppliers'
  })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully'
  })
  async getOrderById(@Param('orderId') orderId: string, @CurrentUser() user: UserPayload) {
    const userId = user.userId;
    return this.ordersService.getOrderById(orderId, userId);
  }

  @Post(':orderId/pay')
  @ApiOperation({
    summary: 'Process order payment',
    description: `
      **Processes payment for a pending order**
      
      **Required fields:**
      - paymentMethod: "card", "bank_transfer", "paystack", "flutterwave"
      - amount: Total amount to pay (must match order total)
      
      **Optional fields:**
      - paymentReference: Transaction reference from payment gateway
      - customerEmail: For payment receipt
      
      **Payment flow:**
      1. User selects payment method
      2. If card/gateway: Redirect to payment page
      3. Payment processed by gateway
      4. Callback updates order status
      5. Return success with transaction reference
      
      **Supported payment methods:**
      - **card**: Credit/Debit card via Paystack/Flutterwave
      - **bank_transfer**: Direct bank transfer with account details
      - **paystack**: Paystack payment gateway
      - **flutterwave**: Flutterwave payment gateway
      
      **Payment verification:**
      - Amount must exactly match order total
      - Order must be in "pending" status
      - Cannot pay twice for same order
      
      **After successful payment:**
      - Order status → "paid"
      - PaymentStatus → "completed"
      - Email/SMS confirmation sent
      - Suppliers notified to fulfill order
      
      **Frontend implementation:**
      \`\`\`javascript
      // Paystack example
      const paystack = new PaystackPop();
      paystack.newTransaction({
        key: 'pk_your_key',
        email: user.email,
        amount: order.totalAmount * 100, // kobo
        onSuccess: (transaction) => {
          // Call this endpoint with transaction.reference
          POST /orders/:orderId/pay
        }
      });
      \`\`\`
      
      **Error handling:**
      - 400: Invalid amount → "Amount doesn't match order total"
      - 400: Already paid → "Order already paid"
      - 402: Payment failed → "Payment processing failed, try again"
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Payment processed successfully',
    schema: {
      example: {
        success: true,
        message: 'Payment processed successfully',
        order: {
          id: '507f1f77bcf86cd799439011',
          orderNumber: '#12345678',
          totalAmount: 2025000,
          paymentStatus: 'completed',
          transactionReference: 'TXN-1234567890-ABC123',
          paidAt: '2025-12-16T08:10:00.000Z'
        }
      }
    }
  })
  async processPayment(
    @Param('orderId') orderId: string,
    @Body() paymentDto: ProcessPaymentDto,
    @CurrentUser() user: UserPayload
  ) {
    const userId = user.userId;
    return this.ordersService.processPayment(orderId, userId, paymentDto);
  }

  @Get(':orderId/confirmation')
  @ApiOperation({
    summary: 'Get order confirmation',
    description: 'Get order confirmation details after successful payment'
  })
  @ApiResponse({
    status: 200,
    description: 'Order confirmation retrieved'
  })
  async getOrderConfirmation(@Param('orderId') orderId: string, @CurrentUser() user: UserPayload) {
    const userId = user.userId;
    return this.ordersService.getOrderById(orderId, userId);
  }
}
