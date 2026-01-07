import { Injectable, BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import pino from 'pino';
import { Supplier } from '../entities/supplier.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { SupplierQuote } from '../entities/supplier-quote.entity';
import { Material } from '../../quotes/entities/material.entity';
import { Quote } from '../../quotes/entities/quote.entity';

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
  ) {}

  async getOrCreateSupplier(userId: string): Promise<Supplier> {
    let supplier = await this.supplierRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!supplier) {
      const user = await this.userRepository.findOne({
        where: { id: userId, userRole: UserRole.SUPPLIER },
      });

      if (!user) {
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
    }

    return supplier;
  }

  /**
   * Search suppliers based on quote materials
   * Matches suppliers by material categories
   */
  async searchSuppliers(quoteId: string, filters: any = {}) {
    // Get materials for the quote
    const materials = await this.materialRepository.find({ where: { quoteId } });

    if (materials.length === 0) {
      throw new BadRequestException('No materials found in quote');
    }

    // Build query based on material categories
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

    return {
      success: true,
      suppliers,
    };
  }

  /**
   * Get supplier details by ID
   */
  async getSupplierDetails(supplierId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });

    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

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
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });

    if (!quote || !supplier) {
      throw new BadRequestException('Quote or Supplier not found');
    }

    // Calculate total cost from materials
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

    // Update quote suppliers count
    quote.suppliersCount = await this.supplierQuoteRepository.count({ where: { quoteId } });
    await this.quoteRepository.save(quote);

    return {
      success: true,
      supplierQuote,
    };
  }

  /**
   * Get all supplier quotes for a quote
   * Sorted by total cost (lowest first)
   */
  async getSupplierQuotes(quoteId: string) {
    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier'],
      order: { totalCost: 'ASC' },
    });

    return {
      success: true,
      supplierQuotes,
    };
  }

  /**
   * Get supplier quotes grouped by material category for comparison
   * Used in "Choose Your Suppliers" screen
   */
  async getSupplierQuotesGrouped(quoteId: string) {
    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier'],
    });

    const materials = await this.materialRepository.find({
      where: { quoteId },
    });

    if (supplierQuotes.length === 0) {
      return {
        success: true,
        message: 'No supplier quotes received yet',
        groupedQuotes: [],
        totalEstimate: 0,
      };
    }

    // Group materials by category
    const categorizedMaterials = materials.reduce((acc, material) => {
      const category = material.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(material);
      return acc;
    }, {} as Record<string, any[]>);

    // For each category, find supplier quotes for those materials
    const groupedQuotes = Object.entries(categorizedMaterials).map(([category, categoryMaterials]) => {
      const materialIds = categoryMaterials.map(m => m.id);
      
      // Find suppliers who quoted for materials in this category
      const categorySupplierQuotes = supplierQuotes
        .map(sq => {
          // sq.materials is a JSON array of SupplierQuoteMaterial
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
            deliveryDays: 2, // Can be calculated from quote delivery estimate
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
        .sort((a, b) => a!.subtotal - b!.subtotal); // Sort by price (lowest first)
      
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

    // Calculate total with best prices from each category
    const totalEstimate = groupedQuotes.reduce((sum, group) => 
      sum + (group.lowestPrice || 0), 0
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
    const supplierQuote = await this.supplierQuoteRepository.findOne({
      where: { id: supplierQuoteId }
    });

    if (!supplierQuote) {
      throw new BadRequestException('Supplier quote not found');
    }

    supplierQuote.status = status;
    await this.supplierQuoteRepository.save(supplierQuote);

    return {
      success: true,
      supplierQuote,
    };
  }

  /**
   * Get the best (lowest cost) supplier for a quote
   * Returns all suppliers sorted by cost
   */
  async getBestSupplierForQuote(quoteId: string) {
    const quotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier'],
      order: { totalCost: 'ASC' },
    });

    if (quotes.length === 0) {
      throw new BadRequestException('No supplier quotes found');
    }

    return {
      success: true,
      bestSupplier: quotes[0],
      allSuppliers: quotes,
    };
  }

  /**
   * Get incoming quote requests for a supplier
   * Filtered by material categories they supply
   */
  async getIncomingRequests(supplierId: string) {
    const supplier = await this.supplierRepository.findOne({ where: { userId: supplierId } });
    
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

    // Get quotes with materials matching supplier categories
    const quotes = await this.quoteRepository
      .createQueryBuilder('quote')
      .leftJoinAndSelect('quote.materials', 'material')
      .where('quote.status = :status', { status: 'open' })
      .andWhere('material.category IN (:...categories)', { categories: supplier.materialCategories })
      .orderBy('quote.createdAt', 'DESC')
      .limit(50)
      .getMany();

    // Calculate how many materials match for each quote
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

    this.logger.info(
      { supplierId, requestsCount: requestsWithMatches.length },
      'Fetched incoming requests for supplier'
    );

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

    // Validate all material IDs exist
    const materialIds = items.map(item => item.materialId);
    const materials = await this.materialRepository.find({
      where: { id: In(materialIds), quoteId },
    });

    if (materials.length !== items.length) {
      throw new BadRequestException('Some materials not found in quote');
    }

    // Calculate total quote amount
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

    // Create supplier quote
    const supplierQuote = this.supplierQuoteRepository.create({
      quoteId,
      supplierId,
      totalCost: totalAmount,
      materials: materialPricing,
      status: 'quoted',
    });

    await this.supplierQuoteRepository.save(supplierQuote);

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
        totalAmount,
        materials: materialPricing,
        status: supplierQuote.status,
        createdAt: supplierQuote.createdAt,
      },
    };
  }
}
