import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
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
import * as path from 'path';
import * as fs from 'fs';
import { KycService } from '../service/kyc.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { UploadDocumentDto, VerifyDocumentDto } from '../dto/upload-document.dto';

@ApiTags('KYC Verification')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private kycService: KycService) {}

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
          enum: ['nin_slip', 'drivers_license', 'voters_card', 'cac_certificate'],
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
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      return await this.kycService.uploadDocument(req.user.userId, uploadDto, file);
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
  async getUserDocuments(@Req() req: any) {
    return this.kycService.getUserDocuments(req.user.userId);
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
  async getVerificationStatus(@Req() req: any) {
    return this.kycService.getVerificationStatus(req.user.userId);
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
  async deleteDocument(@Req() req: any, @Param('documentId') documentId: string) {
    return this.kycService.deleteDocument(req.user.userId, documentId);
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
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Body() verifyDto: VerifyDocumentDto,
  ) {
    return this.kycService.verifyDocument(documentId, verifyDto, req.user.userId);
  }
}
