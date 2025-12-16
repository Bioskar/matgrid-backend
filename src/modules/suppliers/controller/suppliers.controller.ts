import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from '../service/suppliers.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateSupplierQuoteDto } from '../dto/create-supplier-quote.dto';
import { SubmitSupplierQuoteDto } from '../dto/submit-quote.dto';

@ApiTags('Suppliers')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get('requests')
  @ApiOperation({
    summary: 'Get incoming quote requests',
    description: 'View all incoming material requests matching supplier categories'
  })
  @ApiResponse({
    status: 200,
    description: 'Incoming requests retrieved successfully'
  })
  async getIncomingRequests(@Req() req: any) {
    const supplierId = req.user.supplierId || req.user.userId;
    return this.suppliersService.getIncomingRequests(supplierId);
  }

  @Post('submit-quote')
  @ApiOperation({
    summary: 'Submit quote with pricing',
    description: 'Submit pricing for materials in a quote request'
  })
  @ApiResponse({
    status: 201,
    description: 'Quote submitted successfully'
  })
  async submitQuote(@Body() submitQuoteDto: SubmitSupplierQuoteDto, @Req() req: any) {
    const supplierId = req.user.supplierId || req.user.userId;
    return this.suppliersService.submitSupplierQuote(
      supplierId,
      submitQuoteDto.quoteId,
      submitQuoteDto.items
    );
  }

  @Get()
  async getAllSuppliers(@Query() filters: any) {
    return this.suppliersService.getAllSuppliers(filters);
  }

  @Get(':supplierId')
  async getSupplierDetails(@Param('supplierId') supplierId: string) {
    return this.suppliersService.getSupplierDetails(supplierId);
  }

  @Post('search')
  async searchSuppliers(
    @Body() body: { quoteId: string; filters?: any },
  ) {
    return this.suppliersService.searchSuppliers(body.quoteId, body.filters);
  }

  @Post('quote')
  async createSupplierQuote(@Body() createSupplierQuoteDto: CreateSupplierQuoteDto) {
    return this.suppliersService.createSupplierQuote(
      createSupplierQuoteDto.quoteId,
      createSupplierQuoteDto.supplierId,
      createSupplierQuoteDto.materials || [],
    );
  }

  @Get('quotes/:quoteId')
  async getSupplierQuotes(@Param('quoteId') quoteId: string) {
    return this.suppliersService.getSupplierQuotes(quoteId);
  }

  @Get('quotes/:quoteId/best')
  async getBestSupplierForQuote(@Param('quoteId') quoteId: string) {
    return this.suppliersService.getBestSupplierForQuote(quoteId);
  }

  @Put('quotes/:supplierQuoteId/status')
  async updateSupplierQuoteStatus(
    @Param('supplierQuoteId') supplierQuoteId: string,
    @Body() body: { status: string },
  ) {
    return this.suppliersService.updateSupplierQuoteStatus(supplierQuoteId, body.status);
  }
}
