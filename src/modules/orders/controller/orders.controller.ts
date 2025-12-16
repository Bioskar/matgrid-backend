import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../service/orders.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateOrderDto, ProcessPaymentDto } from '../dto/create-order.dto';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create order from selected suppliers',
    description: 'Create order with items from multiple suppliers after quote selection'
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
  async createOrder(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.ordersService.createOrder(userId, createOrderDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user orders',
    description: 'Retrieve all orders for authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully'
  })
  async getUserOrders(@Req() req: any) {
    const userId = req.user.userId;
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
  async getOrderById(@Param('orderId') orderId: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.ordersService.getOrderById(orderId, userId);
  }

  @Post(':orderId/pay')
  @ApiOperation({
    summary: 'Process payment for order',
    description: 'Complete payment for an order using selected payment method'
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
    @Req() req: any
  ) {
    const userId = req.user.userId;
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
  async getOrderConfirmation(@Param('orderId') orderId: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.ordersService.getOrderById(orderId, userId);
  }
}
