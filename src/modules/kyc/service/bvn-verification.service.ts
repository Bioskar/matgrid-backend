import { Injectable, BadRequestException, Inject, InternalServerErrorException } from '@nestjs/common';
import * as pino from 'pino';

export interface BvnVerificationResponse {
  success: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  gender: string;
  nin: string;
  photo: string;
  message?: string;
}

@Injectable()
export class BvnVerificationService {
  private paystackApiUrl = 'https://api.paystack.co/bank/resolve';
  private paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

  constructor(@Inject('PINO_LOGGER') private logger: pino.Logger) {
    if (!this.paystackSecretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not configured - BVN verification will be disabled');
    }
  }

  /**
   * Verify BVN number using Paystack API
   * Paystack integrates with NIBSS for BVN verification
   */
  async verifyBvn(bvnNumber: string, phoneNumber: string): Promise<BvnVerificationResponse> {
    // Validate BVN format (11 digits)
    if (!/^\d{11}$/.test(bvnNumber.trim())) {
      throw new BadRequestException('BVN must be exactly 11 digits');
    }

    if (!this.paystackSecretKey) {
      this.logger.warn({ bvnNumber }, 'BVN verification disabled - PAYSTACK_SECRET_KEY not configured');
      // Return mock response for development
      return this.getMockBvnResponse(bvnNumber);
    }

    try {
      this.logger.debug({ bvnNumber }, 'Verifying BVN with Paystack');

      // Paystack BVN verification endpoint
      const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${bvnNumber}&bank_code=999`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error(
          { bvnNumber, error, status: response.status },
          'BVN verification failed'
        );
        throw new BadRequestException('Invalid BVN or verification service unavailable');
      }

      const data = await response.json();

      if (!data.status) {
        throw new BadRequestException('BVN verification failed - Invalid BVN');
      }

      this.logger.info(
        { bvnNumber, accountName: data.data?.account_name },
        'BVN verified successfully'
      );

      return {
        success: true,
        firstName: data.data?.account_name?.split(' ')[0] || '',
        lastName: data.data?.account_name?.split(' ').slice(1).join(' ') || '',
        dateOfBirth: '', // Paystack doesn't return DOB in basic verify
        phoneNumber,
        gender: '',
        nin: '', // Paystack returns account resolution, not NIN
        photo: '',
        message: 'BVN verified successfully',
      };
    } catch (error) {
      this.logger.error(
        { bvnNumber, error: error instanceof Error ? error.message : 'Unknown error' },
        'BVN verification error'
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('BVN verification service temporarily unavailable');
    }
  }

  /**
   * Verify NIN using NIMC API (Nigerian National ID)
   * This is a placeholder - would require NIMC API integration
   */
  async verifyNin(ninNumber: string): Promise<any> {
    if (!/^\d{11}$/.test(ninNumber.trim())) {
      throw new BadRequestException('NIN must be exactly 11 digits');
    }

    // TODO: Integrate with NIMC API when available
    this.logger.info({ ninNumber }, 'NIN verification not yet implemented');

    return {
      success: false,
      message: 'NIN verification coming soon',
    };
  }

  /**
   * Verify CAC number using CAC portal/API
   * Placeholder - requires CAC integration
   */
  async verifyCac(cacNumber: string, companyName: string): Promise<any> {
    if (!cacNumber || cacNumber.length < 5) {
      throw new BadRequestException('Invalid CAC registration number');
    }

    // TODO: Integrate with CAC API when available
    this.logger.info({ cacNumber, companyName }, 'CAC verification not yet implemented');

    return {
      success: false,
      message: 'CAC verification coming soon',
    };
  }

  /**
   * Check if user has high-risk profile (for enhanced due diligence)
   */
  async checkRiskProfile(userId: string, userData: any): Promise<string> {
    // Risk assessment logic
    const riskFactors: string[] = [];

    // Check for high-risk countries
    if (userData.country && ['Iran', 'Syria', 'North Korea'].includes(userData.country)) {
      riskFactors.push('High-risk country');
    }

    // Check for PEP (Politically Exposed Person) - would integrate with external API
    // TODO: Integrate with OFAC/PEP database

    // Check transaction patterns
    if (userData.expectedMonthlyVolume && userData.expectedMonthlyVolume > 10000000) {
      riskFactors.push('High transaction volume');
    }

    this.logger.debug(
      { userId, riskFactors },
      'Risk profile assessment'
    );

    if (riskFactors.length > 0) {
      return 'high';
    }
    if (riskFactors.length > 0) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Mock BVN response for development/testing
   */
  private getMockBvnResponse(bvnNumber: string): BvnVerificationResponse {
    return {
      success: true,
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      phoneNumber: '08012345678',
      gender: 'M',
      nin: '12345678901',
      photo: 'https://via.placeholder.com/300x400',
      message: '[DEV MODE] Mock BVN verification - Configure PAYSTACK_SECRET_KEY for production',
    };
  }
}
