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
@Controller('api/v1/contractors')
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get contractor profile' })
  @ApiResponse({ status: 200, description: 'Returns contractor profile' })
  async getProfile(@Request() req) {
    return this.contractorsService.getContractorProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update contractor profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
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
  @ApiOperation({ summary: 'Get contractor quotes' })
  @ApiResponse({ status: 200, description: 'Returns list of quotes' })
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
  @ApiOperation({ summary: 'Get quote with supplier quotes' })
  @ApiResponse({ status: 200, description: 'Returns quote details with supplier quotes' })
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
  @ApiOperation({ summary: 'Get contractor dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Returns dashboard stats' })
  async getDashboardStats(@Request() req) {
    return this.contractorsService.getContractorDashboardStats(req.user.userId);
  }
}
