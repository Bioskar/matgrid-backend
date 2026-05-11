import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserPayload } from '../../../common/interfaces/user-payload.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { KycService } from '../service/kyc.service';
import { BvnVerificationService } from '../service/bvn-verification.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { UploadDocumentDto, VerifyDocumentDto, VerifyBvnDto } from '../dto/upload-document.dto';

@ApiTags('KYC Verification')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(
    private kycService: KycService,
    private bvnService: BvnVerificationService,
  ) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload KYC document',
    description: `
      **Upload identity or business verification document**
      
      **Document Types:**
      - nin_slip: National Identity Number slip
      - drivers_license: Driver's License
      - voters_card: Voter's Card  
      - cac_certificate: CAC Certificate (Company Registration)
      
      **Process:**
      1. User selects document type
      2. Uploads document file (PDF, JPG, PNG)
      3. System stores document securely
      4. Document status set to "pending"
      5. Admin reviews and verifies
      
      **File requirements:**
      - Max size: 5MB
      - Formats: PDF, JPG, JPEG, PNG
      - Document must be clear and readable
      - All details must be visible
      
      **Verification levels:**
      - Identity verified: Need 1 of (NIN, Driver's License, Voter's Card)
      - Business verified: Need CAC Certificate
      - Fully verified: Identity + CAC
      
      **Request format (multipart/form-data):**
      - file: The document image/PDF
      - documentType: Type of document
      - documentNumber: Optional ID number on document
      
      **Frontend implementation:**
      \`\`\`javascript
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('documentType', 'cac_certificate');
      formData.append('documentNumber', 'RC123456');
      
      fetch('/api/v1/kyc/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        body: formData
      });
      \`\`\`
      
      **Status progression:**
      1. pending → Just uploaded, awaiting review
      2. under_review → Admin is checking document
      3. verified → Approved and verified ✓
      4. rejected → Not accepted (with reason)
      
      **Can replace document:**
      - Yes, if status is pending/rejected
      - No, if already verified
      
      **After upload:**
      - Check status via GET /kyc/status
      - View all documents via GET /kyc/documents
      - Wait for admin verification
      
      **Common errors:**
      - "File too large" → Reduce file size below 5MB
      - "Invalid format" → Use PDF, JPG, or PNG
      - "Already verified" → Cannot replace verified document
      - "Document not clear" → Upload clearer photo
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload KYC document with file',
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, JPG, PNG) - Max 5MB',
        },
        documentType: {
          type: 'string',
          enum: ['nin_slip', 'drivers_license', 'voters_card', 'cac_certificate', 'tin_certificate'],
          description: 'Type of document',
        },
        documentNumber: {
          type: 'string',
          description: 'Optional: Document number (NIN, License No, RC No)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
    schema: {
      example: {
        success: true,
        message: 'Document uploaded successfully',
        document: {
          id: '507f1f77bcf86cd799439011',
          documentType: 'cac_certificate',
          documentUrl: '/uploads/kyc/abc123.pdf',
          verificationStatus: 'pending',
          uploadedAt: '2026-01-07T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or document already verified',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = 'uploads/kyc';
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${path.extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF, JPG, and PNG files are allowed'), false);
        }
      },
    }),
  )
  async uploadDocument(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      return await this.kycService.uploadDocument(user.userId, uploadDto, file);
    } catch (error) {
      // Clean up file if upload fails
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Get('documents')
  @ApiOperation({
    summary: 'Get all user KYC documents',
    description: `
      **Retrieves all KYC documents uploaded by the user**
      
      **Returns:**
      - List of all uploaded documents
      - Document type and verification status
      - Upload and verification dates
      - Rejection reasons (if any)
      
      **Document statuses:**
      - pending: Awaiting admin review
      - under_review: Being reviewed by admin
      - verified: Approved ✓
      - rejected: Not accepted (see rejectionReason)
      
      **Use for:**
      - KYC status page
      - Document management
      - Checking verification progress
      - Viewing rejection reasons
      
      **Frontend display:**
      - Show document type with icon
      - Color code by status (green=verified, yellow=pending, red=rejected)
      - Allow re-upload if rejected
      - Show verification date
      - Display rejection reason if applicable
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User documents retrieved',
    schema: {
      example: {
        success: true,
        documents: [
          {
            id: '507f1f77bcf86cd799439011',
            documentType: 'cac_certificate',
            documentUrl: '/uploads/kyc/abc123.pdf',
            documentNumber: 'RC123456',
            verificationStatus: 'verified',
            uploadedAt: '2026-01-07T10:00:00.000Z',
            verifiedAt: '2026-01-07T12:00:00.000Z',
          },
          {
            id: '507f1f77bcf86cd799439012',
            documentType: 'nin_slip',
            documentUrl: '/uploads/kyc/def456.jpg',
            verificationStatus: 'pending',
            uploadedAt: '2026-01-07T11:00:00.000Z',
          },
        ],
      },
    },
  })
  async getUserDocuments(@CurrentUser() user: UserPayload) {
    return this.kycService.getUserDocuments(user.userId);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get KYC verification status summary',
    description: `
      **Get overall KYC verification status and progress**
      
      **Returns:**
      - Overall verification status
      - Document counts (total, verified, pending, rejected)
      - Identity verification status
      - Business verification status
      - Full verification status
      
      **Overall statuses:**
      - not_started: No documents uploaded
      - pending: Documents uploaded, awaiting verification
      - partially_verified: Some documents verified
      - verified: Fully verified (Identity + CAC)
      - rejected: All documents rejected
      
      **Verification requirements:**
      - Identity: 1 of (NIN, Driver's License, Voter's Card) verified
      - Business: CAC Certificate verified
      - Full: Identity + Business both verified
      
      **Use for:**
      - Profile page verification badge
      - Dashboard KYC status banner
      - Access control (require verification for certain features)
      - Progress indicator
      
      **Frontend implementation:**
      \`\`\`javascript
      // Show verification banner
      if (status.overallStatus === 'pending') {
        showBanner('Verification Pending', 'yellow');
      } else if (status.overallStatus === 'verified') {
        showBanner('Verified ✓', 'green');
      }
      
      // Restrict features
      if (!status.isFullyVerified) {
        disableFeature('create_order');
      }
      \`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Verification status summary',
    schema: {
      example: {
        success: true,
        verificationStatus: {
          overallStatus: 'partially_verified',
          isFullyVerified: false,
          isPartiallyVerified: true,
          totalDocuments: 2,
          verifiedDocuments: 1,
          pendingDocuments: 1,
          rejectedDocuments: 0,
          hasIdentityDocument: false,
          hasCACDocument: true,
          documents: [
            {
              documentType: 'cac_certificate',
              status: 'verified',
              rejectionReason: null,
            },
            {
              documentType: 'nin_slip',
              status: 'pending',
              rejectionReason: null,
            },
          ],
        },
      },
    },
  })
  async getVerificationStatus(@CurrentUser() user: UserPayload) {
    return this.kycService.getVerificationStatus(user.userId, user.userRole as UserRole);
  }

  @Delete('documents/:documentId')
  @ApiOperation({
    summary: 'Delete KYC document',
    description: `
      **Delete an uploaded document**
      
      **Can delete:**
      - Documents with status: pending, rejected
      
      **Cannot delete:**
      - Verified documents (permanent)
      
      **Use for:**
      - Removing incorrect uploads
      - Clearing rejected documents before re-upload
      - Canceling pending verifications
      
      **Note:** Re-upload automatically replaces document
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Document deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete verified documents',
  })
  async deleteDocument(@CurrentUser() user: UserPayload, @Param('documentId') documentId: string) {
    return this.kycService.deleteDocument(user.userId, documentId);
  }

  // Admin endpoints
  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get pending documents (Admin only)',
    description: `
      **Admin: Retrieve all documents awaiting verification**
      
      **Returns:**
      - All pending and under_review documents
      - User information
      - Document details
      - Upload timestamps
      
      **Sorted by:** Oldest first (FIFO)
      
      **Use for:**
      - Admin verification queue
      - Document review dashboard
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Pending documents retrieved',
  })
  async getPendingDocuments() {
    return this.kycService.getPendingDocuments();
  }

  @Put('admin/verify/:documentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Verify or reject document (Admin only)',
    description: `
      **Admin: Approve or reject a KYC document**
      
      **Actions:**
      - verified: Document is authentic and accepted
      - rejected: Document is invalid/unclear (must provide reason)
      
      **Rejection reasons (examples):**
      - "Document is not clear or readable"
      - "Document appears to be fake/altered"
      - "Information doesn't match profile"
      - "Document is expired"
      - "Wrong document uploaded"
      
      **After verification:**
      - User can see updated status
      - If rejected, user can re-upload
      - If verified, document is permanent
      
      **Best practices:**
      - Always provide clear rejection reason
      - Check document authenticity
      - Verify information matches user profile
    `,
  })
  @ApiBody({ type: VerifyDocumentDto })
  @ApiResponse({
    status: 200,
    description: 'Document verification updated',
  })
  async verifyDocument(
    @CurrentUser() user: UserPayload,
    @Param('documentId') documentId: string,
    @Body() verifyDto: VerifyDocumentDto,
  ) {
    return this.kycService.verifyDocument(documentId, verifyDto, user.userId);
  }

  @Post('verify-bvn')
  @ApiOperation({
    summary: 'Verify BVN (Nigerian Bank Verification Number)',
    description: `
      **Verify user identity using BVN - Nigerian Bank Verification Number**
      
      **What is BVN:**
      - 11-digit unique identifier assigned by Nigerian banks
      - Most reliable form of ID in Nigeria
      - Linked to NIN (National ID)
      - Instant verification via Paystack/NIBSS
      
      **Request:**
      - bvnNumber: 11-digit BVN (e.g., "12345678901")
      - phoneNumber: Phone number for cross-check
      
      **Response:**
      - Verified user details from bank
      - Verification status
      - First and last name
      
      **Benefits:**
      - Instant verification (no manual review needed)
      - Auto-upgrade to Tier 1 on success
      - Fraud detection
      - CBN compliant
      
      **Errors:**
      - "BVN must be exactly 11 digits" - Invalid format
      - "Invalid BVN" - Does not exist or no match
      - "Verification service unavailable" - Try again later
      
      **Frontend implementation:**
      \`\`\`javascript
      const response = await fetch('/api/v1/kyc/verify-bvn', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bvnNumber: '12345678901',
          phoneNumber: '08012345678'
        })
      });
      
      if (response.ok) {
        // Auto-mark as Tier 1 verified
        // Show success message with name from BVN
      } else {
        // Show error and prompt to upload documents instead
      }
      \`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'BVN verified successfully',
    schema: {
      example: {
        success: true,
        message: 'BVN verified successfully',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '08012345678',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid BVN or verification failed',
  })
  async verifyBvn(
    @CurrentUser() user: UserPayload,
    @Body() bvnDto: VerifyBvnDto,
  ) {
    try {
      const result = await this.bvnService.verifyBvn(bvnDto.bvnNumber, bvnDto.phoneNumber);
      
      if (result.success) {
        // TODO: Update user's KYC tier to tier_1 and set isBvnVerified = true
        return {
          success: true,
          message: 'BVN verified successfully',
          firstName: result.firstName,
          lastName: result.lastName,
          phoneNumber: result.phoneNumber,
        };
      }
      
      throw new BadRequestException('BVN verification failed');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('BVN verification service temporarily unavailable');
    }
  }

  @Get('completion-status')
  @ApiOperation({
    summary: 'Get KYC completion status and requirements',
    description: `
      **Get user's KYC progress, required documents, and next steps**
      
      **Returns:**
      - Overall KYC status (not_started, in_progress, partially_verified, verified, rejected)
      - Current tier (tier_1, tier_2, tier_3)
      - Completion percentage (0-100%)
      - Required documents for current tier
      - List of submitted documents with status
      - Suggested next steps
      
      **Tiers for Individuals:**
      - Tier 1: 1 government ID verified (NIN, Driver's License, or Voter's Card)
      - Tier 2: 2+ government IDs verified
      - Tier 3: Enhanced verification with additional documents
      
      **Tiers for Businesses:**
      - Tier 1: CAC Certificate verified
      - Tier 2: CAC + TIN verified
      - Tier 3: All documents + director verification
      
      **Use for:**
      - KYC status dashboard
      - Showing progress to user
      - Determining what docs are needed next
      - Calculating completion percentage
      - Displaying next actions
      
      **Frontend example:**
      \`\`\`javascript
      const status = await fetch('/api/v1/kyc/completion-status', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      const data = await status.json();
      
      // Show progress bar
      showProgressBar(data.kycStatus.completionPercentage);
      
      // Show required docs
      data.kycStatus.requiredDocuments.forEach(doc => {
        addDocUploadOption(doc);
      });
      
      // Show next steps
      data.kycStatus.nextSteps.forEach(step => {
        showInstruction(step);
      });
      \`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'KYC completion status retrieved',
    schema: {
      example: {
        success: true,
        kycStatus: {
          overallStatus: 'partially_verified',
          currentTier: 'tier_1',
          completionPercentage: 50,
          requiredDocuments: ['nin_slip', 'drivers_license'],
          submittedDocuments: [
            {
              id: '507f1f77bcf86cd799439011',
              type: 'nin_slip',
              status: 'verified',
              uploadedAt: '2026-01-07T10:00:00.000Z',
              verifiedAt: '2026-01-07T12:00:00.000Z',
            },
          ],
          nextSteps: [
            'Upload Driver\'s License to complete Tier 1 verification',
          ],
        },
      },
    },
  })
  async getCompletionStatus(@CurrentUser() user: UserPayload) {
    // TODO: Get user type from user payload
    const userType = 'individual'; // Placeholder
    return this.kycService.getKycCompletionStatus(user.userId, userType);
  }

  @Get('requirements')
  @ApiOperation({
    summary: 'Get KYC requirements based on user role',
    description: `
      **Get the list of required documents for KYC verification based on user role**
      
      **For Contractors:**
      - 2 proof of address documents (e.g., utility bills)
      - 1 identity document (NIN, Driver's License, or Voter's Card)
      
      **For Suppliers:**
      - CAC Certificate (required)
      - Proof of address (utility bill)
      - Owner's identity document (NIN, Driver's License, or Voter's Card)
      
      **Returns:**
      - List of required document types
      - Categorized by requirement type
      - Human-readable description
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'KYC requirements retrieved',
    schema: {
      example: {
        documents: ['utility_bill', 'drivers_license'],
        category: {
          proofOfAddress: ['utility_bill'],
          identity: ['nin_slip', 'drivers_license', 'voters_card'],
        },
        description: 'Contractors must provide: 2 proof of address documents and 1 identity document',
      },
    },
  })
  async getRequirements(@CurrentUser() user: UserPayload) {
    return this.kycService.getRequiredDocuments(user.userRole as UserRole);
  }
}
