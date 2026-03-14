import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './controller/admin.controller';
import { AdminService } from './service/admin.service';
import { EscrowTransaction } from './entities/escrow-transaction.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { User } from '../auth/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Contractor } from '../contractors/entities/contractor.entity';
import { KycDocument } from '../kyc/entities/kyc-document.entity';
import { LoggerProviderModule } from '../../common/modules/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Order,
      Quote,
      Supplier,
      Contractor,
      KycDocument,
      EscrowTransaction,
      PlatformSettings,
    ]),
    LoggerProviderModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
