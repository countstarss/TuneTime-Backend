import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { REQUIRE_ROLES_KEY } from './require-roles.decorator';

type RequestWithAuth = {
  auth?: {
    activeRole: PlatformRole | null;
    roles: PlatformRole[];
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<PlatformRole[]>(REQUIRE_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (!requiredRoles.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = req.auth;

    if (!auth) {
      throw new UnauthorizedException('Missing authenticated user context');
    }

    if (!auth.activeRole || !auth.roles.includes(auth.activeRole)) {
      throw new ForbiddenException(
        'Current token does not have an active role',
      );
    }

    if (!requiredRoles.includes(auth.activeRole)) {
      throw new ForbiddenException(
        'Current active role cannot access this resource',
      );
    }

    return true;
  }
}
