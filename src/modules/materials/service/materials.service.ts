import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Quote } from '../../quotes/entities/quote.entity';
import { Material } from '../../quotes/entities/material.entity';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';
import { AddMaterialDto } from '../dto/add-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  /**
   * Create a new quote for a user
   * Initializes with draft status
   */
  async createQuote(userId: string, createQuoteDto: CreateQuoteDto) {
    this.logger.info(
      { userId },
      '[Materials] Creating new quote'
    );

    const quote = this.quoteRepository.create({
      userId,
      ...createQuoteDto,
      status: 'draft',
    });

    await this.quoteRepository.save(quote);

    this.logger.info(
      { userId, quoteId: quote.id, status: 'draft' },
      '[Materials] Quote created successfully'
    );

    return {
      success: true,
      quote,
    };
  }

  /**
   * Add a single material to a quote
   * Updates the quote's materials count
   */
  async addMaterial(quoteId: string, addMaterialDto: AddMaterialDto) {
    this.logger.info(
      { quoteId, materialName: addMaterialDto.name },
      '[Materials] Adding single material to quote'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Materials] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    const material = this.materialRepository.create({
      quoteId,
      ...addMaterialDto,
      sourceMethod: 'manual',
    });

    await this.materialRepository.save(material);

    // Update materials count
    quote.materialsCount = await this.materialRepository.count({ where: { quoteId } });
    await this.quoteRepository.save(quote);

    this.logger.info(
      { quoteId, materialId: material.id, materialsCount: quote.materialsCount },
      '[Materials] Material added successfully'
    );

    return {
      success: true,
      material,
    };
  }

  /**
   * Add multiple materials from paste operation
   * Bulk inserts materials and updates quote count
   */
  async addMaterialsFromPaste(quoteId: string, materials: AddMaterialDto[]) {
    this.logger.info(
      { quoteId, materialsCount: materials.length },
      '[Materials] Adding materials from paste'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Materials] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    const materialEntities = this.materialRepository.create(
      materials.map((m) => ({
        quoteId,
        ...m,
        sourceMethod: 'paste',
      })),
    );

    const insertedMaterials = await this.materialRepository.save(materialEntities);

    // Update materials count
    quote.materialsCount = await this.materialRepository.count({ where: { quoteId } });
    await this.quoteRepository.save(quote);

    this.logger.info(
      { quoteId, insertedCount: insertedMaterials.length, totalCount: quote.materialsCount },
      '[Materials] Materials pasted successfully'
    );

    return {
      success: true,
      materials: insertedMaterials,
      count: insertedMaterials.length,
    };
  }

  /**
   * Add multiple materials from file upload
   * Bulk inserts materials and updates quote count
   */
  async addMaterialsFromUpload(quoteId: string, materials: any[]) {
    this.logger.info(
      { quoteId, materialsCount: materials.length },
      '[Materials] Adding materials from file upload'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Materials] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    const materialEntities = this.materialRepository.create(
      materials.map((m) => ({
        quoteId,
        ...m,
        sourceMethod: 'upload',
      })),
    );

    const insertedMaterials = await this.materialRepository.save(materialEntities);

    // Update materials count
    quote.materialsCount = await this.materialRepository.count({ where: { quoteId } });
    await this.quoteRepository.save(quote);

    this.logger.info(
      { quoteId, insertedCount: insertedMaterials.length, totalCount: quote.materialsCount },
      '[Materials] Materials uploaded successfully'
    );

    return {
      success: true,
      materials: insertedMaterials,
      count: insertedMaterials.length,
    };
  }

  /**
   * Get quote details with all materials
   * Verifies user authorization
   */
  async getQuote(quoteId: string, userId: string) {
    this.logger.info(
      { quoteId, userId },
      '[Materials] Fetching quote details'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote || quote.userId !== userId) {
      this.logger.warn(
        { quoteId, userId, quoteFound: !!quote },
        '[Materials] Quote not found or unauthorized'
      );
      throw new BadRequestException('Quote not found or unauthorized');
    }

    const materials = await this.materialRepository.find({ where: { quoteId } });

    this.logger.info(
      { quoteId, materialsCount: materials.length },
      '[Materials] Quote retrieved successfully'
    );

    return {
      success: true,
      quote,
      materials,
    };
  }

  /**
   * Get all quotes for a user
   * Sorted by creation date (newest first)
   */
  async getUserQuotes(userId: string) {
    this.logger.info(
      { userId },
      '[Materials] Fetching user quotes'
    );

    const quotes = await this.quoteRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    this.logger.info(
      { userId, quotesCount: quotes.length },
      '[Materials] User quotes retrieved'
    );

    return {
      success: true,
      quotes,
    };
  }

  /**
   * Get all materials for a specific quote
   */
  async getMaterials(quoteId: string) {
    this.logger.info(
      { quoteId },
      '[Materials] Fetching materials for quote'
    );

    const materials = await this.materialRepository.find({ where: { quoteId } });

    this.logger.info(
      { quoteId, materialsCount: materials.length },
      '[Materials] Materials retrieved'
    );

    return {
      success: true,
      materials,
    };
  }

  /**
   * Update material details
   */
  async updateMaterial(materialId: string, updateData: any) {
    this.logger.info(
      { materialId, updatedFields: Object.keys(updateData) },
      '[Materials] Updating material'
    );

    const material = await this.materialRepository.findOne({ where: { id: materialId } });

    if (!material) {
      this.logger.warn({ materialId }, '[Materials] Material not found');
      throw new BadRequestException('Material not found');
    }

    Object.assign(material, updateData);
    await this.materialRepository.save(material);

    this.logger.info(
      { materialId, name: material.name },
      '[Materials] Material updated successfully'
    );

    return {
      success: true,
      material,
    };
  }

  /**
   * Delete a material and update quote count
   */
  async deleteMaterial(materialId: string, quoteId: string) {
    this.logger.info(
      { materialId, quoteId },
      '[Materials] Deleting material'
    );

    const material = await this.materialRepository.findOne({ where: { id: materialId } });

    if (!material) {
      this.logger.warn({ materialId }, '[Materials] Material not found');
      throw new BadRequestException('Material not found');
    }

    await this.materialRepository.remove(material);

    // Update materials count
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (quote) {
      quote.materialsCount = await this.materialRepository.count({ where: { quoteId } });
      await this.quoteRepository.save(quote);

      this.logger.info(
        { materialId, quoteId, remainingCount: quote.materialsCount },
        '[Materials] Material deleted and quote updated'
      );
    }

    return {
      success: true,
      message: 'Material deleted successfully',
    };
  }

  /**
   * Update quote status
   */
  async updateQuoteStatus(quoteId: string, status: string) {
    this.logger.info(
      { quoteId, newStatus: status },
      '[Materials] Updating quote status'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Materials] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    const oldStatus = quote.status;
    quote.status = status;
    await this.quoteRepository.save(quote);

    this.logger.info(
      { quoteId, oldStatus, newStatus: status },
      '[Materials] Quote status updated'
    );

    return {
      success: true,
      quote,
    };
  }
}
