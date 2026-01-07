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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { SuppliersService } from '../service/suppliers.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateSupplierQuoteDto } from '../dto/create-supplier-quote.dto';
import { SubmitSupplierQuoteDto } from '../dto/submit-quote.dto';

@ApiTags('Suppliers')
@ApiBearerAuth('JWT-auth')
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get('requests')
  @ApiOperation({
    summary: 'Get incoming quote requests (Supplier)',
    description: `
      **Retrieves all material quote requests sent by contractors**
      
      **Returns:**
      - List of quotes waiting for supplier response
      - Project details (name, delivery location)
      - Materials list with quantities
      - Deadline for quote submission
      
      **Filtering (automatic):**
      - Only shows quotes matching supplier's categories
      - Excludes quotes already quoted by this supplier
      - Sorted by newest first
      
      **Use for:**
      - Supplier dashboard "New Requests" section
      - Opportunity list for bidding
      - Business development
      
      **Frontend display:**
      - Show as cards or list
      - Display: Project name, materials count, location
      - "View Details" button to see full materials
      - "Submit Quote" action button
      
      **Next step:** Submit pricing via POST /suppliers/submit-quote
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Incoming quote requests',
    schema: {
      example: [
        {
          id: '507f1f77bcf86cd799439011',
          projectName: 'Office Building',
          deliveryAddress: '123 Main St, Lagos',
          materialsCount: 15,
          createdAt: '2025-12-17T10:00:00.000Z',
          deadline: '2025-12-20T10:00:00.000Z'
        }
      ]
    }
  })
  async getIncomingRequests(@Req() req: any) {
    const supplierId = req.user.supplierId || req.user.userId;
    return this.suppliersService.getIncomingRequests(supplierId);
  }

  @Post('submit-quote')
  @ApiOperation({
    summary: 'Submit pricing quote (Supplier)',
    description: `
      **Submit pricing for a contractor's material request**
      
      **Required fields:**
      - quoteId: The contractor's quote to respond to
      - items: Array of materials with pricing
      
      **Each item must have:**
      - materialId: ID of the material from request
      - unitPrice: Your price per unit (in Naira)
      - availability: "in_stock" or "order_basis"
      - deliveryDays: How many days to deliver
      
      **Optional per item:**
      - brand: Brand you'll supply
      - notes: Special conditions or alternatives
      
      **Example pricing:**
      \`\`\`json
      {
        "quoteId": "507f1f77bcf86cd799439011",
        "items": [
          {
            "materialId": "mat123",
            "unitPrice": 10000,
            "availability": "in_stock",
            "deliveryDays": 2,
            "brand": "Dangote"
          }
        ]
      }
      \`\`\`
      
      **System calculates:**
      - Line totals (quantity × unitPrice)
      - Grand total across all items
      - Your competitiveness vs other suppliers
      
      **Frontend checklist:**
      - Show materials with input fields for prices
      - Calculate totals in real-time
      - Validate all prices > 0
      - Confirm before submission
      - Show success message after submit
      
      **After submission:**
      - Contractor can see your quote
      - You can view in "My Quotes" section
      - Wait for contractor to accept/reject
    `
  })
  @ApiBody({
    schema: {
      example: {
        quoteId: '507f1f77bcf86cd799439011',
        items: [
          {
            materialId: 'mat123',
            unitPrice: 10000,
            availability: 'in_stock',
            deliveryDays: 2,
            brand: 'Dangote'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Quote submitted successfully',
    schema: {
      example: {
        success: true,
        message: 'Quote submitted successfully',
        supplierQuote: {
          id: '507f1f77bcf86cd799439012',
          totalAmount: 500000,
          status: 'pending',
          submittedAt: '2025-12-17T10:00:00.000Z'
        }
      }
    }
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

  /**
   * Get supplier quotes grouped by material category for comparison
   * Used in "Choose Your Suppliers" screen
   */
  @Get('quotes/:quoteId/grouped')
  @ApiOperation({
    summary: 'Get supplier quotes grouped by category',
    description: 'Returns supplier quotes organized by material category for side-by-side comparison in the "Choose Your Suppliers" screen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Grouped supplier quotes retrieved successfully',
    schema: {
      example: {
        success: true,
        quoteId: 'quote-uuid',
        groupedQuotes: [
          {
            category: 'Cement & Blocks',
            description: '20 Cement & Blocks items',
            materials: [
              { id: 'mat-1', name: 'Dangote Cement', quantity: 50, unit: 'bags' },
            ],
            supplierOptions: [
              {
                supplierId: 'sup-1',
                supplierQuoteId: 'sq-1',
                supplierName: 'Buildmart Lagos',
                location: 'Ikeja, Lagos',
                distance: '2.5 km',
                rating: 4.8,
                reviewsCount: 245,
                deliveryDays: 0,
                stockStatus: 'In Stock',
                subtotal: 850000,
                items: [
                  { materialId: 'mat-1', name: 'Dangote Cement', quantity: 50, unit: 'bags', unitPrice: 17000, total: 850000 },
                ],
              },
            ],
            lowestPrice: 850000,
          },
        ],
        totalEstimate: 1950000,
        currency: 'NGN',
        message: 'Found quotes from 3 suppliers across 2 categories',
      },
    },
  })
  async getSupplierQuotesGrouped(@Param('quoteId') quoteId: string) {
    return this.suppliersService.getSupplierQuotesGrouped(quoteId);
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
