import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from '../service/suppliers.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateSupplierQuoteDto } from '../dto/create-supplier-quote.dto';

@ApiTags('Suppliers')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

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
