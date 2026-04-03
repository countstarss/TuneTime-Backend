import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthCodeChannel, AuthCodePurpose, PlatformRole } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  AUTH_CODE_LENGTH,
  DEFAULT_AUTH_CODE_MAX_ATTEMPTS,
  DEFAULT_AUTH_CODE_RESEND_COOLDOWN_SECONDS,
  DEFAULT_AUTH_CODE_TTL_SECONDS,
} from './auth.constants';

function getAuthCodeSecret() {
  const secret = process.env.AUTH_CODE_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing AUTH_CODE_SECRET or AUTH_JWT_SECRET');
  }

  return secret;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BadRequestException('Please provide a valid email');
  }

  return normalized;
}

export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');

  if (normalized.startsWith('0086')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('86') && normalized.length > 11) {
    normalized = normalized.slice(2);
  }

  if (!/^1\d{10}$/.test(normalized)) {
    throw new BadRequestException(
      'Please provide a valid mainland China phone',
    );
  }

  return normalized;
}

export function sanitizeDisplayName(
  value: string | null | undefined,
  fallback = 'TuneTime 用户',
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 64);
}

export function assertPublicRequestedRole(
  requestedRole: PlatformRole | undefined,
): PlatformRole {
  if (
    requestedRole !== PlatformRole.TEACHER &&
    requestedRole !== PlatformRole.GUARDIAN &&
    requestedRole !== PlatformRole.STUDENT
  ) {
    throw new BadRequestException(
      'requestedRole must be one of TEACHER, GUARDIAN or STUDENT',
    );
  }

  return requestedRole;
}

export function generateVerificationCode() {
  const max = 10 ** AUTH_CODE_LENGTH;
  const code = randomInt(0, max).toString().padStart(AUTH_CODE_LENGTH, '0');
  return code;
}

export function hashVerificationCode(input: {
  channel: AuthCodeChannel;
  purpose: AuthCodePurpose;
  target: string;
  code: string;
}): string {
  return createHmac('sha256', getAuthCodeSecret())
    .update(
      [input.channel, input.purpose, input.target, input.code].join('|'),
      'utf8',
    )
    .digest('hex');
}

export function verifyVerificationCodeHash(
  input: Parameters<typeof hashVerificationCode>[0],
  expectedHash: string,
) {
  const actual = Buffer.from(hashVerificationCode(input), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function getAuthCodeTtlSeconds() {
  const raw = Number(process.env.AUTH_CODE_TTL_SECONDS || '');
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AUTH_CODE_TTL_SECONDS;
}

export function getAuthCodeResendCooldownSeconds() {
  const raw = Number(process.env.AUTH_CODE_RESEND_COOLDOWN_SECONDS || '');
  return Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_AUTH_CODE_RESEND_COOLDOWN_SECONDS;
}

export function getAuthCodeMaxAttempts() {
  const raw = Number(process.env.AUTH_CODE_MAX_ATTEMPTS || '');
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AUTH_CODE_MAX_ATTEMPTS;
}

export function assertPasswordStrength(password: string) {
  if (password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
}

export function resolvePreferredRole(
  roles: PlatformRole[],
  requestedRole?: PlatformRole | null,
): PlatformRole | null {
  if (requestedRole && roles.includes(requestedRole)) {
    return requestedRole;
  }

  return roles[0] ?? null;
}

export function assertWechatAppConfigured() {
  if (!process.env.WECHAT_APP_APP_ID || !process.env.WECHAT_APP_SECRET) {
    throw new UnauthorizedException('WeChat App login is not configured');
  }
}

export function assertWechatMiniappConfigured() {
  if (!process.env.WECHAT_MINIAPP_APP_ID || !process.env.WECHAT_MINIAPP_SECRET) {
    throw new UnauthorizedException('WeChat Mini Program login is not configured');
  }
}
