import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifyJwt } from './verify-jwt';
import { AuthenticatedUserContext } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

    if (!token) {
      throw new UnauthorizedException('Authorization token not found');
    }

    const payload = await verifyJwt(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const rawPayload = payload as Record<string, unknown>;
    const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
    const requestedActiveRole =
      typeof rawPayload.activeRole === 'string'
        ? (rawPayload.activeRole as PlatformRole)
        : null;

    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { role: true },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Authenticated user not found or inactive',
      );
    }

    const roles = user.roles.map((item) => item.role);
    const activeRole =
      requestedActiveRole && roles.includes(requestedActiveRole)
        ? requestedActiveRole
        : (roles[0] ?? null);

    req.user = payload;
    req.auth = {
      userId,
      roles,
      activeRole,
      status: user.status,
      tokenPayload: payload,
    } satisfies AuthenticatedUserContext;

    return true;
  }
}
