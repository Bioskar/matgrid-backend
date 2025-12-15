import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../../quotes/entities/quote.entity';
import { Material } from '../entities/material.entity';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';
import { AddMaterialDto } from '../dto/add-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
  ) {}

  /**
   * Create a new quote for a user
   * Initializes with draft status
   */
  async createQuote(userId: string, createQuoteDto: CreateQuoteDto) {
    const quote = this.quoteRepository.create({
      userId,
      ...createQuoteDto,
      status: 'draft',
    });

    await this.quoteRepository.save(quote);

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
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
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
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
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
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
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
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote || quote.userId !== userId) {
      throw new BadRequestException('Quote not found or unauthorized');
    }

    const materials = await this.materialRepository.find({ where: { quoteId } });

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
    const quotes = await this.quoteRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      quotes,
    };
  }

  /**
   * Get all materials for a specific quote
   */
  async getMaterials(quoteId: string) {
    const materials = await this.materialRepository.find({ where: { quoteId } });

    return {
      success: true,
      materials,
    };
  }

  /**
   * Update material details
   */
  async updateMaterial(materialId: string, updateData: any) {
    const material = await this.materialRepository.findOne({ where: { id: materialId } });

    if (!material) {
      throw new BadRequestException('Material not found');
    }

    Object.assign(material, updateData);
    await this.materialRepository.save(material);

    return {
      success: true,
      material,
    };
  }

  /**
   * Delete a material and update quote count
   */
  async deleteMaterial(materialId: string, quoteId: string) {
    const material = await this.materialRepository.findOne({ where: { id: materialId } });

    if (!material) {
      throw new BadRequestException('Material not found');
    }

    await this.materialRepository.remove(material);

    // Update materials count
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (quote) {
      quote.materialsCount = await this.materialRepository.count({ where: { quoteId } });
      await this.quoteRepository.save(quote);
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
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    quote.status = status;
    await this.quoteRepository.save(quote);

    return {
      success: true,
      quote,
    };
  }
}
