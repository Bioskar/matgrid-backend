import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Contractor } from '../entities/contractor.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { Material } from '../../quotes/entities/material.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { SupplierQuote } from '../../suppliers/entities/supplier-quote.entity';
import { Order } from '../../orders/entities/order.entity';
import { CreateContractorProjectDto } from '../dto/create-contractor-project.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(Contractor)
    private contractorRepository: Repository<Contractor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @InjectRepository(SupplierQuote)
    private supplierQuoteRepository: Repository<SupplierQuote>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  async getOrCreateContractor(userId: string): Promise<Contractor> {
    let contractor = await this.contractorRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!contractor) {
      const user = await this.userRepository.findOne({
        where: { id: userId, userRole: UserRole.CONTRACTOR },
      });

      if (!user) {
        throw new NotFoundException('User not found or not a contractor');
      }

      contractor = this.contractorRepository.create({
        userId: user.id,
        fullName: user.fullName,
        company: user.company,
        profilePhoto: user.profilePhoto,
      });

      contractor = await this.contractorRepository.save(contractor);
      contractor.user = user;
    }

    return contractor;
  }

  async getContractorProfile(userId: string): Promise<any> {
    const contractor = await this.getOrCreateContractor(userId);
    
    return {
      id: contractor.userId,
      email: contractor.user.email,
      phoneNumber: contractor.user.phoneNumber,
      fullName: contractor.fullName,
      company: contractor.company,
      profilePhoto: contractor.profilePhoto,
      businessAddress: contractor.businessAddress,
      preferences: contractor.preferences,
      isEmailVerified: contractor.user.isEmailVerified,
      isPhoneVerified: contractor.user.isPhoneVerified,
      isActive: contractor.isActive,
      createdAt: contractor.createdAt,
      updatedAt: contractor.updatedAt,
    };
  }

  async updateContractorProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<any> {
    const contractor = await this.getOrCreateContractor(userId);

    // Update contractor-specific fields
    if (updateDto.fullName) contractor.fullName = updateDto.fullName;
    if (updateDto.company) contractor.company = updateDto.company;
    if (updateDto.profilePhoto) contractor.profilePhoto = updateDto.profilePhoto;

    await this.contractorRepository.save(contractor);

    // Update user fields if provided
    if (updateDto.email) {
      contractor.user.email = updateDto.email;
      await this.userRepository.save(contractor.user);
    }

    return this.getContractorProfile(userId);
  }

  async getContractorMaterials(userId: string): Promise<Material[]> {
    const quotes = await this.quoteRepository.find({
      where: { userId },
      select: ['id'],
    });

    if (quotes.length === 0) {
      return [];
    }

    const quoteIds = quotes.map(q => q.id);
    
    return await this.materialRepository
      .createQueryBuilder('material')
      .where('material.quoteId IN (:...quoteIds)', { quoteIds })
      .andWhere('material.isActive = :isActive', { isActive: true })
      .orderBy('material.createdAt', 'DESC')
      .getMany();
  }

  async getContractorQuotes(userId: string): Promise<Quote[]> {
    return await this.quoteRepository.find({
      where: { userId },
      relations: ['materials'],
      order: { createdAt: 'DESC' },
    });
  }

  async getQuoteWithSupplierQuotes(
    userId: string,
    quoteId: string,
  ): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId, userId },
      relations: ['materials'],
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier', 'items'],
      order: { createdAt: 'DESC' },
    });

    return { ...quote, supplierQuotes } as any;
  }

  async getContractorOrders(userId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getContractorDashboardStats(userId: string): Promise<any> {
    const quotes = await this.quoteRepository.find({
      where: { userId },
      select: ['id'],
    });

    const quoteIds = quotes.map(q => q.id);
    
    let materialsCount = 0;
    if (quoteIds.length > 0) {
      materialsCount = await this.materialRepository
        .createQueryBuilder('material')
        .where('material.quoteId IN (:...quoteIds)', { quoteIds })
        .andWhere('material.isActive = :isActive', { isActive: true })
        .getCount();
    }

    const [quotesCount, ordersCount] = await Promise.all([
      this.quoteRepository.count({ where: { userId } }),
      this.orderRepository.count({ where: { userId } }),
    ]);

    const pendingOrders = await this.orderRepository.count({
      where: { userId, status: 'pending' },
    });

    const totalSpent = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.userId = :userId', { userId })
      .andWhere('order.paymentStatus = :status', { status: 'paid' })
      .getRawOne();

    return {
      materialsCount,
      quotesCount,
      ordersCount,
      pendingOrdersCount: pendingOrders,
      totalSpent: parseFloat(totalSpent?.total || '0'),
    };
  }

  async getActiveQuotes(userId: string): Promise<Quote[]> {
    return await this.quoteRepository.find({
      where: { userId, status: 'in-review' },
      relations: ['materials'],
      order: { createdAt: 'DESC' },
    });
  }

  async searchMaterials(userId: string, searchTerm: string): Promise<Material[]> {
    const quotes = await this.quoteRepository.find({
      where: { userId },
      select: ['id'],
    });

    if (quotes.length === 0) {
      return [];
    }

    const quoteIds = quotes.map(q => q.id);

    return await this.materialRepository
      .createQueryBuilder('material')
      .where('material.quoteId IN (:...quoteIds)', { quoteIds })
      .andWhere('material.isActive = :isActive', { isActive: true })
      .andWhere(
        '(LOWER(material.name) LIKE LOWER(:search) OR LOWER(material.category) LIKE LOWER(:search))',
        { search: `%${searchTerm}%` },
      )
      .orderBy('material.createdAt', 'DESC')
      .getMany();
  }
}
