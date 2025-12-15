import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { SupplierQuote } from '../entities/supplier-quote.entity';
import { Material } from '../../materials/entities/material.entity';
import { Quote } from '../../quotes/entities/quote.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierQuote)
    private supplierQuoteRepository: Repository<SupplierQuote>,
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
  ) {}

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
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });

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
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });

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
}
