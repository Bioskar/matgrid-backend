import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserPayload } from '../../../common/interfaces/user-payload.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { ContractorsService } from '../service/contractors.service';
import { BOQParserService } from '../service/boq-parser.service';
import { FileBOQParserService } from '../service/file-boq-parser.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  CreateProjectWithBOQDto,
  ParseBOQDto,
  AddParsedMaterialsDto,
} from '../dto/boq-parse.dto';
import { UploadBOQFileDto } from '../dto/upload-boq.dto';
import { CreateQuickQuoteDto } from '../dto/quick-quote.dto';
import { ProjectStatus } from '../entities/project.entity';

@ApiTags('Contractors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTRACTOR)
@Controller('contractors')
export class ContractorsController {
  constructor(
    private readonly contractorsService: ContractorsService,
    private readonly boqParserService: BOQParserService,
    private readonly fileBOQParserService: FileBOQParserService,
  ) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get contractor profile',
    description: `
      **Retrieves the complete contractor profile information**
      
      **Returns:**
      - Personal information (name, phone, email)
      - Company details
      - Business/Registered address
      - Profile photo
      - Account creation date
      - KYC verification status
      
      **KYC Status:**
      - verificationStatus: Overall status (not_started, pending, partially_verified, verified, rejected)
      - isFullyVerified: Both identity and business documents verified
      - isIdentityVerified: Government ID verified (NIN/License/Voter Card)
      - isBusinessVerified: CAC Certificate verified
      - documentsCount: Total number of documents uploaded
      
      **Use for:**
      - Profile page display
      - Pre-filling forms (quote requests, orders)
      - Account settings
      - Showing "Complete KYC" banner when verification is pending
      
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
        businessAddress: '14 Adeola Odeku St, VI, Lagos',
        profilePhoto: 'https://example.com/photos/profile.jpg',
        createdAt: '2025-12-01T10:00:00.000Z',
        kycStatus: {
          verificationStatus: 'pending',
          isFullyVerified: false,
          isIdentityVerified: true,
          isBusinessVerified: false,
          documentsCount: 2
        }
      }
    }
  })
  async getProfile(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getContractorProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update contractor profile',
    description: `
      **Updates contractor profile information**
      
      **Updatable fields:**
      - fullName: Full name (min 2 characters)
      - company: Company name
      - businessAddress: Business/Registered address
      - profilePhoto: URL to profile image
      - email: Email address (must be unique)
      
      **Read-only fields (cannot be updated):**
      - phoneNumber: Set during registration, cannot be changed
      - kycStatus: Managed through KYC verification endpoints
      
      **All fields are optional** - only send fields you want to update
      
      **Frontend tips:**
      - Show success message after update
      - Refresh profile data after successful update
      - Validate email format before sending
      - Allow image upload for profilePhoto
      - Display phone number as read-only/grayed out
      
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
  async updateProfile(@CurrentUser() user: UserPayload, @Body() updateDto: UpdateProfileDto) {
    return this.contractorsService.updateContractorProfile(
      user.userId,
      updateDto,
    );
  }

  @Get('materials')
  @ApiOperation({ summary: 'Get contractor materials list' })
  @ApiResponse({ status: 200, description: 'Returns list of materials' })
  async getMaterials(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getContractorMaterials(user.userId);
  }

  @Get('materials/search')
  @ApiOperation({ summary: 'Search contractor materials' })
  @ApiResponse({ status: 200, description: 'Returns filtered materials' })
  async searchMaterials(@CurrentUser() user: UserPayload, @Query('q') searchTerm: string) {
    return this.contractorsService.searchMaterials(user.userId, searchTerm);
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
  async getQuotes(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getContractorQuotes(user.userId);
  }

  @Get('quotes/active')
  @ApiOperation({ summary: 'Get active quotes' })
  @ApiResponse({ status: 200, description: 'Returns active quotes' })
  async getActiveQuotes(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getActiveQuotes(user.userId);
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
    @CurrentUser() user: UserPayload,
    @Param('id') quoteId: string,
  ) {
    return this.contractorsService.getQuoteWithSupplierQuotes(
      user.userId,
      quoteId,
    );
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get contractor orders' })
  @ApiResponse({ status: 200, description: 'Returns list of orders' })
  async getOrders(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getContractorOrders(user.userId);
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
  async getDashboardStats(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getContractorDashboardStats(user.userId);
  }

  // ============== PROJECT MANAGEMENT ENDPOINTS ==============

  @Post('projects')
  @ApiOperation({
    summary: 'Create new project',
    description: `
      **Step 1: Create a project with basic details**
      
      **Required fields:**
      - projectName: Name of the construction project
      - deliveryAddress: Where materials should be delivered
      
      **Optional fields:**
      - description: Additional project details
      - notes: Special instructions
      
      **Workflow:**
      1. Create project (this endpoint)
      2. Parse BOQ text (POST /contractors/projects/parse-boq)
      3. Add parsed materials (POST /contractors/projects/:projectId/materials)
      4. Submit request to suppliers
      
      **Use for:**
      - "Project Details" form submission
      - Creating project before pasting BOQ
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        projectName: 'Lekki 3 bedroom flat',
        deliveryLocation: '3 Bake Lekki',
        status: 'draft',
        quotesCount: 0,
        materialsCount: 0,
        createdAt: '2026-01-07T10:00:00.000Z',
      },
    },
  })
  async createProject(@CurrentUser() user: UserPayload, @Body() dto: CreateProjectWithBOQDto) {
    return this.contractorsService.createProject(user.userId, dto);
  }

  @Post('projects/parse-boq')
  @ApiOperation({
    summary: 'Parse BOQ text using AI',
    description: `
      **Step 2: Parse pasted Bill of Quantities text**
      
      **Input:** Free-form text pasted from Excel, Word, or any format
      
      **Supported formats:**
      - "Item 1: 500 Bags of Cement (Dangote)"
      - "25 Tons of Sharp Sand"
      - "Cement - 50 bags"
      - "16mm Reinforcement Steel (15 lengths)"
      
      **AI extraction:**
      - Material name
      - Quantity
      - Unit of measurement
      - Confidence score
      
      **Returns:** Parsed materials ready for review
      
      **Use for:**
      - "Paste List" → "Analyze with AI" flow
      - Showing "Analyzing your list..." loading state
      - Displaying parsed results for review
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'BOQ parsed successfully',
    schema: {
      example: {
        itemsFound: 4,
        materials: [
          {
            name: 'Cement (Dangote)',
            quantity: 50,
            unit: 'bags',
            originalText: 'Item 1: 500 Bags of Cement (Dangote/Lafarge)',
            confidence: 0.95,
          },
          {
            name: 'Sharp Sand',
            quantity: 10,
            unit: 'tonnes',
            originalText: 'Item 2: 25 Tons of Sharp Sand',
            confidence: 0.9,
          },
        ],
        warnings: ['Please review quantities'],
      },
    },
  })
  async parseBOQ(@Body() dto: ParseBOQDto) {
    return this.boqParserService.parseBOQ(dto);
  }

  @Post('projects/upload-boq')
  @ApiOperation({
    summary: 'Upload Excel/PDF BOQ file',
    description: `
      **Alternative to text paste: Upload Excel or PDF file**
      
      **Supported formats:**
      - Excel: .xlsx, .xls
      - PDF: .pdf (coming soon)
      
      **Excel file structure:**
      The parser automatically detects common patterns:
      
      **Pattern 1 (4+ columns):**
      | S/N | Description | Quantity | Unit |
      |-----|-------------|----------|------|
      | 1   | Cement (Dangote) | 500 | bags |
      | 2   | Sharp Sand | 25 | tonnes |
      
      **Pattern 2 (3 columns):**
      | Material | Quantity | Unit |
      |----------|----------|------|
      | Cement   | 50       | bags |
      
      **Pattern 3 (2 columns):**
      | Material | Quantity |
      |----------|----------|
      | 500 Bags of Cement | 50 |
      
      **Features:**
      - Skips header row automatically
      - Extracts quantity from various formats
      - Guesses units based on material name
      - Cleans up material names
      - Returns confidence scores
      
      **Use for:**
      - "Upload List" button flow
      - Drag & drop Excel files
      - Bulk import from spreadsheets
      
      **Note:** This endpoint accepts multipart/form-data with a file field named "file"
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'File parsed successfully',
    schema: {
      example: {
        itemsFound: 5,
        materials: [
          {
            name: 'Cement (Dangote)',
            quantity: 50,
            unit: 'bags',
            originalText: 'Row 2: 1 | Cement (Dangote) | 50 | bags',
            confidence: 0.85,
          },
          {
            name: 'Sharp Sand',
            quantity: 10,
            unit: 'tonnes',
            originalText: 'Row 3: 2 | Sharp Sand | 10 | tonnes',
            confidence: 0.85,
          },
        ],
        warnings: [],
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadBOQFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const materials = await this.fileBOQParserService.parseFile(file);

    return {
      itemsFound: materials.length,
      materials,
      warnings: materials.length === 0 
        ? ['No materials could be extracted from the file. Please check the format.']
        : [],
    };
  }

  @Post('projects/:projectId/materials')
  @ApiOperation({
    summary: 'Add parsed materials to project',
    description: `
      **Step 3: Confirm and add materials to project**
      
      **Input:** Materials from parse-boq endpoint (after user review/edits)
      
      **Actions:**
      - Creates a quote linked to the project
      - Adds all materials to the quote
      - Updates project status to "review_quotes"
      - Ready for supplier submission
      
      **Use for:**
      - "Review List" → "Submit Request" button
      - Creating quote from confirmed materials
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Materials added to project',
    schema: {
      example: {
        id: '660e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Lekki 3 bedroom flat - Materials Request',
        status: 'draft',
        materialsCount: 4,
        materials: [
          {
            id: '770e8400-e29b-41d4-a716-446655440000',
            name: 'Cement (Dangote)',
            quantity: 50,
            unit: 'bags',
          },
        ],
      },
    },
  })
  async addMaterialsToProject(
    @CurrentUser() user: UserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: AddParsedMaterialsDto,
  ) {
    return this.contractorsService.addMaterialsToProject(
      user.userId,
      projectId,
      dto.materials,
    );
  }

  @Get('projects')
  @ApiOperation({
    summary: 'Get all projects',
    description: `
      **Retrieve all contractor projects**
      
      **Optional filters:**
      - status: Filter by project status
      
      **Status values:**
      - draft: Project created, no materials yet
      - review_quotes: Materials added, awaiting supplier quotes
      - in_progress: Order placed, materials being delivered
      - completed: Project finished
      - cancelled: Project cancelled
      
      **Use for:**
      - Projects dashboard/list page
      - "Project History" tab
      - Status-based filtering
    `,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ProjectStatus,
    description: 'Filter by project status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          projectName: 'Coconut Grove Apartments',
          deliveryLocation: 'Coconut Grove Lagos',
          status: 'review_quotes',
          quotesCount: 1,
          materialsCount: 20,
          totalBudget: 600000,
          createdAt: '2024-11-15T00:00:00.000Z',
        },
      ],
    },
  })
  async getProjects(@CurrentUser() user: UserPayload, @Query('status') status?: ProjectStatus) {
    return this.contractorsService.getProjects(user.userId, status);
  }

  @Get('projects/:projectId')
  @ApiOperation({
    summary: 'Get project details',
    description: `
      **Retrieve single project with all quotes and materials**
      
      **Returns:**
      - Project information
      - All linked quotes
      - Materials in each quote
      - Supplier responses (if any)
      
      **Use for:**
      - Project detail page
      - "View Details" button
      - Reviewing materials and quotes
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Project details',
  })
  async getProjectById(@CurrentUser() user: UserPayload, @Param('projectId') projectId: string) {
    return this.contractorsService.getProjectById(user.userId, projectId);
  }

  @Get('dashboard-v2')
  @ApiOperation({
    summary: 'Get enhanced dashboard with projects',
    description: `
      **Enhanced dashboard with project statistics**
      
      **Returns:**
      - All basic stats (orders, quotes, materials)
      - Project counts by status
      - Recent projects (last 5)
      - Total spent on orders
      
      **Use for:**
      - New dashboard with project cards
      - Project status breakdown
      - Recent activity display
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Enhanced dashboard statistics',
    schema: {
      example: {
        materialsCount: 234,
        quotesCount: 15,
        ordersCount: 8,
        pendingOrdersCount: 2,
        totalSpent: 1250000,
        projectsCount: 6,
        projectsByStatus: {
          draft: 1,
          reviewQuotes: 2,
          inProgress: 2,
          completed: 1,
          cancelled: 0,
        },
        recentProjects: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            projectName: 'Coconut Grove Apartments',
            status: 'review_quotes',
            materialsCount: 20,
            createdAt: '2024-11-15T00:00:00.000Z',
          },
        ],
      },
    },
  })
  async getDashboardWithProjects(@CurrentUser() user: UserPayload) {
    return this.contractorsService.getDashboardWithProjects(user.userId);
  }

  // ============== QUICK QUOTE ENDPOINTS ==============

  @Post('quotes/quick')
  @ApiOperation({
    summary: 'Create quick quote request (Type Manually)',
    description: `
      **Simplified quote creation for manual material entry**
      
      **Use case:** "Type Manually" option from Request Material Quote modal
      
      **Workflow:**
      1. User clicks "Request New Quote" button
      2. Modal shows 3 options (Upload/Paste/Type Manually)
      3. User selects "Type Manually"
      4. User enters materials one by one
      5. Submits to this endpoint
      
      **Features:**
      - Creates project automatically (or uses provided name)
      - Creates quote with entered materials
      - Sets default delivery location if not provided
      - Returns complete quote ready to share with suppliers
      
      **What happens next:**
      - Quote is created in "draft" status
      - Materials are added to quote
      - Project status becomes "review_quotes"
      - Frontend can navigate to quote detail page
      - User can invite suppliers to respond
      
      **Difference from other methods:**
      - Upload PDF/Excel → POST /contractors/projects/upload-boq
      - Paste Material List → POST /contractors/projects/parse-boq
      - Type Manually → This endpoint (POST /contractors/quotes/quick)
      
      **Use for:**
      - Quick quote requests with few items
      - When user doesn't have a file or list
      - Manual data entry from dashboard
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Quick quote created successfully',
    schema: {
      example: {
        project: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          projectName: 'Material Request - 2026-01-07',
          deliveryLocation: 'Lekki, Lagos',
          status: 'review_quotes',
          quotesCount: 1,
          materialsCount: 3,
        },
        quote: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          title: 'Material Request - 2026-01-07 - Materials Request',
          status: 'draft',
          materialsCount: 3,
          materials: [
            {
              id: '770e8400-e29b-41d4-a716-446655440000',
              name: 'Cement (Dangote)',
              quantity: 50,
              unit: 'bags',
              description: '50kg bags',
            },
            {
              id: '880e8400-e29b-41d4-a716-446655440000',
              name: 'Sharp Sand',
              quantity: 10,
              unit: 'tonnes',
            },
          ],
        },
        message: 'Quote request created successfully. You can now share with suppliers.',
      },
    },
  })
  async createQuickQuote(@CurrentUser() user: UserPayload, @Body() dto: CreateQuickQuoteDto) {
    return this.contractorsService.createQuickQuote(user.userId, dto);
  }

  @Get('quotes/request-options')
  @ApiOperation({
    summary: 'Get quote request options info',
    description: `
      **Returns information about the 3 quote request methods**
      
      **Use for:** Displaying "Request Material Quote" modal content
      
      **Returns:**
      - Upload PDF/Excel option details
      - Paste Material List option details
      - Type Manually option details
      - Endpoints to use for each method
      - Supported file formats
      
      **Frontend implementation:**
      - Show modal with 3 cards/buttons
      - Each button navigates to appropriate flow
      - Use returned endpoints for API calls
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Quote request options',
    schema: {
      example: {
        options: [
          {
            id: 'upload',
            title: 'Upload PDF/Excel',
            description: 'For detailed material lists',
            icon: 'document-upload',
            endpoint: 'POST /api/v1/contractors/projects/upload-boq',
            supportedFormats: ['.xlsx', '.xls', '.pdf'],
            method: 'file-upload',
          },
          {
            id: 'paste',
            title: 'Paste Material List',
            description: 'Copy and paste your list',
            icon: 'clipboard',
            endpoint: 'POST /api/v1/contractors/projects/parse-boq',
            supportedFormats: ['text', 'plain-text'],
            method: 'text-input',
          },
          {
            id: 'manual',
            title: 'Type Manually',
            description: 'Enter items one by one',
            icon: 'pencil',
            endpoint: 'POST /api/v1/contractors/quotes/quick',
            supportedFormats: ['manual-entry'],
            method: 'form-input',
          },
        ],
      },
    },
  })
  async getQuoteRequestOptions() {
    return {
      options: [
        {
          id: 'upload',
          title: 'Upload PDF/Excel',
          description: 'For detailed material lists',
          icon: 'document-upload',
          endpoint: 'POST /api/v1/contractors/projects/upload-boq',
          supportedFormats: ['.xlsx', '.xls', '.pdf (coming soon)'],
          method: 'file-upload',
          notes: 'Automatically extracts materials from Excel spreadsheets',
        },
        {
          id: 'paste',
          title: 'Paste Material List',
          description: 'Copy and paste your list',
          icon: 'clipboard',
          endpoint: 'POST /api/v1/contractors/projects/parse-boq',
          supportedFormats: ['Plain text', 'Excel copied data'],
          method: 'text-input',
          notes: 'AI-powered parsing extracts materials from pasted text',
        },
        {
          id: 'manual',
          title: 'Type Manually',
          description: 'Enter items one by one',
          icon: 'pencil',
          endpoint: 'POST /api/v1/contractors/quotes/quick',
          supportedFormats: ['Manual entry form'],
          method: 'form-input',
          notes: 'Best for small lists or quick quote requests',
        },
      ],
      workflow: {
        upload: [
          'User uploads Excel/PDF file',
          'System extracts materials automatically',
          'User reviews and confirms materials',
          'Quote is created and shared with suppliers',
        ],
        paste: [
          'User pastes BOQ text from any source',
          'AI analyzes and extracts materials',
          'User reviews and edits if needed',
          'Quote is created and shared with suppliers',
        ],
        manual: [
          'User fills in material details in a form',
          'Add multiple items one by one',
          'Submit to create quote immediately',
          'Quote is created and shared with suppliers',
        ],
      },
    };
  }
}
