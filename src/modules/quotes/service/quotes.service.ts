import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Quote } from '../entities/quote.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  /**
   * Update quote details
   */
  async updateQuote(quoteId: string, updateData: any) {
    this.logger.info(
      { quoteId, updatedFields: Object.keys(updateData) },
      '[Quotes] Updating quote'
    );

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Quotes] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    Object.assign(quote, updateData);
    await this.quoteRepository.save(quote);

    this.logger.info(
      { quoteId, status: quote.status },
      '[Quotes] Quote updated successfully'
    );

    return {
      success: true,
      quote,
    };
  }

  /**
   * Delete a quote
   */
  async deleteQuote(quoteId: string) {
    this.logger.info({ quoteId }, '[Quotes] Deleting quote');

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Quotes] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    await this.quoteRepository.remove(quote);

    this.logger.info(
      { quoteId, materialsCount: quote.materialsCount },
      '[Quotes] Quote deleted successfully'
    );

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
    this.logger.info({ quoteId }, '[Quotes] Fetching quote statistics');

    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });

    if (!quote) {
      this.logger.warn({ quoteId }, '[Quotes] Quote not found');
      throw new BadRequestException('Quote not found');
    }

    this.logger.info(
      {
        quoteId,
        materialsCount: quote.materialsCount,
        suppliersCount: quote.suppliersCount,
        status: quote.status,
      },
      '[Quotes] Quote stats retrieved'
    );

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
