import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycDocument, DocumentType, VerificationStatus, DocumentSide } from '../entities/kyc-document.entity';
import { UploadDocumentDto, VerifyDocumentDto } from '../dto/upload-document.dto';
import { UserRole } from '../../auth/entities/user.entity';
import * as pino from 'pino';
import { User } from '../../auth/entities/user.entity';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

@Injectable()
export class KycService {
  private readonly identityDocumentTypes: DocumentType[] = [
    DocumentType.NIN_SLIP,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.VOTERS_CARD,
  ];

  private readonly addressDocumentTypes: DocumentType[] = [
    DocumentType.UTILITY_BILL,
    DocumentType.BANK_STATEMENT,
  ];

  private readonly businessDocumentTypes: DocumentType[] = [
    DocumentType.CAC_CERTIFICATE,
    DocumentType.TIN_CERTIFICATE,
  ];

  constructor(
    @InjectRepository(KycDocument)
    private kycDocumentRepository: Repository<KycDocument>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Upload KYC document for user
   */
  async uploadDocument(
    userId: string,
    uploadDto: UploadDocumentDto,
    file: Express.Multer.File,
  ): Promise<any> {
    try {
      // Check if document type already exists for user
      const existingDoc = await this.kycDocumentRepository.findOne({
        where: {
          userId,
          documentType: uploadDto.documentType,
          documentSide: uploadDto.documentSide ?? DocumentSide.FRONT,
        },
      });

      if (existingDoc && existingDoc.verificationStatus === VerificationStatus.VERIFIED) {
        throw new BadRequestException(
          `${uploadDto.documentType} is already verified. Cannot replace verified documents.`,
        );
      }

      // Use the R2 public URL attached by the controller
      const documentUrl = (file as any).r2Url as string;

      const documentData = {
        userId,
        documentType: uploadDto.documentType,
        documentUrl,
        documentSide: uploadDto.documentSide ?? DocumentSide.FRONT,
        documentNumber: uploadDto.documentNumber,
        verificationStatus: VerificationStatus.PENDING,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        mimeType: file.mimetype,
      };

      let document: KycDocument;

      if (existingDoc) {
        // Update existing document
        Object.assign(existingDoc, documentData);
        document = await this.kycDocumentRepository.save(existingDoc);
        
        this.logger.info(
          { userId, documentType: uploadDto.documentType, documentId: document.id },
          'KYC document updated',
        );
      } else {
        // Create new document
        document = this.kycDocumentRepository.create(documentData);
        document = await this.kycDocumentRepository.save(document);
        
        this.logger.info(
          { userId, documentType: uploadDto.documentType, documentId: document.id },
          'KYC document uploaded',
        );
      }

      // Notify admins for new submissions once per document type (front side as primary signal).
      if (!existingDoc && (uploadDto.documentSide ?? DocumentSide.FRONT) === DocumentSide.FRONT) {
        try {
          const uploader = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'fullName', 'email', 'userRole'],
          });

          const adminUsers = await this.userRepository.find({
            where: { userRole: UserRole.ADMIN, isActive: true },
            select: ['id'],
          });

          if (adminUsers.length > 0) {
            await Promise.all(
              adminUsers.map((admin) =>
                this.notificationsService.createNotification({
                  userId: admin.id,
                  type: NotificationType.ACCOUNT_WELCOME,
                  title: 'New KYC submission received',
                  message: `${uploader?.fullName || uploader?.email || 'A user'} uploaded ${uploadDto.documentType.replace('_', ' ')} for review.`,
                  metadata: {
                    actionUrl: '/dashboard/admin/identity-kyc',
                    actionLabel: 'Review KYC',
                    submittedByUserId: userId,
                    documentType: uploadDto.documentType,
                  },
                  category: 'account',
                  force: true,
                }),
              ),
            );
          }
        } catch (notifyError) {
          this.logger.warn(
            {
              userId,
              documentType: uploadDto.documentType,
              error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
            },
            'Failed to dispatch admin KYC submission notification',
          );
        }
      }

