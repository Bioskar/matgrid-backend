import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { EscrowTransaction } from '../../Admin/entities/escrow-transaction.entity';
import { CreateOrderDto, ProcessPaymentDto } from '../dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(EscrowTransaction)
    private escrowRepository: Repository<EscrowTransaction>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `#${timestamp.slice(-6)}${random}`;
  }

  /**
   * Create order from selected supplier quotes
   */
  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const { items, quoteId, contactName, contactPhone, deliveryAddress, deliveryNotes } = createOrderDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.pricePerUnit * item.quantity);
    }, 0);

    const deliveryFee = 50000; // ₦50,000 flat delivery fee
    const serviceFee = 25000;  // ₦25,000 service fee
    const totalAmount = subtotal + deliveryFee + serviceFee;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order
    const order = this.orderRepository.create({
      orderNumber,
      userId,
      quoteId,
      subtotal,
      deliveryFee,
      serviceFee,
      totalAmount,
      currency: 'NGN',
      status: 'pending',
      paymentStatus: 'pending',
      contactName,
      contactPhone,
      deliveryAddress,
      deliveryNotes,
    });

    await this.orderRepository.save(order);

    // Create order items
    const orderItems = items.map(item => {
      const totalPrice = item.pricePerUnit * item.quantity;
      
      return this.orderItemRepository.create({
        orderId: order.id,
        supplierId: item.supplierId,
        materialId: item.materialId,
        itemName: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        totalPrice,
        deliveryTime: item.deliveryTime,
        availability: item.availability,
        status: 'pending',
      });
    });

    await this.orderItemRepository.save(orderItems);

    this.logger.info(
      { orderId: order.id, userId, orderNumber, totalAmount, itemsCount: items.length },
      'Order created successfully'
    );

    return {
      success: true,
      message: 'Order created successfully',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        subtotal,
        deliveryFee,
        serviceFee,
        totalAmount,
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentStatus,
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        deliveryAddress: order.deliveryAddress,
        items: orderItems.map(item => ({
          id: item.id,
          supplierId: item.supplierId,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          deliveryTime: item.deliveryTime,
        })),
        createdAt: order.createdAt,
      },
    };
  }

  /**
   * Get order by ID with items
   */
  async getOrderById(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.supplier'],
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    return {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        serviceFee: order.serviceFee,
        totalAmount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        transactionReference: order.transactionReference,
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        paidAt: order.paidAt,
        items: order.items.map(item => ({
          id: item.id,
          supplier: {
            id: item.supplier.userId,
            name: item.supplier.name,
          },
          itemName: item.itemName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          deliveryTime: item.deliveryTime,
          availability: item.availability,
          status: item.status,
        })),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    };
  }

  /**
   * Process payment for order
   * TODO: Integrate with payment gateway (Paystack, Flutterwave, etc.)
   */
  async processPayment(orderId: string, userId: string, paymentDto: ProcessPaymentDto) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.supplier', 'user'],
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.paymentStatus === 'completed') {
      throw new BadRequestException('Order already paid');
    }

    // TODO: Integrate with actual payment gateway
    // For now, simulate payment processing
    const transactionReference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Update order
    order.paymentStatus = 'completed';
    order.paymentMethod = paymentDto.paymentMethod;
    order.transactionReference = transactionReference;
    order.status = 'paid';
    order.escrowStatus = 'funds_held';
    order.paidAt = new Date();

    await this.orderRepository.save(order);

    // Update order items status
    await this.orderItemRepository.update(
      { orderId: order.id },
      { status: 'confirmed' }
    );

    // Create one EscrowTransaction per unique supplier
    const contractorName = order.user?.fullName || order.user?.company || 'Unknown';
    const supplierTotals = new Map<string, { supplier: any; total: number }>();

    for (const item of order.items || []) {
      if (!item.supplierId) continue;
      const existing = supplierTotals.get(item.supplierId);
      if (existing) {
        existing.total += Number(item.totalPrice);
      } else {
        supplierTotals.set(item.supplierId, {
          supplier: item.supplier,
          total: Number(item.totalPrice),
        });
      }
    }

    const escrowRecords = [...supplierTotals.entries()].map(([supplierId, { supplier, total }]) =>
      this.escrowRepository.create({
        orderId: order.id,
        orderNumber: order.orderNumber,
        contractorId: userId,
        contractorName,
        supplierId,
        supplierName: supplier?.name || 'Unknown',
        amount: total,
        currency: order.currency,
        escrowStatus: 'held',
        deliveryStatus: 'in_transit',
      }),
    );

    if (escrowRecords.length > 0) {
      await this.escrowRepository.save(escrowRecords);
    }

    this.logger.info(
      { orderId, userId, transactionReference, amount: order.totalAmount, escrowCount: escrowRecords.length },
      'Payment processed successfully'
    );

    return {
      success: true,
      message: 'Payment processed successfully',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        transactionReference: order.transactionReference,
        paidAt: order.paidAt,
      },
    };
  }

  /**
   * Get user orders
   */
  async getUserOrders(userId: string) {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentStatus,
        itemsCount: order.items?.length || 0,
        createdAt: order.createdAt,
      })),
      count: orders.length,
    };
  }
}
