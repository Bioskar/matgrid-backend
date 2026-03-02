import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../entities/quote.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
  ) {}

  /**
   * Update quote details
   */
  async updateQuote(quoteId: string, updateData: any) {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    Object.assign(quote, updateData);
    await this.quoteRepository.save(quote);

    return {
      success: true,
      quote,
    };
  }

  /**
   * Delete a quote
   */
  async deleteQuote(quoteId: string) {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    await this.quoteRepository.remove(quote);

    return {
      success: true,
      message: 'Quote deleted successfully',
    };
  }

  /**
   * Get quote statistics
   * Returns counts and totals for the quote
   */
  async getQuoteStats(quoteId: string) {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    return {
      success: true,
      stats: {
        materialsCount: quote.materialsCount,
        suppliersCount: quote.suppliersCount,
        totalEstimatedCost: quote.totalEstimatedCost,
        status: quote.status,
      },
    };
  }
}
