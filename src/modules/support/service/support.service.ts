import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Faq } from '../entities/faq.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Faq)
    private faqRepository: Repository<Faq>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
  ) {}

  /**
   * Get all active FAQs, optionally filtered by category
   */
  async getFaqs(category?: string) {
    const queryBuilder = this.faqRepository
      .createQueryBuilder('faq')
      .where('faq.isActive = :isActive', { isActive: true })
      .orderBy('faq.order', 'ASC')
      .addOrderBy('faq.createdAt', 'DESC');

    if (category) {
      queryBuilder.andWhere('faq.category = :category', { category });
    }

    const faqs = await queryBuilder.getMany();

    this.logger.info({ category, count: faqs.length }, 'Retrieved FAQs');

    return {
      success: true,
      faqs,
      count: faqs.length,
    };
  }

  /**
   * Search FAQs by keyword
   */
  async searchFaqs(keyword: string) {
    const faqs = await this.faqRepository
      .createQueryBuilder('faq')
      .where('faq.isActive = :isActive', { isActive: true })
      .andWhere(
        '(LOWER(faq.question) LIKE LOWER(:keyword) OR LOWER(faq.answer) LIKE LOWER(:keyword))',
        { keyword: `%${keyword}%` }
      )
      .orderBy('faq.order', 'ASC')
      .getMany();

    this.logger.info({ keyword, count: faqs.length }, 'Searched FAQs');

    return {
      success: true,
      faqs,
      count: faqs.length,
    };
  }

  /**
   * Get FAQ categories
   */
  async getCategories() {
    const categories = await this.faqRepository
      .createQueryBuilder('faq')
      .select('DISTINCT faq.category', 'category')
      .where('faq.isActive = :isActive', { isActive: true })
      .andWhere('faq.category IS NOT NULL')
      .getRawMany();

    return {
      success: true,
      categories: categories.map(c => c.category).filter(Boolean),
    };
  }

  /**
   * Get support contact information
   */
  async getContactInfo() {
    return {
      success: true,
      contact: {
        whatsapp: '+2348012345678',
        email: 'support@matgrid.com',
        phone: '+2348012345678',
        liveChatAvailable: true,
        supportHours: '9am - 6pm (Mon - Sat)',
      },
    };
  }
}
