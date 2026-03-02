import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SupportService } from '../service/support.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('faqs')
  @ApiOperation({
    summary: 'Get frequently asked questions',
    description: `
      **Retrieves list of FAQs for help section**
      
      **Returns:**
      - Question and answer pairs
      - Organized by category
      - Ordered by importance
      
      **Optional filtering:**
      - category: Filter by FAQ category (delivery, payment, orders, etc.)
      
      **Use for:**
      - Help & Support page
      - FAQ accordion display
      - Self-service support
      - Reducing support tickets
      
      **Common categories:**
      - delivery: Delivery-related questions
      - payment: Payment and billing
      - orders: Order management
      - materials: Material specifications
      - account: Account management
      
      **Frontend display:**
      - Show as expandable accordion
      - Group by category
      - Search functionality
      - "Still need help?" CTA at bottom
    `
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter FAQs by category'
  })
  @ApiResponse({
    status: 200,
    description: 'FAQs retrieved successfully',
    schema: {
      example: {
        success: true,
        faqs: [
          {
            id: '507f1f77bcf86cd799439011',
            question: 'How long does delivery take?',
            answer: 'Delivery typically takes 3-7 business days depending on your location and the supplier. You can see estimated delivery times in each supplier quote.',
            category: 'delivery',
            order: 1
          },
          {
            id: '507f1f77bcf86cd799439012',
            question: 'Can I return materials?',
            answer: 'Yes, materials can be returned within 7 days if they are unused and in original packaging. Contact the supplier directly through the app to initiate a return.',
            category: 'orders',
            order: 2
          }
        ],
        count: 2
      }
    }
  })
  async getFaqs(@Query('category') category?: string) {
    return this.supportService.getFaqs(category);
  }

  @Get('faqs/search')
  @ApiOperation({
    summary: 'Search FAQs',
    description: `
      **Search through FAQs by keyword**
      
      **Searches in:**
      - Question text
      - Answer text
      
      **Use for:**
      - FAQ search bar
      - Quick help lookup
      - Finding specific answers
    `
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search keyword'
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      example: {
        success: true,
        faqs: [
          {
            id: '507f1f77bcf86cd799439011',
            question: 'How is my payment secured?',
            answer: 'All payments are processed through secure payment gateways (Paystack/Flutterwave). We use industry-standard encryption.',
            category: 'payment',
            order: 1
          }
        ],
        count: 1
      }
    }
  })
  async searchFaqs(@Query('q') keyword: string) {
    return this.supportService.searchFaqs(keyword);
  }

  @Get('faqs/categories')
  @ApiOperation({
    summary: 'Get FAQ categories',
    description: 'Returns list of available FAQ categories for filtering'
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved',
    schema: {
      example: {
        success: true,
        categories: ['delivery', 'payment', 'orders', 'materials', 'account']
      }
    }
  })
  async getCategories() {
    return this.supportService.getCategories();
  }

  @Get('contact')
  @ApiOperation({
    summary: 'Get support contact information',
    description: `
      **Returns all support contact methods**
      
      **Includes:**
      - WhatsApp number (click to chat)
      - Support email
      - Phone number
      - Live chat availability
      - Support hours
      
      **Use for:**
      - "Get Support" button
      - "Call Support" functionality
      - WhatsApp integration
      - Contact information display
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Contact information retrieved',
    schema: {
      example: {
        success: true,
        contact: {
          whatsapp: '+2348012345678',
          email: 'support@matgrid.com',
          phone: '+2348012345678',
          liveChatAvailable: true,
          supportHours: '9am - 6pm (Mon - Sat)'
        }
      }
    }
  })
  async getContactInfo() {
    return this.supportService.getContactInfo();
  }
}
