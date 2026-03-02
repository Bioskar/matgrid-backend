import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './controller/orders.controller.ts';
import { OrdersService } from './service/orders.service.ts';
import { Order } from './entities/order.entity.ts';
import { OrderItem } from './entities/order-item.entity.ts';
import { LoggerProviderModule } from '../../common/modules/logger.module.ts';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    LoggerProviderModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
