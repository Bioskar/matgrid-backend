import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Logger } from 'pino';
import { User, UserRole } from '../../auth/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Contractor } from '../../contractors/entities/contractor.entity';
import { KycDocument, VerificationStatus } from '../../kyc/entities/kyc-document.entity';
import { EscrowTransaction } from '../entities/escrow-transaction.entity';
import { PlatformSettings } from '../entities/platform-settings.entity';
import { UpdatePlatformSettingsDto, ListQueryDto, RejectKycDto, ResolveDisputeDto, ReleaseEscrowDto } from '../dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Contractor)
    private readonly contractorRepo: Repository<Contractor>,
    @InjectRepository(KycDocument)
    private readonly kycRepo: Repository<KycDocument>,
    @InjectRepository(EscrowTransaction)
    private readonly escrowRepo: Repository<EscrowTransaction>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly dataSource: DataSource,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ────────────────────────────────────────────────────────────────────────────

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      gtvResult,
      escrowBalanceResult,
      activeOrdersCount,
      activeSuppliersCount,
      pendingEscrowCount,
      newSupplierAppsCount,
      disputesCount,
      recentOrders,
    ] = await Promise.all([
      // GTV: sum of paid/completed orders this month
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.totalAmount), 0)', 'gtv')
        .where('o.status IN (:...statuses)', { statuses: ['paid', 'delivered', 'completed'] })
        .andWhere('o.createdAt >= :start', { start: startOfMonth })
        .getRawOne(),

      // Escrow balance: sum of held escrow transactions
      this.escrowRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount), 0)', 'balance')
        .where('e.escrowStatus = :status', { status: 'held' })
        .getRawOne(),

      // Active orders
      this.orderRepo.count({
        where: [
          { status: 'paid' },
          { status: 'processing' },
          { status: 'shipped' },
        ],
      }),

      // Active suppliers
      this.supplierRepo.count({ where: { isActive: true, verificationStatus: 'verified' as any } }),

      // Pending escrow releases
      this.escrowRepo.count({ where: { escrowStatus: 'held' } }),

      // New supplier applications (pending verification)
      this.supplierRepo.count({ where: { verificationStatus: 'pending' as any } }),

      // Disputes
      this.orderRepo.count({ where: { status: 'disputed' } }),

      // Recent orders
      this.orderRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.user', 'u')
        .orderBy('o.createdAt', 'DESC')
        .limit(10)
        .getMany(),
    ]);

    const recentOrdersMapped = recentOrders.map((o) => ({
      orderId: o.orderNumber,
      contractor: o.user?.fullName || o.user?.company || 'N/A',
      amount: Number(o.totalAmount),
      currency: o.currency,
      status: this.mapOrderStatus(o.status),
      escrowStatus: o.escrowStatus,
      createdAt: o.createdAt,
    }));

    return {
      stats: {
        gtvThisMonth: Number(gtvResult?.gtv || 0),
        escrowBalance: Number(escrowBalanceResult?.balance || 0),
        activeOrders: activeOrdersCount,
        activeSuppliers: activeSuppliersCount,
      },
      actionCenter: {
        pendingTransfers: pendingEscrowCount,
        newSupplierApps: newSupplierAppsCount,
        orderDisputes: disputesCount,
      },
      recentOrders: recentOrdersMapped,
      systemHealth: {
        paymentGateway: 'operational',
        matchingEngine: 'operational',
        notificationService: 'operational',
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RFQ MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────────

  async getRfqStats() {
    const [total, awaitingSelection, awarded, expired] = await Promise.all([
      this.quoteRepo.count(),
      this.quoteRepo.count({ where: { status: 'in-review' } }),
      this.quoteRepo.count({ where: { status: 'finalized' } }),
      this.quoteRepo.count({ where: { status: 'archived' } }),
    ]);
    return { total, awaitingSelection, awarded, expiredOrCancelled: expired };
  }

  async getRfqs(query: ListQueryDto) {
    const { page = 1, limit = 20, status, search } = query;

    const qb = this.quoteRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.user', 'u')
      .leftJoinAndSelect('q.materials', 'm')
      .orderBy('q.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      const backendStatus = this.mapRfqStatusToBackend(status);
      if (backendStatus) qb.andWhere('q.status = :status', { status: backendStatus });
    }

    if (search) {
      qb.andWhere('(u.fullName ILIKE :search OR u.company ILIKE :search OR q.title ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [rfqs, total] = await qb.getManyAndCount();

    const data = rfqs.map((q) => {
      const timeLeft = q.deadline
        ? Math.max(0, Math.ceil((q.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
      return {
        rfqId: q.id,
        contractor: q.user?.fullName || q.user?.company || 'N/A',
        contractorEmail: q.user?.email,
        title: q.title,
        itemsCount: q.materialsCount || (q.materials?.length ?? 0),
        quotesCount: q.suppliersCount,
        deadline: q.deadline,
        timeLeftDays: timeLeft,
        status: this.mapRfqStatus(q.status),
        createdAt: q.createdAt,
      };
    });

    return { data, total, page, limit };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ORDER MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────────

  async getOrderStats() {
    const [active, disputed, completed] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.status IN (:...s)', { s: ['paid', 'processing', 'shipped'] })
        .getCount(),
      this.orderRepo.count({ where: { status: 'disputed' } }),
      this.orderRepo.count({ where: { status: 'completed' } }),
    ]);
    return { active, disputed, completed };
  }

  async getOrders(query: ListQueryDto) {
    const { page = 1, limit = 20, status, search } = query;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.items', 'i')
      .leftJoinAndSelect('i.supplier', 's')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      if (status === 'active') {
        qb.andWhere('o.status IN (:...s)', { s: ['paid', 'processing', 'shipped'] });
      } else if (status === 'disputed') {
        qb.andWhere('o.status = :s', { s: 'disputed' });
      } else if (status === 'completed') {
        qb.andWhere('o.status = :s', { s: 'completed' });
      }
    }

    if (search) {
      qb.andWhere('(o.orderNumber ILIKE :search OR u.fullName ILIKE :search OR u.company ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [orders, total] = await qb.getManyAndCount();

    const data = orders.map((o) => {
      const supplierNames = [
        ...new Set((o.items || []).map((i) => i.supplier?.name).filter(Boolean)),
      ];
      return {
        orderId: o.orderNumber,
        contractor: o.user?.fullName || o.user?.company || 'N/A',
        contractorEmail: o.user?.email,
        suppliers: supplierNames,
        amount: Number(o.totalAmount),
        currency: o.currency,
        status: this.mapOrderStatus(o.status),
        escrowStatus: o.escrowStatus,
        createdAt: o.createdAt,
        id: o.id,
      };
    });

    return { data, total, page, limit };
  }

  async resolveDispute(orderId: string, dto: ResolveDisputeDto) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'disputed') {
      throw new BadRequestException('Order is not in disputed status');
    }
    order.status = 'processing';
    await this.orderRepo.save(order);
    this.logger.info({ orderId, resolution: dto.resolution }, 'Admin resolved order dispute');
    return { message: 'Dispute resolved. Order moved back to processing.' };
  }

  async releaseOrderEscrow(orderId: string, dto: ReleaseEscrowDto) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.escrowStatus !== 'funds_held') {
      throw new BadRequestException('No funds held in escrow for this order');
    }

    const escrow = await this.escrowRepo.findOne({ where: { orderId } });

    await this.dataSource.transaction(async (em) => {
      order.escrowStatus = 'released_to_client';
      await em.save(order);
      if (escrow) {
        escrow.escrowStatus = 'released';
        escrow.releasedAt = new Date();
        escrow.releaseNotes = dto.notes;
        await em.save(escrow);
      }
    });

    this.logger.info({ orderId }, 'Admin released escrow for order');
    return { message: 'Escrow funds released successfully.' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CONTRACTORS
  // ────────────────────────────────────────────────────────────────────────────

  async getContractorStats() {
    const [total, active, pending, suspended] = await Promise.all([
      this.contractorRepo.count(),
      this.contractorRepo.count({ where: { status: 'active' } }),
      this.contractorRepo.count({ where: { status: 'pending' } }),
      this.contractorRepo.count({ where: { status: 'suspended' } }),
    ]);
    return { total, active, pending, suspended };
  }

  async getContractors(query: ListQueryDto) {
    const { page = 1, limit = 20, status, search } = query;

    const qb = this.contractorRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && ['active', 'pending', 'suspended'].includes(status)) {
      qb.andWhere('c.status = :status', { status });
    }

    if (search) {
      qb.andWhere('(c.fullName ILIKE :search OR c.company ILIKE :search OR u.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [contractors, total] = await qb.getManyAndCount();

    const contractorIds = contractors.map((c) => c.userId);

    // Get order counts and total contract values per contractor
    const orderStats = contractorIds.length
      ? await this.orderRepo
          .createQueryBuilder('o')
          .select('o.userId', 'userId')
          .addSelect('COUNT(o.id)', 'orderCount')
          .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'contractValue')
          .where('o.userId IN (:...ids)', { ids: contractorIds })
          .groupBy('o.userId')
          .getRawMany()
      : [];

    const statsMap = new Map(
      orderStats.map((s) => [s.userId, { orderCount: Number(s.orderCount), contractValue: Number(s.contractValue) }]),
    );

    const data = contractors.map((c) => ({
      id: c.userId,
      name: c.fullName,
      email: c.user?.email,
      company: c.company,
      status: c.status,
      ordersCount: statsMap.get(c.userId)?.orderCount || 0,
      contractValue: statsMap.get(c.userId)?.contractValue || 0,
      createdAt: c.createdAt,
    }));

    return { data, total, page, limit };
  }

  async suspendContractor(contractorId: string) {
    const contractor = await this.contractorRepo.findOne({ where: { userId: contractorId } });
    if (!contractor) throw new NotFoundException('Contractor not found');
    if (contractor.status === 'suspended') {
      throw new BadRequestException('Contractor is already suspended');
    }

    await this.dataSource.transaction(async (em) => {
      contractor.status = 'suspended';
      contractor.isActive = false;
      await em.save(contractor);
      await em.update(User, { id: contractorId }, { isActive: false });
    });

    this.logger.info({ contractorId }, 'Admin suspended contractor');
    return { message: 'Contractor suspended successfully.' };
  }

  async reactivateContractor(contractorId: string) {
    const contractor = await this.contractorRepo.findOne({ where: { userId: contractorId } });
    if (!contractor) throw new NotFoundException('Contractor not found');
    if (contractor.status === 'active') {
      throw new BadRequestException('Contractor is already active');
    }

    await this.dataSource.transaction(async (em) => {
      contractor.status = 'active';
      contractor.isActive = true;
      await em.save(contractor);
      await em.update(User, { id: contractorId }, { isActive: true });
    });

    this.logger.info({ contractorId }, 'Admin reactivated contractor');
    return { message: 'Contractor reactivated successfully.' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUPPLIERS
  // ────────────────────────────────────────────────────────────────────────────

  async getSupplierStats() {
    const [total, active, pending, suspended] = await Promise.all([
      this.supplierRepo.count(),
      this.supplierRepo.count({ where: { isActive: true, verificationStatus: 'verified' as any } }),
      this.supplierRepo.count({ where: { verificationStatus: 'pending' as any } }),
      this.supplierRepo.count({ where: { isActive: false } }),
    ]);
    return { total, active, pending, suspended };
  }

  async getSuppliers(query: ListQueryDto) {
    const { page = 1, limit = 20, status, search } = query;

    const qb = this.supplierRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status === 'active') {
      qb.andWhere('s.isActive = true AND s.verificationStatus = :vs', { vs: 'verified' });
    } else if (status === 'pending') {
      qb.andWhere('s.verificationStatus = :vs', { vs: 'pending' });
    } else if (status === 'suspended') {
      qb.andWhere('s.isActive = false');
    }

    if (search) {
      qb.andWhere('(s.name ILIKE :search OR u.email ILIKE :search)', { search: `%${search}%` });
    }

    const [suppliers, total] = await qb.getManyAndCount();

    const supplierIds = suppliers.map((s) => s.userId);

    const orderStats = supplierIds.length
      ? await this.orderRepo
          .createQueryBuilder('o')
          .innerJoin('o.items', 'i')
          .select('i.supplierId', 'supplierId')
          .addSelect('COUNT(DISTINCT o.id)', 'orderCount')
          .where('i.supplierId IN (:...ids)', { ids: supplierIds })
          .groupBy('i.supplierId')
          .getRawMany()
      : [];

    const statsMap = new Map(orderStats.map((s) => [s.supplierId, Number(s.orderCount)]));

    const data = suppliers.map((s) => ({
      id: s.userId,
      name: s.name,
      email: s.user?.email,
      rating: Number(s.rating),
      status: this.mapSupplierStatus(s),
      verificationStatus: s.verificationStatus,
      ordersCount: statsMap.get(s.userId) || 0,
      createdAt: s.createdAt,
    }));

    return { data, total, page, limit };
  }

  async suspendSupplier(supplierId: string) {
    const supplier = await this.supplierRepo.findOne({ where: { userId: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    await this.dataSource.transaction(async (em) => {
      supplier.isActive = false;
      await em.save(supplier);
      await em.update(User, { id: supplierId }, { isActive: false });
    });

    this.logger.info({ supplierId }, 'Admin suspended supplier');
    return { message: 'Supplier suspended successfully.' };
  }

  async reactivateSupplier(supplierId: string) {
    const supplier = await this.supplierRepo.findOne({ where: { userId: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    await this.dataSource.transaction(async (em) => {
      supplier.isActive = true;
      await em.save(supplier);
      await em.update(User, { id: supplierId }, { isActive: true });
    });

    this.logger.info({ supplierId }, 'Admin reactivated supplier');
    return { message: 'Supplier reactivated successfully.' };
  }

  async reviewSupplier(supplierId: string, action: 'approve' | 'reject', reason?: string) {
    const supplier = await this.supplierRepo.findOne({ where: { userId: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    if (action === 'approve') {
      supplier.verificationStatus = 'verified';
      supplier.isActive = true;
    } else {
      supplier.verificationStatus = 'rejected';
      supplier.isActive = false;
    }

    await this.supplierRepo.save(supplier);
    this.logger.info({ supplierId, action }, 'Admin reviewed supplier');
    return { message: `Supplier ${action === 'approve' ? 'approved' : 'rejected'} successfully.` };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FINANCE & ESCROW
  // ────────────────────────────────────────────────────────────────────────────

  async getFinanceStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [heldResult, releasedTodayResult, pendingCount, disputedCount] = await Promise.all([
      this.escrowRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount), 0)', 'total')
        .where('e.escrowStatus = :s', { s: 'held' })
        .getRawOne(),

      this.escrowRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount), 0)', 'total')
        .where('e.escrowStatus = :s', { s: 'released' })
        .andWhere('e.releasedAt >= :today', { today: todayStart })
        .getRawOne(),

      this.escrowRepo.count({ where: { escrowStatus: 'held' } }),
      this.escrowRepo.count({ where: { escrowStatus: 'disputed' } }),
    ]);

    return {
      totalHeldInEscrow: Number(heldResult?.total || 0),
      releasedToday: Number(releasedTodayResult?.total || 0),
      pendingRelease: pendingCount,
      underDispute: disputedCount,
    };
  }

  async getEscrowTransactions(query: ListQueryDto) {
    const { page = 1, limit = 20, status, search } = query;

    const qb = this.escrowRepo
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && ['held', 'released', 'disputed'].includes(status)) {
      qb.andWhere('e.escrowStatus = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(e.escrowId ILIKE :search OR e.orderNumber ILIKE :search OR e.contractorName ILIKE :search OR e.supplierName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [transactions, total] = await qb.getManyAndCount();

    const data = transactions.map((t) => ({
      escrowId: t.escrowId,
      orderId: t.orderNumber,
      contractor: t.contractorName,
      supplier: t.supplierName,
      amount: Number(t.amount),
      currency: t.currency,
      deliveryStatus: this.mapDeliveryStatus(t.deliveryStatus),
      escrowStatus: this.mapEscrowStatus(t.escrowStatus),
      releasedAt: t.releasedAt,
      createdAt: t.createdAt,
      id: t.id,
      orderId_raw: t.orderId,
    }));

    return { data, total, page, limit };
  }

  async releaseEscrowFunds(escrowId: string, dto: ReleaseEscrowDto) {
    const escrow = await this.escrowRepo.findOne({ where: { id: escrowId } });
    if (!escrow) throw new NotFoundException('Escrow transaction not found');
    if (escrow.escrowStatus !== 'held') {
      throw new BadRequestException('Escrow funds are not in held status');
    }

    await this.dataSource.transaction(async (em) => {
      escrow.escrowStatus = 'released';
      escrow.releasedAt = new Date();
      escrow.releaseNotes = dto.notes;
      await em.save(escrow);

      // Update order escrow status
      await em.update(Order, { id: escrow.orderId }, { escrowStatus: 'released_to_client' });
    });

    this.logger.info({ escrowId }, 'Admin released escrow funds');
    return { message: 'Escrow funds released successfully.' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // KYC
  // ────────────────────────────────────────────────────────────────────────────

  async getKycStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.kycRepo
        .createQueryBuilder('k')
        .select('COUNT(DISTINCT k.userId)', 'count')
        .getRawOne(),
      this.kycRepo
        .createQueryBuilder('k')
        .select('COUNT(DISTINCT k.userId)', 'count')
        .where('k.verificationStatus = :s', { s: VerificationStatus.PENDING })
        .getRawOne(),
      this.kycRepo
        .createQueryBuilder('k')
        .select('COUNT(DISTINCT k.userId)', 'count')
        .where('k.verificationStatus = :s', { s: VerificationStatus.VERIFIED })
        .getRawOne(),
      this.kycRepo
        .createQueryBuilder('k')
        .select('COUNT(DISTINCT k.userId)', 'count')
        .where('k.verificationStatus = :s', { s: VerificationStatus.REJECTED })
        .getRawOne(),
    ]);

    return {
      total: Number(total?.count || 0),
      pending: Number(pending?.count || 0),
      approved: Number(approved?.count || 0),
      rejected: Number(rejected?.count || 0),
    };
  }

  async getKycSubmissions(query: ListQueryDto) {
    const { page = 1, limit = 20, status, search } = query;

    // Get unique userIds with their document counts grouped
    const qb = this.kycRepo
      .createQueryBuilder('k')
      .leftJoinAndSelect('k.user', 'u')
      .orderBy('k.createdAt', 'DESC');

    if (status) {
      const mappedStatus = this.mapKycStatusToBackend(status);
      if (mappedStatus) qb.andWhere('k.verificationStatus = :s', { s: mappedStatus });
    }

    if (search) {
      qb.andWhere('(u.fullName ILIKE :search OR u.email ILIKE :search)', { search: `%${search}%` });
    }

    const allDocs = await qb.getMany();

    // Group by userId
    const grouped = new Map<
      string,
      { user: User; docs: KycDocument[]; latestStatus: VerificationStatus; submittedAt: Date }
    >();

    for (const doc of allDocs) {
      if (!grouped.has(doc.userId)) {
        grouped.set(doc.userId, {
          user: doc.user,
          docs: [],
          latestStatus: doc.verificationStatus,
          submittedAt: doc.createdAt,
        });
      }
      grouped.get(doc.userId)!.docs.push(doc);
    }

    const entries = [...grouped.values()];
    const total = entries.length;
    const paginated = entries.slice((page - 1) * limit, page * limit);

    const data = paginated.map((entry) => ({
      userId: entry.user?.id,
      supplier: entry.user?.fullName || entry.user?.email || 'N/A',
      email: entry.user?.email,
      documentsCount: entry.docs.length,
      submittedAt: entry.submittedAt,
      status: this.mapKycStatus(entry.latestStatus),
    }));

    return { data, total, page, limit };
  }

  async approveKyc(userId: string) {
    const docs = await this.kycRepo.find({ where: { userId } });
    if (!docs.length) throw new NotFoundException('No KYC documents found for this user');

    await this.kycRepo.update({ userId }, {
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedAt: new Date(),
    });

    // Update supplier verification status
    const supplier = await this.supplierRepo.findOne({ where: { userId } });
    if (supplier) {
      supplier.verificationStatus = 'verified';
      supplier.isActive = true;
      await this.supplierRepo.save(supplier);
    }

    this.logger.info({ userId }, 'Admin approved KYC');
    return { message: 'KYC approved successfully.' };
  }

  async rejectKyc(userId: string, dto: RejectKycDto) {
    const docs = await this.kycRepo.find({ where: { userId } });
    if (!docs.length) throw new NotFoundException('No KYC documents found for this user');

    await this.kycRepo.update({ userId }, {
      verificationStatus: VerificationStatus.REJECTED,
      rejectionReason: dto.reason,
    });

    const supplier = await this.supplierRepo.findOne({ where: { userId } });
    if (supplier) {
      supplier.verificationStatus = 'rejected';
      supplier.isActive = false;
      await this.supplierRepo.save(supplier);
    }

    this.logger.info({ userId, reason: dto.reason }, 'Admin rejected KYC');
    return { message: 'KYC rejected.' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PLATFORM SETTINGS
  // ────────────────────────────────────────────────────────────────────────────

  async getSettings() {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create({});
      await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create({});
    }
    Object.assign(settings, dto);
    await this.settingsRepo.save(settings);
    this.logger.info({ dto }, 'Admin updated platform settings');
    return settings;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PRIVATE MAPPERS
  // ────────────────────────────────────────────────────────────────────────────

  private mapOrderStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'pending',
      paid: 'payment received',
      processing: 'processing',
      shipped: 'in transit',
      delivered: 'delivered',
      cancelled: 'cancelled',
      disputed: 'disputed',
      completed: 'completed',
    };
    return map[status] || status;
  }

  private mapRfqStatus(status: string): string {
    const map: Record<string, string> = {
      draft: 'active',
      'in-review': 'quotes received',
      finalized: 'awarded',
      archived: 'expired',
    };
    return map[status] || status;
  }

  private mapRfqStatusToBackend(frontendStatus: string): string | null {
    const map: Record<string, string> = {
      active: 'draft',
      quoted: 'in-review',
      awarded: 'finalized',
      expired: 'archived',
    };
    return map[frontendStatus] || null;
  }

  private mapSupplierStatus(supplier: Supplier): string {
    if (!supplier.isActive) return 'suspended';
    if (supplier.verificationStatus === 'pending') return 'pending';
    if (supplier.verificationStatus === 'verified') return 'active';
    return 'pending';
  }

  private mapDeliveryStatus(status: string): string {
    const map: Record<string, string> = {
      in_transit: 'in transit',
      delivered: 'delivered',
      delivery_confirmed: 'delivery confirmed',
      awaiting_confirmation: 'delivered - awaiting confirmation',
    };
    return map[status] || status;
  }

  private mapEscrowStatus(status: string): string {
    const map: Record<string, string> = {
      held: 'held in escrow',
      released: 'released',
      disputed: 'disputed',
    };
    return map[status] || status;
  }

  private mapKycStatus(status: VerificationStatus): string {
    const map: Record<string, string> = {
      [VerificationStatus.PENDING]: 'pending review',
      [VerificationStatus.UNDER_REVIEW]: 'pending review',
      [VerificationStatus.VERIFIED]: 'verified',
      [VerificationStatus.REJECTED]: 'resubmitted',
    };
    return map[status] || status;
  }

  private mapKycStatusToBackend(frontendStatus: string): VerificationStatus | null {
    const map: Record<string, VerificationStatus> = {
      pending: VerificationStatus.PENDING,
      verified: VerificationStatus.VERIFIED,
      resubmitted: VerificationStatus.REJECTED,
    };
    return map[frontendStatus] || null;
  }
}
