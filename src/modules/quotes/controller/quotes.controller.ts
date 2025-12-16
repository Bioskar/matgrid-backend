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
  async updateQuote(
    @Param('quoteId') quoteId: string,
    @Body() updateData: any,
  ) {
    return this.quotesService.updateQuote(quoteId, updateData);
  }

  @Delete(':quoteId')
  async deleteQuote(@Param('quoteId') quoteId: string) {
    return this.quotesService.deleteQuote(quoteId);
  }

  @Get(':quoteId/stats')
  async getQuoteStats(@Param('quoteId') quoteId: string) {
    return this.quotesService.getQuoteStats(quoteId);
  }
}
