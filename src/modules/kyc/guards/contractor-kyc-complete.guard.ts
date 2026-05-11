import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../auth/entities/user.entity';
import { SKIP_KYC_CHECK_KEY } from '../../../common/decorators/skip-kyc-check.decorator';
import { KycService } from '../service/kyc.service';

@Injectable()
export class ContractorKycCompleteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly kycService: KycService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipKycCheck = this.reflector.getAllAndOverride<boolean>(SKIP_KYC_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipKycCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId?: string; userRole?: string } | undefined;

    if (!user?.userId) {
      return false;
    }

    // Apply this restriction to contractors only.
    if (user.userRole !== UserRole.CONTRACTOR) {
      return true;
    }

    const completion = await this.kycService.isContractorKycComplete(user.userId);

    if (completion.isComplete) {
      return true;
    }

    throw new ForbiddenException(
      'KYC incomplete. Verify at least one address document and one identity document to continue.',
    );
  }
}
