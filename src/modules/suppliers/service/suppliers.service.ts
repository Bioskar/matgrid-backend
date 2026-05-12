import { Injectable, BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import pino from 'pino';
import { Supplier } from '../entities/supplier.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { SupplierQuote } from '../entities/supplier-quote.entity';
import { Material } from '../../quotes/entities/material.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SupplierQuote)
    private supplierQuoteRepository: Repository<SupplierQuote>,
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
    private notificationsService: NotificationsService,
  ) {}

  async getOrCreateSupplier(userId: string): Promise<Supplier> {
    this.logger.info(
      { userId },
      '[Suppliers] Getting or creating supplier profile'
    );

    let supplier = await this.supplierRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!supplier) {
      const user = await this.userRepository.findOne({
        where: { id: userId, userRole: UserRole.SUPPLIER },
      });

      if (!user) {
        this.logger.warn({ userId }, '[Suppliers] User not found or not a supplier');
        throw new NotFoundException('User not found or not a supplier');
      }

      supplier = this.supplierRepository.create({
        userId: user.id,
        name: user.company || user.fullName,
        ownerName: user.fullName,
        materialCategories: [],
        specialization: [],
      });

      supplier = await this.supplierRepository.save(supplier);
      supplier.user = user;

      this.logger.info(
        { userId, supplierName: supplier.name },
        '[Suppliers] Supplier profile created'
      );
    }

    return supplier;
  }

  /**
   * Search suppliers based on quote materials
   * Matches suppliers by material categories
   */
  async searchSuppliers(quoteId: string, filters: any = {}) {
    const materials = await this.materialRepository.find({ where: { quoteId } });

    if (materials.length === 0) {
      this.logger.warn({ quoteId }, '[Suppliers] No materials found in quote');
      throw new BadRequestException('No materials found in quote');
    }

    const categories = materials
      .map((m) => m.category)
      .filter((c) => c);

    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.isActive = :isActive', { isActive: true });

    if (categories.length > 0) {
      queryBuilder.andWhere('supplier.specialization && :categories', { categories });
    }

    if (filters.minRating) {
      queryBuilder.andWhere('supplier.rating >= :minRating', { minRating: filters.minRating });
    }

    const suppliers = await queryBuilder
      .orderBy('supplier.rating', 'DESC')
      .limit(20)
      .getMany();

    this.logger.info(
      { quoteId, suppliersFound: suppliers.length, categories },
      '[Suppliers] Supplier search completed'
    );

    return {
      success: true,
      suppliers,
      count: suppliers.length,
    };
  }

  /**
   * Get all active suppliers with optional filters
   */
  async getAllSuppliers(filters: any = {}) {
    this.logger.info(
      { filters },
      '[Suppliers] Fetching all suppliers'
    );

    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.isActive = :isActive', { isActive: true });

    if (filters.specialization) {
      queryBuilder.andWhere(':specialization = ANY(supplier.specialization)', {
        specialization: filters.specialization
      });
    }

    if (filters.minRating) {
      queryBuilder.andWhere('supplier.rating >= :minRating', { minRating: filters.minRating });
    }

    const suppliers = await queryBuilder
      .orderBy('supplier.rating', 'DESC')
      .getMany();

    this.logger.info(
      { suppliersCount: suppliers.length },
      '[Suppliers] Suppliers retrieved'
    );

    return {
      success: true,
      suppliers,
    };
  }

  /**
   * Get supplier details by ID
   */
  async getSupplierDetails(supplierId: string) {
    this.logger.info({ supplierId }, '[Suppliers] Fetching supplier details');

    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });

    if (!supplier) {
      this.logger.warn({ supplierId }, '[Suppliers] Supplier not found');
      throw new BadRequestException('Supplier not found');
    }

    this.logger.info(
      { supplierId, supplierName: supplier.name },
      '[Suppliers] Supplier details retrieved'
    );

    return {
      success: true,
      supplier,
    };
  }

  /**
   * Create a supplier quote with materials pricing
   * Calculates total cost from materials data
   */
  async createSupplierQuote(quoteId: string, supplierId: string, materialsData: any[]) {
    this.logger.info(
      { quoteId, supplierId, materialsCount: materialsData.length },
      '[Suppliers] Creating supplier quote'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });

    if (!quote || !supplier) {
      this.logger.warn(
        { quoteId, supplierId, quoteFound: !!quote, supplierFound: !!supplier },
        '[Suppliers] Quote or Supplier not found'
      );
      throw new BadRequestException('Quote or Supplier not found');
    }

    const totalCost = materialsData.reduce(
      (sum, m) => sum + (m.totalPrice || 0),
      0,
    );

    const supplierQuote = this.supplierQuoteRepository.create({
      quoteId,
      supplierId,
      materials: materialsData,
      status: 'quoted',
      totalCost,
    });

    await this.supplierQuoteRepository.save(supplierQuote);

    quote.suppliersCount = await this.supplierQuoteRepository.count({ where: { quoteId } });
    await this.quoteRepository.save(quote);

    this.logger.info(
      { quoteId, supplierId, supplierQuoteId: supplierQuote.id, totalCost },
      '[Suppliers] Supplier quote created'
    );

    return {
      success: true,
      supplierQuote,
    };
  }

  /**
   * Get all supplier quotes for a quote
   */
  async getSupplierQuotes(quoteId: string) {
    this.logger.info({ quoteId }, '[Suppliers] Fetching supplier quotes');

    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier'],
      order: { totalCost: 'ASC' },
    });

    this.logger.info(
      { quoteId, quotesCount: supplierQuotes.length },
      '[Suppliers] Supplier quotes retrieved'
    );

    return {
      success: true,
      supplierQuotes,
    };
  }

  /**
   * Get supplier quotes grouped by material category for comparison
   */
  async getSupplierQuotesGrouped(quoteId: string) {
    this.logger.info(
      { quoteId },
      '[Suppliers] Fetching grouped supplier quotes for comparison'
    );

    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier'],
    });

    const materials = await this.materialRepository.find({
      where: { quoteId },
    });

    if (supplierQuotes.length === 0) {
      this.logger.warn(
        { quoteId },
        '[Suppliers] No supplier quotes received yet'
      );
      return {
        success: true,
        message: 'No supplier quotes received yet',
        groupedQuotes: [],
        totalEstimate: 0,
      };
    }

    const categorizedMaterials = materials.reduce((acc, material) => {
      const category = material.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(material);
      return acc;
    }, {} as Record<string, any[]>);

    const groupedQuotes = Object.entries(categorizedMaterials).map(([category, categoryMaterials]) => {
      const materialIds = categoryMaterials.map(m => m.id);
      
      const categorySupplierQuotes = supplierQuotes
        .map(sq => {
          const relevantItems = sq.materials.filter(item => 
            materialIds.includes(item.materialId)
          );
          
          if (relevantItems.length === 0) return null;
          
          const subtotal = relevantItems.reduce((sum, item) => 
            sum + (item.totalPrice || 0), 0
          );
          
          return {
            supplierId: sq.supplierId,
            supplierQuoteId: sq.id,
            supplierName: sq.supplier.name,
            location: sq.supplier.shopAddress || 'Not specified',
            rating: sq.supplier.rating || 0,
            deliveryDays: 2,
            stockStatus: 'Available',
            subtotal,
            items: relevantItems.map(item => {
              const material = materials.find(m => m.id === item.materialId);
              return {
                materialId: item.materialId,
                name: material?.name || 'Unknown',
                quantity: material?.quantity || 0,
                unit: material?.unit || 'unit',
                unitPrice: item.unitPrice || 0,
                total: item.totalPrice || 0,
              };
            }),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.subtotal - b!.subtotal);
      
      return {
        category,
        description: `${categoryMaterials.length} ${category} items`,
        materials: categoryMaterials.map(m => ({
          id: m.id,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
        })),
        supplierOptions: categorySupplierQuotes,
        lowestPrice: categorySupplierQuotes[0]?.subtotal || 0,
      };
    });

    const totalEstimate = groupedQuotes.reduce((sum, group) => 
      sum + (group.lowestPrice || 0), 0
    );

    this.logger.info(
      { quoteId, categoriesCount: groupedQuotes.length, totalEstimate, suppliersCount: supplierQuotes.length },
      '[Suppliers] Grouped supplier quotes retrieved'
    );

    return {
      success: true,
      quoteId,
      groupedQuotes,
      totalEstimate,
      currency: 'NGN',
      message: `Found quotes from ${supplierQuotes.length} suppliers across ${groupedQuotes.length} categories`,
    };
  }

  /**
   * Update supplier quote status
   */
  async updateSupplierQuoteStatus(supplierQuoteId: string, status: string) {
    this.logger.info(
      { supplierQuoteId, newStatus: status },
      '[Suppliers] Updating supplier quote status'
    );

    const supplierQuote = await this.supplierQuoteRepository.findOne({
      where: { id: supplierQuoteId }
    });

    if (!supplierQuote) {
      this.logger.warn({ supplierQuoteId }, '[Suppliers] Supplier quote not found');
      throw new BadRequestException('Supplier quote not found');
    }

    const oldStatus = supplierQuote.status;
    supplierQuote.status = status;
    await this.supplierQuoteRepository.save(supplierQuote);

    this.logger.info(
      { supplierQuoteId, oldStatus, newStatus: status },
      '[Suppliers] Supplier quote status updated'
    );

    return {
      success: true,
      supplierQuote,
    };
  }

  /**
   * Get the best (lowest cost) supplier for a quote
   */
  async getBestSupplierForQuote(quoteId: string) {
    this.logger.info(
      { quoteId },
      '[Suppliers] Finding best supplier for quote'
    );

    const quotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier'],
      order: { totalCost: 'ASC' },
    });

    if (quotes.length === 0) {
      this.logger.warn({ quoteId }, '[Suppliers] No supplier quotes found');
      throw new BadRequestException('No supplier quotes found');
    }

    this.logger.info(
      { quoteId, bestSupplier: quotes[0].supplierId, lowestCost: quotes[0].totalCost },
      '[Suppliers] Best supplier identified'
    );

    return {
      success: true,
      bestSupplier: quotes[0],
      allSuppliers: quotes,
    };
  }

  async getIncomingRequests(supplierId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });
    
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

    if (!supplier.materialCategories || supplier.materialCategories.length === 0) {
      return {
        success: true,
        requests: [],
        count: 0,
      };
    }

    const quotes = await this.quoteRepository
      .createQueryBuilder('quote')
      .leftJoinAndSelect('quote.materials', 'material')
      .where('quote.status = :status', { status: 'in-review' })
      .andWhere('material.category IN (:...categories)', { categories: supplier.materialCategories })
      .orderBy('quote.createdAt', 'DESC')
      .limit(50)
      .getMany();

    const requestsWithMatches = quotes.map(quote => {
      const relevantMaterials = quote.materials?.filter(m => 
        supplier.materialCategories.includes(m.category)
      ) || [];

      return {
        id: quote.id,
        title: quote.title,
        description: quote.description,
        clientName: quote.userId,
        createdAt: quote.createdAt,
        totalMaterials: quote.materialsCount,
        relevantMaterials: relevantMaterials.length,
        materials: relevantMaterials.map(m => ({
          id: m.id,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          category: m.category,
        })),
        status: quote.status,
      };
    }).filter(req => req.relevantMaterials > 0);

    return {
      success: true,
      requests: requestsWithMatches,
      count: requestsWithMatches.length,
    };
  }

  /**
   * Submit supplier quote with pricing for materials
   */
  async submitSupplierQuote(supplierId: string, quoteId: string, items: any[]) {
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    const materialIds = items.map(item => item.materialId);
    const materials = await this.materialRepository.find({
      where: { id: In(materialIds), quoteId },
    });

    if (materials.length !== items.length) {
      throw new BadRequestException('Some materials not found in quote');
    }

    const materialPricing = items.map(item => {
      const material = materials.find(m => m.id === item.materialId);
      const totalPrice = item.pricePerUnit * (material?.quantity || 0);

      return {
        materialId: item.materialId,
        materialName: material?.name,
        quantity: material?.quantity,
        unit: material?.unit,
        pricePerUnit: item.pricePerUnit,
        totalPrice,
        deliveryTime: item.deliveryTime,
        availability: item.availability,
      };
    });

    const totalAmount = materialPricing.reduce((sum, item) => sum + item.totalPrice, 0);

    const supplierQuote = this.supplierQuoteRepository.create({
      quoteId,
      supplierId,
      totalCost: totalAmount,
      materials: materialPricing,
      status: 'quoted',
    });

    await this.supplierQuoteRepository.save(supplierQuote);

    try {
      await this.notificationsService.createNotification({
        userId: quote.userId,
        type: NotificationType.QUOTE_RECEIVED,
        title: 'New Supplier Quote Received',
        message: `${supplier.name} submitted a quote for ${quote.title}.`,
        metadata: {
          quoteId,
          supplierId,
          supplierQuoteId: supplierQuote.id,
          totalAmount,
        },
        category: 'quote',
      });
    } catch (error) {
      this.logger.warn(
        { quoteId, supplierId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to create quote received notification',
      );
    }

    this.logger.info(
      { supplierId, quoteId, totalAmount, itemsCount: items.length },
      'Supplier quote submitted successfully'
    );
    return {
      success: true,
      message: 'Quote submitted successfully',
      supplierQuote: {
        id: supplierQuote.id,
        quoteId: supplierQuote.quoteId,
        supplierId: supplierQuote.supplierId,
        totalAmount: totalAmount,
        materials: materialPricing,
        status: supplierQuote.status,
        createdAt: supplierQuote.createdAt,
      },
    };
  }

  /**
   * Get specific quote request details
   */
  async getIncomingRequestById(supplierId: string, quoteId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId, status: 'in-review' },
      relations: ['materials'],
    });

    if (!quote) {
      throw new NotFoundException('Quote request not found or no longer available');
    }

    const relevantMaterials = quote.materials?.filter((m) =>
      supplier.materialCategories.includes(m.category)
    ) || [];

    if (relevantMaterials.length === 0) {
      throw new BadRequestException('This quote does not match your product categories');
    }

    return {
      success: true,
      ...quote,
      materials: relevantMaterials,
    };
  }

  /**
   * Get supplier profile
   */
  async getSupplierProfile(userId: string) {
    const supplier = await this.supplierRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!supplier) {
      return this.getOrCreateSupplier(userId);
    }

    return {
      success: true,
      supplier,
    };
  }

  /**
   * Update supplier profile
   */
  async updateSupplierProfile(userId: string, updateData: any) {
    // Ensure supplier exists (especially for new signups)
    await this.getOrCreateSupplier(userId);

    if (updateData.fullName || updateData.company || updateData.businessAddress || updateData.phone || updateData.phoneNumber) {
      await this.userRepository.update(userId, {
        ...(updateData.fullName && { fullName: updateData.fullName }),
        ...(updateData.company && { company: updateData.company }),
        ...(updateData.businessAddress && { businessAddress: updateData.businessAddress }),
        ...((updateData.phone || updateData.phoneNumber) && {
          phoneNumber: updateData.phone || updateData.phoneNumber,
        }),
      });
    }

    const { fullName, company, businessAddress, email, phone, phoneNumber, ...supplierData } = updateData;
    await this.supplierRepository.update({ userId }, supplierData);

    const updatedSupplier = await this.supplierRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      supplier: updatedSupplier,
    };
  }

  /**
   * Get quotes submitted by the supplier
   */
  async getSupplierSubmittedQuotes(supplierId: string) {
    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { supplierId },
      relations: ['quote'],
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      supplierQuotes,
      count: supplierQuotes.length,
    };
  }
}
