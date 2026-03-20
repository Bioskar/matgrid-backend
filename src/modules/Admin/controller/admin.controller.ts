import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { AdminService } from '../service/admin.service';
import {
  UpdatePlatformSettingsDto,
  ListQueryDto,
  RejectKycDto,
  ResolveDisputeDto,
  ReleaseEscrowDto,
} from '../dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get admin dashboard overview',
    description: `
      Returns all data required for the admin dashboard page:
      - **Stats:** GTV this month, Escrow Balance, Active Orders count, Active Suppliers count
      - **Action Center:** Pending transfers, New supplier applications, Order disputes
      - **Recent Orders:** Last 10 orders with contractor, amount, and status
      - **System Health:** Payment gateway, matching engine, notification service status

      All order statuses are frontend-mapped (e.g. \`paid\` → \`payment received\`, \`shipped\` → \`in transit\`).
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data returned successfully',
    schema: {
      example: {
        stats: {
          gtvThisMonth: 4850000,
          escrowBalance: 1200000,
          activeOrders: 24,
          activeSuppliers: 18,
        },
        actionCenter: {
          pendingTransfers: 12,
          newSupplierApps: 5,
          orderDisputes: 1,
        },
        recentOrders: [
          {
            orderId: 'ORD-001',
            contractor: 'Emeka Construction Ltd',
            amount: 450000,
            currency: 'NGN',
            status: 'payment received',
            escrowStatus: 'funds_held',
            createdAt: '2026-03-14T10:00:00.000Z',
          },
        ],
        systemHealth: {
          paymentGateway: 'operational',
          matchingEngine: 'operational',
          notificationService: 'operational',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // ── RFQ Management ────────────────────────────────────────────────────────

  @Get('rfq/stats')
  @ApiOperation({
    summary: 'Get RFQ summary stats',
    description: 'Returns total RFQ counts broken down by status for the stats cards on the RFQ management page.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { total: 120, awaitingSelection: 34, awarded: 55, expiredOrCancelled: 31 } },
  })
  getRfqStats() {
    return this.adminService.getRfqStats();
  }

  @Get('rfq')
  @ApiOperation({
    summary: 'List all RFQs (admin view)',
    description: `
      Paginated list of all RFQs/Quotes across all contractors.

      **Table columns served:** RFQ ID, Contractor, Items count, Quotes count, Time Left (days), Status

      **Status filter values:** \`active\`, \`quoted\`, \`awarded\`, \`expired\`

      **Status mapping (backend → frontend):**
      - \`draft\` → \`active\`
      - \`in-review\` → \`quotes received\`
      - \`finalized\` → \`awarded\`
      - \`archived\` → \`expired\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'quoted', 'awarded', 'expired'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by contractor name or RFQ title' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            rfqId: 'uuid-here',
            contractor: 'Lagos Builders Co.',
            contractorEmail: 'info@lagosbuilders.com',
            title: 'Block Supply Q1',
            itemsCount: 5,
            quotesCount: 3,
            deadline: '2026-04-01T00:00:00.000Z',
            timeLeftDays: 18,
            status: 'quotes received',
            createdAt: '2026-03-01T08:00:00.000Z',
          },
        ],
        total: 120,
        page: 1,
        limit: 20,
      },
    },
  })
  getRfqs(@Query() query: ListQueryDto) {
    return this.adminService.getRfqs(query);
  }

  // ── Order Management ──────────────────────────────────────────────────────

  @Get('orders/stats')
  @ApiOperation({
    summary: 'Get order summary stats',
    description: 'Returns active, disputed, and completed order counts for the Order Management page stats cards.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { active: 24, disputed: 1, completed: 95 } },
  })
  getOrderStats() {
    return this.adminService.getOrderStats();
  }

  @Get('orders')
  @ApiOperation({
    summary: 'List all orders (admin view)',
    description: `
      Paginated list of all orders across all contractors.

      **Table columns served:** Order ID, Contractor, Supplier(s), Amount, Status, Escrow Status

      **Status filter values:** \`active\`, \`disputed\`, \`completed\`

      **Order status mapping (backend → frontend):**
      - \`paid\` → \`payment received\`
      - \`processing\` → \`processing\`
      - \`shipped\` → \`in transit\`
      - \`delivered\` → \`delivered\`
      - \`disputed\` → \`disputed\`
      - \`completed\` → \`completed\`

      **Escrow status values:** \`none\`, \`funds_held\`, \`released_to_client\`, \`disputed\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'disputed', 'completed'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by order number or contractor name' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            id: 'order-uuid',
            orderId: 'ORD-001',
            contractor: 'Emeka Construction Ltd',
            contractorEmail: 'emeka@construction.com',
            suppliers: ['BuildMat Supplies', 'CemCo Ltd'],
            amount: 450000,
            currency: 'NGN',
            status: 'in transit',
            escrowStatus: 'funds_held',
            createdAt: '2026-03-10T09:00:00.000Z',
          },
        ],
        total: 150,
        page: 1,
        limit: 20,
      },
    },
  })
  getOrders(@Query() query: ListQueryDto) {
    return this.adminService.getOrders(query);
  }

  @Put('orders/:id/resolve')
  @ApiOperation({
    summary: 'Resolve an order dispute',
    description: `
      Moves a \`disputed\` order back to \`processing\` status.

      - Only works on orders with status \`disputed\`
      - Triggered by the "resolve" action button on the admin orders page
      - Optionally accepts a resolution note in the request body
    `,
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Dispute resolved. Order moved back to processing.' } } })
  @ApiResponse({ status: 400, description: 'Order is not in disputed status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(id, dto);
  }

  @Put('orders/:id/escrow/release')
  @ApiOperation({
    summary: 'Release escrow funds for an order',
    description: `
      Releases held escrow funds for a specific order.

      - Order must have \`escrowStatus: funds_held\`
      - Updates both the order's \`escrowStatus\` to \`released_to_client\` and the linked EscrowTransaction to \`released\`
      - Use this when releasing escrow directly from the orders table view
    `,
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Escrow funds released successfully.' } } })
  @ApiResponse({ status: 400, description: 'No funds held in escrow for this order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  releaseOrderEscrow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseEscrowDto,
  ) {
    return this.adminService.releaseOrderEscrow(id, dto);
  }

  // ── Contractors ───────────────────────────────────────────────────────────

  @Get('contractors/stats')
  @ApiOperation({
    summary: 'Get contractor summary stats',
    description: 'Returns total, active, pending, and suspended contractor counts for the Contractors page.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { total: 82, active: 64, pending: 12, suspended: 6 } },
  })
  getContractorStats() {
    return this.adminService.getContractorStats();
  }

  @Get('contractors')
  @ApiOperation({
    summary: 'List all contractors (admin view)',
    description: `
      Paginated list of all contractors with their order count and total contract value.

      **Table columns served:** Name + Email, Orders count, Contract value (total amount), Status

      **Status values:** \`active\`, \`pending\`, \`suspended\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'pending', 'suspended'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, company, or email' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            id: 'contractor-uuid',
            name: 'Emeka Okafor',
            email: 'emeka@construction.com',
            company: 'Emeka Construction Ltd',
            status: 'active',
            ordersCount: 12,
            contractValue: 2400000,
            createdAt: '2025-11-01T00:00:00.000Z',
          },
        ],
        total: 82,
        page: 1,
        limit: 20,
      },
    },
  })
  getContractors(@Query() query: ListQueryDto) {
    return this.adminService.getContractors(query);
  }

  @Put('contractors/:id/suspend')
  @ApiOperation({
    summary: 'Suspend a contractor',
    description: `
      Sets the contractor status to \`suspended\` and deactivates their account.

      - Triggered by the "suspend" action button on active contractors
      - Sets \`contractor.status = suspended\`, \`contractor.isActive = false\`, \`user.isActive = false\`
    `,
  })
  @ApiParam({ name: 'id', description: 'Contractor user UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Contractor suspended successfully.' } } })
  @ApiResponse({ status: 400, description: 'Contractor is already suspended' })
  @ApiResponse({ status: 404, description: 'Contractor not found' })
  suspendContractor(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.suspendContractor(id);
  }

  @Put('contractors/:id/reactivate')
  @ApiOperation({
    summary: 'Reactivate a suspended contractor',
    description: `
      Sets the contractor status back to \`active\` and re-enables their account.

      - Triggered by the "reactivate" action button on suspended contractors
    `,
  })
  @ApiParam({ name: 'id', description: 'Contractor user UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Contractor reactivated successfully.' } } })
  @ApiResponse({ status: 400, description: 'Contractor is already active' })
  @ApiResponse({ status: 404, description: 'Contractor not found' })
  reactivateContractor(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.reactivateContractor(id);
  }

  // ── Suppliers ─────────────────────────────────────────────────────────────

  @Get('suppliers/stats')
  @ApiOperation({
    summary: 'Get supplier summary stats',
    description: 'Returns total, active, pending, and suspended supplier counts for the Suppliers page.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { total: 60, active: 45, pending: 10, suspended: 5 } },
  })
  getSupplierStats() {
    return this.adminService.getSupplierStats();
  }

  @Get('suppliers')
  @ApiOperation({
    summary: 'List all suppliers (admin view)',
    description: `
      Paginated list of all suppliers with their order count and rating.

      **Table columns served:** Name + Email, Orders count, Rating (0–5 stars), Status

      **Status derivation:**
      - \`active\` = isActive=true AND verificationStatus=verified
      - \`pending\` = verificationStatus=pending
      - \`suspended\` = isActive=false
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'pending', 'suspended'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            id: 'supplier-uuid',
            name: 'BuildMat Supplies',
            email: 'sales@buildmat.com',
            rating: 4.7,
            status: 'active',
            verificationStatus: 'verified',
            ordersCount: 38,
            createdAt: '2025-10-01T00:00:00.000Z',
          },
        ],
        total: 60,
        page: 1,
        limit: 20,
      },
    },
  })
  getSuppliers(@Query() query: ListQueryDto) {
    return this.adminService.getSuppliers(query);
  }

  @Put('suppliers/:id/suspend')
  @ApiOperation({
    summary: 'Suspend a supplier',
    description: 'Sets supplier isActive to false and deactivates their user account.',
  })
  @ApiParam({ name: 'id', description: 'Supplier user UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Supplier suspended successfully.' } } })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  suspendSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.suspendSupplier(id);
  }

  @Put('suppliers/:id/reactivate')
  @ApiOperation({
    summary: 'Reactivate a suspended supplier',
    description: 'Sets supplier isActive to true and re-enables their user account.',
  })
  @ApiParam({ name: 'id', description: 'Supplier user UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Supplier reactivated successfully.' } } })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  reactivateSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.reactivateSupplier(id);
  }

  @Put('suppliers/:id/approve')
  @ApiOperation({
    summary: 'Approve a pending supplier',
    description: `
      Approves a supplier's application — sets verificationStatus to \`verified\` and activates their account.

      - Triggered by the "Review → Approve" action on pending suppliers
    `,
  })
  @ApiParam({ name: 'id', description: 'Supplier user UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Supplier approved successfully.' } } })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  approveSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.reviewSupplier(id, 'approve');
  }

  @Put('suppliers/:id/reject')
  @ApiOperation({
    summary: 'Reject a pending supplier',
    description: 'Rejects a supplier application — sets verificationStatus to rejected and deactivates the account.',
  })
  @ApiParam({ name: 'id', description: 'Supplier user UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Supplier rejected successfully.' } } })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  rejectSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.reviewSupplier(id, 'reject', body.reason);
  }

  // ── Finance & Escrow ──────────────────────────────────────────────────────

  @Get('finance/stats')
  @ApiOperation({
    summary: 'Get finance & escrow summary stats',
    description: 'Returns total held in escrow, released today (amount), pending release count, and under dispute count for the Finance page stats cards.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        totalHeldInEscrow: 1200000,
        releasedToday: 320000,
        pendingRelease: 12,
        underDispute: 1,
      },
    },
  })
  getFinanceStats() {
    return this.adminService.getFinanceStats();
  }

  @Get('finance')
  @ApiOperation({
    summary: 'List all escrow transactions (admin view)',
    description: `
      Paginated list of all escrow transactions for the Finance & Escrow page.

      **Table columns served:** ESC-ID, Order Number, Contractor, Supplier, Amount, Delivery Status, Escrow Status

      **Escrow status filter values:** \`held\`, \`released\`, \`disputed\`

      **Escrow status mapping (backend → frontend):**
      - \`held\` → \`held in escrow\`
      - \`released\` → \`released\`
      - \`disputed\` → \`disputed\`

      **Delivery status mapping (backend → frontend):**
      - \`in_transit\` → \`in transit\`
      - \`delivered\` → \`delivered\`
      - \`delivery_confirmed\` → \`delivery confirmed\`
      - \`awaiting_confirmation\` → \`delivered - awaiting confirmation\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['held', 'released', 'disputed'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by ESC-ID, order number, or party name' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            escrowId: 'ESC-LX3KA9F2',
            orderId: 'ORD-001',
            contractor: 'Emeka Construction Ltd',
            supplier: 'BuildMat Supplies',
            amount: 450000,
            currency: 'NGN',
            deliveryStatus: 'in transit',
            escrowStatus: 'held in escrow',
            releasedAt: null,
            createdAt: '2026-03-10T09:00:00.000Z',
          },
        ],
        total: 48,
        page: 1,
        limit: 20,
      },
    },
  })
  getEscrowTransactions(@Query() query: ListQueryDto) {
    return this.adminService.getEscrowTransactions(query);
  }

  @Put('finance/:id/release')
  @ApiOperation({
    summary: 'Release escrow funds (from finance view)',
    description: `
      Releases held escrow funds by EscrowTransaction UUID.

      - Triggered by the "release fund" button on the Finance & Escrow page
      - The escrow transaction must have \`escrowStatus: held\`
      - Also updates the linked order's \`escrowStatus\` to \`released_to_client\`
    `,
  })
  @ApiParam({ name: 'id', description: 'EscrowTransaction UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Escrow funds released successfully.' } } })
  @ApiResponse({ status: 400, description: 'Escrow funds are not in held status' })
  @ApiResponse({ status: 404, description: 'Escrow transaction not found' })
  releaseEscrowFunds(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseEscrowDto,
  ) {
    return this.adminService.releaseEscrowFunds(id, dto);
  }

  // ── KYC ───────────────────────────────────────────────────────────────────

  @Get('kyc/stats')
  @ApiOperation({
    summary: 'Get KYC summary stats',
    description: 'Returns total, pending, approved, and rejected KYC submission counts (grouped by user) for the Identity & KYC page.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { total: 45, pending: 8, approved: 32, rejected: 5 } },
  })
  getKycStats() {
    return this.adminService.getKycStats();
  }

  @Get('kyc')
  @ApiOperation({
    summary: 'List KYC submissions grouped by user (admin view)',
    description: `
      Paginated list of KYC submissions grouped by supplier/user for the Identity & KYC page.

      **Table columns served:** Supplier name + email, Documents count, Submission date, Status

      **Status mapping (backend → frontend):**
      - \`pending\` / \`under_review\` → \`pending review\`
      - \`verified\` → \`verified\`
      - \`rejected\` → \`resubmitted\`

      **Status filter values:** \`pending\`, \`verified\`, \`resubmitted\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'verified', 'resubmitted'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by supplier name or email' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        data: [
          {
            userId: 'user-uuid',
            supplier: 'Amaka Obi',
            email: 'amaka@supplierco.com',
            documentsCount: 3,
            submittedAt: '2026-03-08T12:00:00.000Z',
            status: 'pending review',
          },
        ],
        total: 45,
        page: 1,
        limit: 20,
      },
    },
  })
  getKycSubmissions(@Query() query: ListQueryDto) {
    return this.adminService.getKycSubmissions(query);
  }

  @Put('kyc/:userId/approve')
  @ApiOperation({
    summary: 'Approve KYC for a user',
    description: `
      Approves all KYC documents for a user and updates their supplier verification status.

      - Sets all KYC docs \`verificationStatus\` → \`verified\`
      - If user is a supplier, also sets \`supplier.verificationStatus = verified\` and \`isActive = true\`
    `,
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'KYC approved successfully.' } } })
  @ApiResponse({ status: 404, description: 'No KYC documents found for this user' })
  approveKyc(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.approveKyc(userId);
  }

  @Put('kyc/:userId/reject')
  @ApiOperation({
    summary: 'Reject KYC for a user',
    description: `
      Rejects all KYC documents for a user with a reason and updates their supplier verification status.

      - Sets all KYC docs \`verificationStatus\` → \`rejected\`
      - If user is a supplier, also sets \`supplier.verificationStatus = rejected\` and \`isActive = false\`
    `,
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'KYC rejected.' } } })
  @ApiResponse({ status: 404, description: 'No KYC documents found for this user' })
  rejectKyc(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RejectKycDto,
  ) {
    return this.adminService.rejectKyc(userId, dto);
  }

  // ── Platform Settings ─────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({
    summary: 'Get platform settings',
    description: `
      Returns all current platform configuration values for the System Ops / Settings page.

      **Sections returned:**
      - **General:** platformName, supportEmail, supportPhone
      - **Payment & Escrow:** platformFeePercent, escrowHoldPeriodDays
      - **Notifications:** maintenanceMode, smsNotifications
      - **Security & Access:** autoApproveVerifiedSuppliers
    `,
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        id: 'settings-uuid',
        platformName: 'MatGrid',
        supportEmail: 'support@matgrid.com',
        supportPhone: '+2348012345678',
        platformFeePercent: 2.5,
        escrowHoldPeriodDays: 7,
        maintenanceMode: false,
        smsNotifications: true,
        autoApproveVerifiedSuppliers: false,
        updatedAt: '2026-03-14T10:00:00.000Z',
      },
    },
  })
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Update platform settings',
    description: `
      Updates platform configuration. Only send the fields you want to change (partial updates supported).

      **Editable fields:**
      - \`platformName\` — Platform display name
      - \`supportEmail\` — Support contact email
      - \`supportPhone\` — Support contact phone
      - \`platformFeePercent\` — Transaction fee percentage (0–100)
      - \`escrowHoldPeriodDays\` — Days escrow is held before auto-release (1–365)
      - \`maintenanceMode\` — Toggle maintenance mode (boolean)
      - \`smsNotifications\` — Toggle SMS notifications (boolean)
      - \`autoApproveVerifiedSuppliers\` — Auto-approve suppliers after KYC verification (boolean)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    schema: {
      example: {
        id: 'settings-uuid',
        platformName: 'MatGrid',
        supportEmail: 'support@matgrid.com',
        supportPhone: '+2348012345678',
        platformFeePercent: 3.0,
        escrowHoldPeriodDays: 7,
        maintenanceMode: false,
        smsNotifications: true,
        autoApproveVerifiedSuppliers: false,
        updatedAt: '2026-03-14T12:30:00.000Z',
      },
    },
  })
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updateSettings(dto);
  }
}
