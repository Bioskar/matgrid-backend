import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycDocument, DocumentType, VerificationStatus } from '../entities/kyc-document.entity';
import { UploadDocumentDto, VerifyDocumentDto } from '../dto/upload-document.dto';
import * as pino from 'pino';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycDocument)
    private kycDocumentRepository: Repository<KycDocument>,
    @Inject('PINO_LOGGER') private logger: pino.Logger,
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
        },
      });

      if (existingDoc && existingDoc.verificationStatus === VerificationStatus.VERIFIED) {
        throw new BadRequestException(
          `${uploadDto.documentType} is already verified. Cannot replace verified documents.`,
        );
      }

      // Create document URL (relative path)
      const documentUrl = `/uploads/kyc/${file.filename}`;

      const documentData = {
        userId,
        documentType: uploadDto.documentType,
        documentUrl,
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

      return {
        success: true,
        message: 'Document uploaded successfully',
        document: {
          id: document.id,
          documentType: document.documentType,
          documentUrl: document.documentUrl,
          verificationStatus: document.verificationStatus,
          uploadedAt: document.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(
        { userId, error: error.message },
        'Failed to upload KYC document',
      );
      throw error;
    }
  }

  /**
   * Get all KYC documents for user
   */
  async getUserDocuments(userId: string): Promise<any> {
    const documents = await this.kycDocumentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        documentType: doc.documentType,
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
  async getVerificationStatus(userId: string): Promise<any> {
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

    // Check if user has at least one identity document (NIN, Driver's License, or Voter's Card)
    const hasIdentityDoc = documents.some(
      doc =>
        (doc.documentType === DocumentType.NIN_SLIP ||
         doc.documentType === DocumentType.DRIVERS_LICENSE ||
         doc.documentType === DocumentType.VOTERS_CARD) &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    // Check if user has CAC certificate (for companies)
    const hasCACDoc = documents.some(
      doc =>
        doc.documentType === DocumentType.CAC_CERTIFICATE &&
        doc.verificationStatus === VerificationStatus.VERIFIED,
    );

    const isFullyVerified = hasIdentityDoc && hasCACDoc;
    const isPartiallyVerified = hasIdentityDoc || hasCACDoc;

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

    return {
      success: true,
      verificationStatus: {
        overallStatus,
        isFullyVerified,
        isPartiallyVerified,
        totalDocuments,
        verifiedDocuments,
        pendingDocuments,
        rejectedDocuments,
        hasIdentityDocument: hasIdentityDoc,
        hasCACDocument: hasCACDoc,
        documents: documents.map(doc => ({
          documentType: doc.documentType,
          status: doc.verificationStatus,
          rejectionReason: doc.rejectionReason,
        })),
      },
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

    if (verifyDto.status === 'rejected' && !verifyDto.rejectionReason) {
      throw new BadRequestException('Rejection reason is required when rejecting a document');
    }

    document.verificationStatus =
      verifyDto.status === 'verified'
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED;
    document.verifiedBy = adminUserId;
    document.verifiedAt = new Date();
    document.rejectionReason = verifyDto.rejectionReason || null;

    await this.kycDocumentRepository.save(document);

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
    const documents = await this.kycDocumentRepository.find({
      where: [
        { verificationStatus: VerificationStatus.PENDING },
        { verificationStatus: VerificationStatus.UNDER_REVIEW },
      ],
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

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
}
