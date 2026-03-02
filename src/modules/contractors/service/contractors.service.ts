import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import pino from 'pino';
import { Contractor } from '../entities/contractor.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { Material } from '../../quotes/entities/material.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { SupplierQuote } from '../../suppliers/entities/supplier-quote.entity';
import { Order } from '../../orders/entities/order.entity';
import { ContractorProject, ProjectStatus } from '../entities/project.entity';
import { CreateContractorProjectDto } from '../dto/create-contractor-project.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { CreateProjectWithBOQDto, ParsedMaterialItem } from '../dto/boq-parse.dto';
import { CreateQuickQuoteDto } from '../dto/quick-quote.dto';
import { KycService } from '../../kyc/service/kyc.service';
import { BOQParserService } from './boq-parser.service';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(Contractor)
    private contractorRepository: Repository<Contractor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Material)
    private materialRepository: Repository<Material>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    @InjectRepository(SupplierQuote)
    private supplierQuoteRepository: Repository<SupplierQuote>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(ContractorProject)
    private projectRepository: Repository<ContractorProject>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
    private kycService: KycService,
    private boqParserService: BOQParserService,
  ) {}

  async getOrCreateContractor(userId: string): Promise<Contractor> {
    let contractor = await this.contractorRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!contractor) {
      const user = await this.userRepository.findOne({
        where: { id: userId, userRole: UserRole.CONTRACTOR },
      });

      if (!user) {
        throw new NotFoundException('User not found or not a contractor');
      }

      contractor = this.contractorRepository.create({
        userId: user.id,
        fullName: user.fullName,
        company: user.company,
        profilePhoto: user.profilePhoto,
      });

      contractor = await this.contractorRepository.save(contractor);
      contractor.user = user;
    }

    return contractor;
  }

  async getContractorProfile(userId: string): Promise<any> {
    const contractor = await this.getOrCreateContractor(userId);
    
    // Get KYC verification status
    const kycStatus = await this.kycService.getVerificationStatus(userId);
    
    return {
      id: contractor.userId,
      email: contractor.user.email,
      phoneNumber: contractor.user.phoneNumber,
      fullName: contractor.fullName,
      company: contractor.company,
      profilePhoto: contractor.profilePhoto,
      businessAddress: contractor.businessAddress,
      preferences: contractor.preferences,
      isEmailVerified: contractor.user.isEmailVerified,
      isPhoneVerified: contractor.user.isPhoneVerified,
      isActive: contractor.isActive,
      createdAt: contractor.createdAt,
      updatedAt: contractor.updatedAt,
      kycStatus: {
        verificationStatus: kycStatus.overallStatus,
        isFullyVerified: kycStatus.isFullyVerified,
        isIdentityVerified: kycStatus.isIdentityVerified,
        isBusinessVerified: kycStatus.isBusinessVerified,
        documentsCount: kycStatus.totalDocuments,
      },
    };
  }

  async updateContractorProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<any> {
    const contractor = await this.getOrCreateContractor(userId);

    // Update contractor-specific fields
    if (updateDto.fullName) contractor.fullName = updateDto.fullName;
    if (updateDto.company) contractor.company = updateDto.company;
    if (updateDto.profilePhoto) contractor.profilePhoto = updateDto.profilePhoto;
    if (updateDto.businessAddress !== undefined) contractor.businessAddress = updateDto.businessAddress;

    await this.contractorRepository.save(contractor);

    // Update user fields if provided
    if (updateDto.email) {
      contractor.user.email = updateDto.email;
      await this.userRepository.save(contractor.user);
    }

    return this.getContractorProfile(userId);
  }

  async getContractorMaterials(userId: string): Promise<Material[]> {
    const quotes = await this.quoteRepository.find({
      where: { userId },
      select: ['id'],
    });

    if (quotes.length === 0) {
      return [];
    }

    const quoteIds = quotes.map(q => q.id);
    
    return await this.materialRepository
      .createQueryBuilder('material')
      .where('material.quoteId IN (:...quoteIds)', { quoteIds })
      .orderBy('material.createdAt', 'DESC')
      .getMany();
  }

  async getContractorQuotes(userId: string): Promise<Quote[]> {
    return await this.quoteRepository.find({
      where: { userId },
      relations: ['materials'],
      order: { createdAt: 'DESC' },
    });
  }

  async getQuoteWithSupplierQuotes(
    userId: string,
    quoteId: string,
  ): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId, userId },
      relations: ['materials'],
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const supplierQuotes = await this.supplierQuoteRepository.find({
      where: { quoteId },
      relations: ['supplier', 'items'],
      order: { createdAt: 'DESC' },
    });

    return { ...quote, supplierQuotes } as any;
  }

  async getContractorOrders(userId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getContractorDashboardStats(userId: string): Promise<any> {
    const quotes = await this.quoteRepository.find({
      where: { userId },
      select: ['id'],
    });

    const quoteIds = quotes.map(q => q.id);
    
    let materialsCount = 0;
    if (quoteIds.length > 0) {
      materialsCount = await this.materialRepository
        .createQueryBuilder('material')
        .where('material.quoteId IN (:...quoteIds)', { quoteIds })
        .getCount();
    }

    const [quotesCount, ordersCount] = await Promise.all([
      this.quoteRepository.count({ where: { userId } }),
      this.orderRepository.count({ where: { userId } }),
    ]);

    const pendingOrders = await this.orderRepository.count({
      where: { userId, status: 'pending' },
    });

    const totalSpent = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.userId = :userId', { userId })
      .andWhere('order.paymentStatus = :status', { status: 'paid' })
      .getRawOne();

    return {
      materialsCount,
      quotesCount,
      ordersCount,
      pendingOrdersCount: pendingOrders,
      totalSpent: parseFloat(totalSpent?.total || '0'),
    };
  }

  async getActiveQuotes(userId: string): Promise<Quote[]> {
    return await this.quoteRepository.find({
      where: { userId, status: 'in-review' },
      relations: ['materials'],
      order: { createdAt: 'DESC' },
    });
  }

  async searchMaterials(userId: string, searchTerm: string): Promise<Material[]> {
    const quotes = await this.quoteRepository.find({
      where: { userId },
      select: ['id'],
    });

    if (quotes.length === 0) {
      return [];
    }

    const quoteIds = quotes.map(q => q.id);

    return await this.materialRepository
      .createQueryBuilder('material')
      .where('material.quoteId IN (:...quoteIds)', { quoteIds })
      .andWhere(
        '(LOWER(material.name) LIKE LOWER(:search) OR LOWER(material.category) LIKE LOWER(:search))',
        { search: `%${searchTerm}%` },
      )
      .orderBy('material.createdAt', 'DESC')
      .getMany();
  }

  // ============== PROJECT MANAGEMENT METHODS ==============

  async createProject(userId: string, dto: CreateProjectWithBOQDto): Promise<ContractorProject> {
    this.logger.info({ userId, projectName: dto.projectName }, '[Contractors] Creating new project');

    const project = this.projectRepository.create({
      userId,
      projectName: dto.projectName,
      deliveryLocation: dto.deliveryAddress,
      description: dto.description,
      notes: dto.notes,
      status: ProjectStatus.DRAFT,
    });

    const savedProject = await this.projectRepository.save(project);
    this.logger.info({ projectId: savedProject.id }, '[Contractors] Project created successfully');

    return savedProject;
  }

  async addMaterialsToProject(
    userId: string,
    projectId: string,
    materials: ParsedMaterialItem[],
  ): Promise<Quote> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.logger.info({ projectId, materialsCount: materials.length }, '[Contractors] Adding materials to project');

    // Create a quote for this project
    const quote = this.quoteRepository.create({
      userId,
      projectId,
      title: `${project.projectName} - Materials Request`,
      status: 'draft',
      currency: 'NGN',
    });

    const savedQuote = await this.quoteRepository.save(quote);

    // Create materials from parsed BOQ
    const materialEntities = materials.map(item => 
      this.materialRepository.create({
        quoteId: savedQuote.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        description: `Parsed from BOQ: ${item.originalText}`,
        sourceMethod: 'paste',
        currency: 'NGN',
      })
    );

    await this.materialRepository.save(materialEntities);

    // Update quote counts
    savedQuote.materialsCount = materials.length;
    await this.quoteRepository.save(savedQuote);

    // Update project counts
    project.quotesCount += 1;
    project.materialsCount += materials.length;
    project.status = ProjectStatus.REVIEW_QUOTES;
    await this.projectRepository.save(project);

    this.logger.info(
      { projectId, quoteId: savedQuote.id, materialsCount: materials.length },
      '[Contractors] Materials added to project successfully',
    );

    return savedQuote;
  }

  async getProjects(userId: string, status?: ProjectStatus): Promise<ContractorProject[]> {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return await this.projectRepository.find({
      where,
      relations: ['quotes'],
      order: { createdAt: 'DESC' },
    });
  }

  async getProjectById(userId: string, projectId: string): Promise<ContractorProject> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
      relations: ['quotes', 'quotes.materials'],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async updateProjectStatus(
    userId: string,
    projectId: string,
    status: ProjectStatus,
  ): Promise<ContractorProject> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    project.status = status;
    return await this.projectRepository.save(project);
  }

  async getDashboardWithProjects(userId: string): Promise<any> {
    const [basicStats, projects] = await Promise.all([
      this.getContractorDashboardStats(userId),
      this.getProjects(userId),
    ]);

    const projectsByStatus = {
      draft: projects.filter(p => p.status === ProjectStatus.DRAFT).length,
      reviewQuotes: projects.filter(p => p.status === ProjectStatus.REVIEW_QUOTES).length,
      inProgress: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
      completed: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
      cancelled: projects.filter(p => p.status === ProjectStatus.CANCELLED).length,
    };

    return {
      ...basicStats,
      projectsCount: projects.length,
      projectsByStatus,
      recentProjects: projects.slice(0, 5),
    };
  }

  async createQuickQuote(userId: string, dto: CreateQuickQuoteDto): Promise<any> {
    this.logger.info({ userId, materialsCount: dto.materials.length }, '[Contractors] Creating quick quote');

    // Create a project if name and location provided, otherwise use a default
    const projectName = dto.projectName || `Material Request - ${new Date().toISOString().split('T')[0]}`;
    const deliveryLocation = dto.deliveryLocation || 'To be specified';

    const project = this.projectRepository.create({
      userId,
      projectName,
      deliveryLocation,
      notes: dto.notes,
      status: ProjectStatus.DRAFT,
    });

    const savedProject = await this.projectRepository.save(project);

    // Create a quote for this project
    const quote = this.quoteRepository.create({
      userId,
      projectId: savedProject.id,
      title: `${projectName} - Materials Request`,
      status: 'draft',
      currency: 'NGN',
    });

    const savedQuote = await this.quoteRepository.save(quote);

    // Create materials from manual entry
    const materialEntities = dto.materials.map(item =>
      this.materialRepository.create({
        quoteId: savedQuote.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        description: item.description,
        brand: item.brand,
        sourceMethod: 'manual',
        currency: 'NGN',
      })
    );

    const savedMaterials = await this.materialRepository.save(materialEntities);

    // Update quote counts
    savedQuote.materialsCount = dto.materials.length;
    await this.quoteRepository.save(savedQuote);

    // Update project counts
    savedProject.quotesCount = 1;
    savedProject.materialsCount = dto.materials.length;
    savedProject.status = ProjectStatus.REVIEW_QUOTES;
    await this.projectRepository.save(savedProject);

    this.logger.info(
      { projectId: savedProject.id, quoteId: savedQuote.id, materialsCount: dto.materials.length },
      '[Contractors] Quick quote created successfully',
    );

    return {
      project: savedProject,
      quote: {
        ...savedQuote,
        materials: savedMaterials,
      },
      message: 'Quote request created successfully. You can now share with suppliers.',
    };
  }
}

