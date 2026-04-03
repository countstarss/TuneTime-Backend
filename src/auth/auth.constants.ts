import { PlatformRole } from '@prisma/client';

export const PUBLIC_AUTH_ROLES = [
  PlatformRole.TEACHER,
  PlatformRole.GUARDIAN,
  PlatformRole.STUDENT,
] as const;

export const ADMIN_AUTH_ROLES = [
  PlatformRole.ADMIN,
  PlatformRole.SUPER_ADMIN,
] as const;

export const WECHAT_APP_PROVIDER = 'WECHAT_APP';
export const WECHAT_MINIAPP_PROVIDER = 'WECHAT_MINIAPP';

export const AUTH_CODE_LENGTH = 6;
export const DEFAULT_AUTH_CODE_TTL_SECONDS = 600;
export const DEFAULT_AUTH_CODE_RESEND_COOLDOWN_SECONDS = 60;
export const DEFAULT_AUTH_CODE_MAX_ATTEMPTS = 5;
