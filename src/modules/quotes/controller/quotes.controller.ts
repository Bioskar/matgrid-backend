import {
  Controller,
  Put,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QuotesService } from '../service/quotes.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Quotes')
@ApiBearerAuth('JWT-auth')
@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Put(':quoteId')
  @ApiOperation({
    summary: 'Update quote details',
    description: `
      **Updates quote information before sending to suppliers**
      
      **Updatable fields:**
      - projectName: Change project name
      - deliveryAddress: Update delivery location
      - notes: Add/modify special requirements
      - status: Change quote status (draft, sent, closed)
      
      **Use cases:**
      - Fix project details before sending
      - Update delivery address
      - Add special requirements
      - Mark quote as sent/closed
      
      **Cannot update:**
      - Materials (use separate material endpoints)
      - Supplier responses
      - Order details after order created
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Quote updated successfully',
    schema: {
      example: {
        success: true,
        quote: {
          id: '507f1f77bcf86cd799439011',
          projectName: 'Updated Project Name',
          status: 'sent'
        }
      }
    }
  })
  async updateQuote(
    @Param('quoteId') quoteId: string,
    @Body() updateData: any,
  ) {
    return this.quotesService.updateQuote(quoteId, updateData);
  }

  @Delete(':quoteId')
  @ApiOperation({
    summary: 'Delete quote',
    description: `
      **Permanently deletes a quote and all associated data**
      
      **What gets deleted:**
      - Quote details
      - All materials in quote
      - Supplier responses (if any)
      - Cannot be undone!
      
      **Restrictions:**
      - Cannot delete if order has been created
      - Cannot delete if payment completed
      
      **Use for:**
      - Removing draft quotes
      - Cleaning up cancelled requests
      - Deleting test data
      
      **Frontend confirmation:**
      - Always show confirmation dialog
      - Warn: "This cannot be undone"
      - If has supplier responses, warn about that too
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Quote deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Quote deleted successfully'
      }
    }
  })
  async deleteQuote(@Param('quoteId') quoteId: string) {
    return this.quotesService.deleteQuote(quoteId);
  }

  @Get(':quoteId/stats')
  @ApiOperation({
    summary: 'Get quote statistics',
    description: `
      **Provides analytics and statistics for a quote**
      
      **Statistics included:**
      - Total materials requested
      - Number of supplier responses
      - Price range (lowest to highest)
      - Average quote amount
      - Estimated savings
      - Response time analytics
      
      **Use for:**
      - Quote comparison dashboard
      - Decision making support
      - Cost analysis
      - ROI calculations
      
      **Frontend display:**
      - Show in charts/graphs
      - Highlight best value supplier
      - Display price distribution
      - Show savings vs estimated costs
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Quote statistics',
    schema: {
      example: {
        materialsCount: 15,
        supplierResponsesCount: 5,
        lowestQuote: 450000,
        highestQuote: 550000,
        averageQuote: 500000,
        estimatedSavings: 50000
      }
    }
  })
  async getQuoteStats(@Param('quoteId') quoteId: string) {
    return this.quotesService.getQuoteStats(quoteId);
  }
}
