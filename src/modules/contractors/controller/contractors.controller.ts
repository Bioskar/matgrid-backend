import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContractorsService } from '../service/contractors.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@ApiTags('Contractors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTRACTOR)
@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get contractor profile',
    description: `
      **Retrieves the complete contractor profile information**
      
      **Returns:**
      - Personal information (name, phone, email)
      - Company details
      - Delivery addresses
      - Profile photo
      - Account creation date
      
      **Use for:**
      - Profile page display
      - Pre-filling forms (quote requests, orders)
      - Account settings
      - Verification status checks
      
      **Authentication:** Requires JWT token with contractor role
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Contractor profile retrieved successfully',
    schema: {
      example: {
        id: '507f1f77bcf86cd799439011',
        fullName: 'John Doe',
        phoneNumber: '08012345678',
        email: 'john@example.com',
        company: 'Acme Construction',
        deliveryAddress: '123 Main St, Lagos',
        profilePhoto: 'https://example.com/photos/profile.jpg',
        createdAt: '2025-12-01T10:00:00.000Z'
      }
    }
  })
  async getProfile(@Request() req) {
    return this.contractorsService.getContractorProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update contractor profile',
    description: `
      **Updates contractor profile information**
      
      **Updatable fields:**
      - fullName: Full name (min 2 characters)
      - company: Company name
      - deliveryAddress: Primary delivery address
      - profilePhoto: URL to profile image
      - email: Email address (must be unique)
      
      **All fields are optional** - only send fields you want to update
      
      **Frontend tips:**
      - Show success message after update
      - Refresh profile data after successful update
      - Validate email format before sending
      - Allow image upload for profilePhoto
      
      **Authentication:** Requires JWT token with contractor role
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Profile updated successfully',
        contractor: {
          id: '507f1f77bcf86cd799439011',
          fullName: 'John Doe Updated',
          company: 'New Company Name'
        }
      }
    }
  })
  async updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return this.contractorsService.updateContractorProfile(
      req.user.userId,
      updateDto,
    );
  }

  @Get('materials')
  @ApiOperation({ summary: 'Get contractor materials list' })
  @ApiResponse({ status: 200, description: 'Returns list of materials' })
  async getMaterials(@Request() req) {
    return this.contractorsService.getContractorMaterials(req.user.userId);
  }

  @Get('materials/search')
  @ApiOperation({ summary: 'Search contractor materials' })
  @ApiResponse({ status: 200, description: 'Returns filtered materials' })
  async searchMaterials(@Request() req, @Query('q') searchTerm: string) {
    return this.contractorsService.searchMaterials(req.user.userId, searchTerm);
  }

  @Get('quotes')
  @ApiOperation({
    summary: 'Get all contractor quotes',
    description: `
      **Retrieves all quotes created by the contractor**
      
      **Returns:**
      - List of all quotes (active, pending, completed)
      - Quote basic info (name, materials count, status)
      - Creation date and last update
      - Number of supplier responses per quote
      
      **Quote statuses:**
      - pending: No supplier responses yet
      - active: Has supplier quotes, awaiting contractor decision
      - completed: Contractor accepted a supplier quote
      - cancelled: Quote was cancelled
      
      **Use for:**
      - Quote history page
      - Dashboard overview
      - Tracking quote status
      
      **Sorting:** Returns newest quotes first
      
      **Next steps:**
      - Click quote to view details: GET /quotes/:id
      - View active quotes only: GET /quotes/active
    `
  })
  @ApiResponse({
    status: 200,
    description: 'List of contractor quotes',
    schema: {
      example: [
        {
          id: '507f1f77bcf86cd799439011',
          projectName: 'Office Building Construction',
          materialsCount: 25,
          status: 'active',
          supplierResponsesCount: 3,
          createdAt: '2025-12-15T10:00:00.000Z'
        }
      ]
    }
  })
  async getQuotes(@Request() req) {
    return this.contractorsService.getContractorQuotes(req.user.userId);
  }

  @Get('quotes/active')
  @ApiOperation({ summary: 'Get active quotes' })
  @ApiResponse({ status: 200, description: 'Returns active quotes' })
  async getActiveQuotes(@Request() req) {
    return this.contractorsService.getActiveQuotes(req.user.userId);
  }

  @Get('quotes/:id')
  @ApiOperation({
    summary: 'Get quote details with supplier responses',
    description: `
      **Retrieves complete quote details including all supplier quotes**
      
      **Returns:**
      - Quote information (project name, delivery address)
      - Full materials list with quantities and specs
      - All supplier responses with pricing
      - Supplier details (company, rating, delivery time)
      - Total costs comparison across suppliers
      
      **Perfect for:**
      - Quote review page
      - Comparing supplier offers
      - Making purchasing decisions
      - Viewing material pricing breakdown
      
      **Supplier quote includes:**
      - Per-item pricing
      - Total quote value
      - Estimated delivery time
      - Payment terms
      - Supplier contact information
      
      **Frontend usage:**
      - Display materials in a table
      - Show supplier quotes side-by-side for comparison
      - Highlight best price for each item
      - Calculate total costs
      - Provide "Accept Quote" button for each supplier
      
      **Next step:** Create order by accepting a supplier quote
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Quote details with supplier responses',
    schema: {
      example: {
        quote: {
          id: '507f1f77bcf86cd799439011',
          projectName: 'Office Building',
          deliveryAddress: '123 Main St, Lagos',
          materials: [
            { itemName: 'Cement', quantity: 50, unit: 'Bags' }
          ],
          status: 'active'
        },
        supplierQuotes: [
          {
            id: '507f1f77bcf86cd799439012',
            supplierName: 'ABC Supplies',
            totalAmount: 500000,
            deliveryTime: '3 days',
            items: [
              { itemName: 'Cement', unitPrice: 10000, total: 500000 }
            ]
          }
        ]
      }
    }
  })
  async getQuoteDetails(
    @Request() req,
    @Param('id') quoteId: string,
  ) {
    return this.contractorsService.getQuoteWithSupplierQuotes(
      req.user.userId,
      quoteId,
    );
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get contractor orders' })
  @ApiResponse({ status: 200, description: 'Returns list of orders' })
  async getOrders(@Request() req) {
    return this.contractorsService.getContractorOrders(req.user.userId);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get contractor dashboard statistics',
    description: `
      **Provides overview statistics for contractor dashboard**
      
      **Returns:**
      - Total quotes created
      - Active quotes (pending supplier responses)
      - Total orders placed
      - Pending orders (not yet delivered)
      - Total materials requested
      - Recent activity summary
      
      **Use for:**
      - Dashboard home page
      - Quick overview cards
      - Activity tracking
      - Performance metrics
      
      **Frontend display:**
      - Show stats in cards/widgets
      - Use charts for trends
      - Highlight important metrics
      - Link to detailed pages
      
      **Updates:** Real-time stats, refreshed on each request
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics',
    schema: {
      example: {
        totalQuotes: 15,
        activeQuotes: 3,
        totalOrders: 8,
        pendingOrders: 2,
        totalMaterialsRequested: 234,
        recentActivity: [
          {
            type: 'quote_created',
            description: 'New quote for Office Building',
            timestamp: '2025-12-17T09:00:00.000Z'
          }
        ]
      }
    }
  })
  async getDashboardStats(@Request() req) {
    return this.contractorsService.getContractorDashboardStats(req.user.userId);
  }
}
