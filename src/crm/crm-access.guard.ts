import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BLOCKED_ROLES = new Set<PlatformRole>(['TEACHER', 'STUDENT']);

type RequestWithUser = {
  user?: { sub?: string };
  crmRoles?: PlatformRole[];
};

@Injectable()
export class CrmAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: true },
    });

    const roleValues = roles.map((item) => item.role);
    req.crmRoles = roleValues;

    if (!roleValues.length) {
      throw new ForbiddenException('CRM access requires a platform role');
    }

    const canAccess = roleValues.some((role) => !BLOCKED_ROLES.has(role));

    if (!canAccess) {
      throw new ForbiddenException('Current role cannot access CRM workspace');
    }

    return true;
  }
}
