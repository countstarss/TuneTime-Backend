import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';

export const REQUIRE_ROLES_KEY = 'require_roles';

export const RequireRoles = (...roles: PlatformRole[]) =>
  SetMetadata(REQUIRE_ROLES_KEY, roles);