      return {
        success: true,
        message: 'Document uploaded successfully',
        document: {
          id: document.id,
          documentType: document.documentType,
          documentSide: document.documentSide,
          documentUrl: document.documentUrl,
          verificationStatus: document.verificationStatus,
          uploadedAt: document.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(
        { userId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to upload KYC document',
      );
      throw error;
    }
  }

  /**
   * Get all KYC documents for user
   */
  async getUserDocuments(userId: string): Promise<any> {
    this.logger.info({ userId }, '[KYC] Fetching user documents');

    const documents = await this.kycDocumentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    this.logger.info(
      { userId, documentsCount: documents.length },
      '[KYC] User documents retrieved'
    );

    return {
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        documentType: doc.documentType,
        documentSide: doc.documentSide,
        documentUrl: doc.documentUrl,
        documentNumber: doc.documentNumber,
        verificationStatus: doc.verificationStatus,
        rejectionReason: doc.rejectionReason,
        uploadedAt: doc.createdAt,
        verifiedAt: doc.verifiedAt,
      })),
    };
  }

  /**
   * Get KYC verification status summary
   */
  async getVerificationStatus(userId: string, userRole: UserRole = UserRole.CONTRACTOR): Promise<any> {
    this.logger.info(
      { userId },
      '[KYC] Fetching verification status summary'
    );

    const documents = await this.kycDocumentRepository.find({
      where: { userId },
    });

    const totalDocuments = documents.length;
    const verifiedDocuments = documents.filter(
      doc => doc.verificationStatus === VerificationStatus.VERIFIED,
    ).length;
    const pendingDocuments = documents.filter(
      doc => doc.verificationStatus === VerificationStatus.PENDING ||
             doc.verificationStatus === VerificationStatus.UNDER_REVIEW,
    ).length;
    const rejectedDocuments = documents.filter(
      doc => doc.verificationStatus === VerificationStatus.REJECTED,
    ).length;

    const hasIdentityDoc = documents.some(
      doc =>
        this.identityDocumentTypes.includes(doc.documentType) &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    const hasAddressDoc = documents.some(
      doc =>
        this.addressDocumentTypes.includes(doc.documentType) &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    const hasBusinessDoc = documents.some(
      doc =>
        this.businessDocumentTypes.includes(doc.documentType) &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    const requiredCategories =
      userRole === UserRole.SUPPLIER
        ? (['identity', 'address', 'business'] as const)
        : (['identity', 'address'] as const);

    const completedCategories = [
      hasIdentityDoc,
      hasAddressDoc,
      ...(userRole === UserRole.SUPPLIER ? [hasBusinessDoc] : []),
    ].filter(Boolean).length;

    const requiredCategoriesCount = requiredCategories.length;
    const completionPercentage = Math.round((completedCategories / requiredCategoriesCount) * 100);

    const isFullyVerified = completedCategories === requiredCategoriesCount;
    const isPartiallyVerified = completedCategories > 0 && !isFullyVerified;

    let overallStatus: string;
    if (isFullyVerified) {
      overallStatus = 'verified';
    } else if (isPartiallyVerified) {
      overallStatus = 'partially_verified';
    } else if (pendingDocuments > 0) {
      overallStatus = 'pending';
    } else if (totalDocuments === 0) {
      overallStatus = 'not_started';
    } else {
      overallStatus = 'rejected';
    }

    this.logger.info(
      {
        userId,
        overallStatus,
        totalDocuments,
        verifiedDocuments,
        pendingDocuments,
        rejectedDocuments,
      },
      '[KYC] Verification status retrieved'
    );

    return {
      success: true,
      verificationStatus: {
        overallStatus,
        isFullyVerified,
        isPartiallyVerified,
        completionPercentage,
        requiredCategoriesCount,
        completedCategories,
        totalDocuments,
        verifiedDocuments,
        pendingDocuments,
        rejectedDocuments,
        hasIdentityDocument: hasIdentityDoc,
        hasAddressDocument: hasAddressDoc,
        hasBusinessDocument: hasBusinessDoc,
        // Backward-compatible alias for older frontend consumers.
        hasCACDocument: hasBusinessDoc,
        isIdentityVerified: hasIdentityDoc,
        isBusinessVerified: hasBusinessDoc,
        documents: documents.map(doc => ({
          documentType: doc.documentType,
          status: doc.verificationStatus,
          rejectionReason: doc.rejectionReason,
        })),
      },
    };
  }

  /**
   * Contractor KYC is complete when at least one identity and one address
   * document have been verified.
   */
  async isContractorKycComplete(userId: string): Promise<{
    isComplete: boolean;
    hasIdentityDocument: boolean;
    hasAddressDocument: boolean;
  }> {
    const documents = await this.kycDocumentRepository.find({
      where: { userId },
      select: ['documentType', 'verificationStatus'],
    });

    const hasIdentityDocument = documents.some(
      doc =>
        this.identityDocumentTypes.includes(doc.documentType) &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    const hasAddressDocument = documents.some(
      doc =>
        this.addressDocumentTypes.includes(doc.documentType) &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    return {
      isComplete: hasIdentityDocument && hasAddressDocument,
      hasIdentityDocument,
      hasAddressDocument,
    };
  }

  /**
   * Delete document (only if not verified)
   */
  async deleteDocument(userId: string, documentId: string): Promise<any> {
    const document = await this.kycDocumentRepository.findOne({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.verificationStatus === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Cannot delete verified documents');
    }

    await this.kycDocumentRepository.remove(document);

    this.logger.info(
      { userId, documentId, documentType: document.documentType },
      'KYC document deleted',
    );

    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  /**
   * Admin: Verify or reject document
   */
  async verifyDocument(
    documentId: string,
    verifyDto: VerifyDocumentDto,
    adminUserId: string,
  ): Promise<any> {
    const document = await this.kycDocumentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (verifyDto.status === 'rejected' && !verifyDto.reason) {
      throw new BadRequestException('Rejection reason is required when rejecting a document');
    }

    document.verificationStatus =
      verifyDto.status === 'verified'
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED;
    document.verifiedBy = adminUserId;
    document.verifiedAt = new Date();
    document.rejectionReason = verifyDto.reason || null;

    await this.kycDocumentRepository.save(document);

    try {
      const readableType = document.documentType.replace(/_/g, ' ');
      const sideLabel = document.documentSide ? ` (${document.documentSide})` : '';

      if (verifyDto.status === 'verified') {
        await this.notificationsService.createNotification({
          userId: document.userId,
          type: NotificationType.ACCOUNT_WELCOME,
          title: 'KYC document approved',
          message: `Your ${readableType}${sideLabel} has been approved.`,
          metadata: {
            actionUrl: '/dashboard/kyc/status',
            actionLabel: 'View KYC status',
            documentId: document.id,
            documentType: document.documentType,
            status: 'verified',
          },
          category: 'account',
          force: true,
        });
      } else {
        const rejectionMessage = verifyDto.reason
          ? `Your ${readableType}${sideLabel} was rejected. Reason: ${verifyDto.reason}`
          : `Your ${readableType}${sideLabel} was rejected. Please re-upload a clearer document.`;

        await this.notificationsService.createNotification({
          userId: document.userId,
          type: NotificationType.ACCOUNT_WELCOME,
          title: 'KYC document rejected',
          message: rejectionMessage,
          metadata: {
            actionUrl: '/dashboard/kyc/submission',
            actionLabel: 'Re-upload document',
            documentId: document.id,
            documentType: document.documentType,
            status: 'rejected',
            reason: verifyDto.reason || null,
          },
          category: 'account',
          force: true,
        });
      }
    } catch (notificationError) {
      this.logger.warn(
        {
          documentId,
          userId: document.userId,
          status: verifyDto.status,
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        },
        'KYC document reviewed but notification dispatch failed',
      );
    }

    this.logger.info(
      {
        documentId,
        userId: document.userId,
        status: verifyDto.status,
        verifiedBy: adminUserId,
      },
      'KYC document verification updated',
    );

    return {
      success: true,
      message: `Document ${verifyDto.status} successfully`,
      document: {
        id: document.id,
        documentType: document.documentType,
        verificationStatus: document.verificationStatus,
        verifiedAt: document.verifiedAt,
      },
    };
  }

  /**
   * Admin: Get all pending documents
   */
  async getPendingDocuments(): Promise<any> {
    this.logger.info({}, '[KYC] Fetching all pending documents');

    const documents = await this.kycDocumentRepository.find({
      where: [
        { verificationStatus: VerificationStatus.PENDING },
        { verificationStatus: VerificationStatus.UNDER_REVIEW },
      ],
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    this.logger.info(
      { pendingCount: documents.length },
      '[KYC] Pending documents retrieved'
    );

    return {
      success: true,
      count: documents.length,
      documents: documents.map(doc => ({
        id: doc.id,
        userId: doc.userId,
        userName: doc.user?.fullName,
        userPhone: doc.user?.phoneNumber,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        documentNumber: doc.documentNumber,
        verificationStatus: doc.verificationStatus,
        uploadedAt: doc.createdAt,
      })),
    };
  }

  /**
   * Get required documents for user based on type and tier
   */
  getRequiredDocumentsByTier(userType: string, tier: string): DocumentType[] {
    if (userType === 'individual') {
      // Individual KYC Tiers
      switch (tier) {
        case 'tier_1':
          return [DocumentType.NIN_SLIP]; // At least one ID
        case 'tier_2':
          return [DocumentType.NIN_SLIP, DocumentType.DRIVERS_LICENSE]; // Multiple IDs
        case 'tier_3':
          return [DocumentType.NIN_SLIP, DocumentType.DRIVERS_LICENSE]; // + extra docs
        default:
          return [];
      }
    } else if (userType === 'business') {
      // Business KYC Tiers
      switch (tier) {
        case 'tier_1':
          return [DocumentType.CAC_CERTIFICATE];
        case 'tier_2':
          return [DocumentType.CAC_CERTIFICATE, DocumentType.TIN_CERTIFICATE];
        case 'tier_3':
          return [DocumentType.CAC_CERTIFICATE, DocumentType.TIN_CERTIFICATE];
        default:
          return [];
      }
    }
    return [];
  }

  /**
   * Get KYC completion status and requirements
   */
  async getKycCompletionStatus(userId: string, userType: string): Promise<any> {
    const documents = await this.kycDocumentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Determine current tier
    let currentTier = 'tier_1';
    const verifiedDocs = documents.filter(d => d.verificationStatus === VerificationStatus.VERIFIED);

    if (userType === 'individual') {
      if (verifiedDocs.some(d => [DocumentType.NIN_SLIP, DocumentType.DRIVERS_LICENSE, DocumentType.VOTERS_CARD].includes(d.documentType as any))) {
        currentTier = 'tier_1';
      }
      if (verifiedDocs.length >= 2) {
        currentTier = 'tier_2';
      }
    } else if (userType === 'business') {
      if (verifiedDocs.some(d => d.documentType === DocumentType.CAC_CERTIFICATE)) {
        currentTier = 'tier_1';
      }
      if (verifiedDocs.some(d => d.documentType === DocumentType.TIN_CERTIFICATE) && verifiedDocs.some(d => d.documentType === DocumentType.CAC_CERTIFICATE)) {
        currentTier = 'tier_2';
      }
    }

    const requiredDocs = this.getRequiredDocumentsByTier(userType, currentTier);
    const uniqueVerifiedTypes = new Set(verifiedDocs.map(d => d.documentType));
    const completionPercentage = uniqueVerifiedTypes.size > 0
      ? Math.min(100, Math.round((uniqueVerifiedTypes.size / requiredDocs.length) * 100))
      : 0;

    let overallStatus = 'not_started';
    if (documents.length === 0) {
      overallStatus = 'not_started';
    } else if (documents.some(d => d.verificationStatus === VerificationStatus.PENDING || d.verificationStatus === VerificationStatus.UNDER_REVIEW)) {
      overallStatus = 'in_progress';
    } else if (uniqueVerifiedTypes.size > 0 && uniqueVerifiedTypes.size < requiredDocs.length) {
      overallStatus = 'partially_verified';
    } else if (uniqueVerifiedTypes.size >= requiredDocs.length) {
      overallStatus = 'verified';
    } else if (documents.some(d => d.verificationStatus === VerificationStatus.REJECTED)) {
      overallStatus = 'rejected';
    }

    this.logger.info(
      { userId, currentTier, overallStatus, completionPercentage },
      '[KYC] Completion status calculated'
    );

    return {
      success: true,
      kycStatus: {
        overallStatus,
        currentTier,
        completionPercentage,
        requiredDocuments: requiredDocs,
        submittedDocuments: documents.map(d => ({
          id: d.id,
          type: d.documentType,
          side: d.documentSide,
          status: d.verificationStatus,
          uploadedAt: d.createdAt,
          verifiedAt: d.verifiedAt,
          rejectionReason: d.rejectionReason,
        })),
        nextSteps: this.getNextSteps(overallStatus, requiredDocs, verifiedDocs),
      },
    };
  }

  /**
   * Get suggested next steps based on KYC status
   */
  private getNextSteps(status: string, required: DocumentType[], verified: any[]): string[] {
    const steps: string[] = [];

    if (status === 'not_started') {
      steps.push('Upload government-issued ID (NIN, Driver\'s License, or Voter\'s Card)');
    } else if (status === 'in_progress') {
      steps.push('Waiting for document review. Check back in 24-48 hours.');
    } else if (status === 'partially_verified') {
      const missingDocs = required.filter(r => !verified.some(v => v.documentType === r));
      steps.push(`Upload missing document(s): ${missingDocs.join(', ')}`);
    } else if (status === 'verified') {
      steps.push('KYC verification complete. You can now access all platform features.');
    } else if (status === 'rejected') {
      steps.push('Document was rejected. Please resubmit with a clearer photo.');
    }

    return steps;
  }

  /**
   * Update user's KYC tier after verification
   */
  async updateUserKycTier(userId: string, userType: string): Promise<any> {
    const documents = await this.kycDocumentRepository.find({
      where: { userId },
    });

    const verifiedDocs = documents.filter(d => d.verificationStatus === VerificationStatus.VERIFIED);

    // Determine tier based on verified documents
    let newTier = 'not_started';

    if (userType === 'individual') {
      if (verifiedDocs.some(d => [DocumentType.NIN_SLIP, DocumentType.DRIVERS_LICENSE, DocumentType.VOTERS_CARD].includes(d.documentType as any))) {
        newTier = 'tier_1';
      }
      if (verifiedDocs.length >= 2) {
        newTier = 'tier_2';
      }
    } else if (userType === 'business') {
      if (verifiedDocs.some(d => d.documentType === DocumentType.CAC_CERTIFICATE)) {
        newTier = 'tier_1';
      }
      if (verifiedDocs.some(d => d.documentType === DocumentType.TIN_CERTIFICATE) && verifiedDocs.some(d => d.documentType === DocumentType.CAC_CERTIFICATE)) {
        newTier = 'tier_2';
      }
    }

    this.logger.info(
      { userId, userType, newTier },
      '[KYC] User tier determined'
    );

    return {
      success: true,
      tier: newTier,
      verifiedDocuments: verifiedDocs.length,
    };
  }

  /**
   * Get required documents based on user role
   * - Contractors: 2 proof of address documents + any 1 of 3 ID documents
   * - Suppliers: CAC certificate (required) + 1 proof of address + owner ID (1 of 3)
   */
  getRequiredDocuments(userRole: UserRole): {
    documents: DocumentType[];
    category: { [key: string]: DocumentType[] };
    description: string;
  } {
    if (userRole === UserRole.SUPPLIER) {
      return {
        documents: [
          DocumentType.CAC_CERTIFICATE,
          DocumentType.TIN_CERTIFICATE,
          DocumentType.UTILITY_BILL,
          DocumentType.BANK_STATEMENT,
          DocumentType.NIN_SLIP,
          DocumentType.DRIVERS_LICENSE,
          DocumentType.VOTERS_CARD,
        ],
        category: {
          business: [DocumentType.CAC_CERTIFICATE, DocumentType.TIN_CERTIFICATE],
          address: [DocumentType.UTILITY_BILL, DocumentType.BANK_STATEMENT],
          identity: [
            DocumentType.NIN_SLIP,
            DocumentType.DRIVERS_LICENSE,
            DocumentType.VOTERS_CARD,
          ],
        },
        description: 'Suppliers must provide one Business document (CAC/TIN), one Address document (Utility Bill/Bank Statement), and one Identity document (NIN/Driver\'s License/Voter\'s Card)',
      };
    }

    // Default for contractors
    return {
      documents: [
        DocumentType.UTILITY_BILL,
        DocumentType.BANK_STATEMENT,
        DocumentType.NIN_SLIP,
        DocumentType.DRIVERS_LICENSE,
        DocumentType.VOTERS_CARD,
      ],
      category: {
        address: [DocumentType.UTILITY_BILL, DocumentType.BANK_STATEMENT],
        identity: [
          DocumentType.NIN_SLIP,
          DocumentType.DRIVERS_LICENSE,
          DocumentType.VOTERS_CARD,
        ],
      },
      description: 'Contractors must provide: 1 proof of address document and 1 identity document',
    };
  }
}
