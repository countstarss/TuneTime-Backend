import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthCodeChannel,
  AuthCodePurpose,
  PlatformRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsGateway } from './sms-gateway.interface';
import { IdentityLinkingService } from './identity-linking.service';
import { ProfileBootstrapService } from './profile-bootstrap.service';
import {
  assertPublicRequestedRole,
  generateVerificationCode,
  getAuthCodeMaxAttempts,
  getAuthCodeResendCooldownSeconds,
  getAuthCodeTtlSeconds,
  hashVerificationCode,
  normalizePhone,
  sanitizeDisplayName,
  verifyVerificationCodeHash,
} from './auth.utils';

type AuthTarget = {
  userId: string;
  activeRole: PlatformRole | null;
};

@Injectable()
export class SmsAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsGateway: SmsGateway,
    private readonly identityLinkingService: IdentityLinkingService,
    private readonly profileBootstrapService: ProfileBootstrapService,
  ) {}

  async requestLoginCode(phone: string) {
    const normalizedPhone = normalizePhone(phone);
    return this.requestCode({
      phone: normalizedPhone,
      purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
    });
  }

  async requestPhoneBindCode(userId: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    return this.requestCode({
      userId,
      phone: normalizedPhone,
      purpose: AuthCodePurpose.PHONE_BIND,
    });
  }

  async requestPasswordResetCode(userId: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    return this.requestCode({
      userId,
      phone: normalizedPhone,
      purpose: AuthCodePurpose.PASSWORD_RESET,
    });
  }

  async verifyLoginCode(input: {
    phone: string;
    code: string;
    requestedRole?: PlatformRole;
    name?: string;
  }): Promise<AuthTarget> {
    const phone = normalizePhone(input.phone);
    await this.consumeCode({
      phone,
      code: input.code,
      purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
    });

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        status: true,
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { role: true },
        },
        name: true,
      },
    });

    let userId = existingUser?.id;
    if (!userId) {
      if (!input.requestedRole) {
        throw new BadRequestException(
          'requestedRole is required for first-time SMS login',
        );
      }

      const createdUser = await this.identityLinkingService.createUser({
        name: sanitizeDisplayName(input.name),
        phone,
        phoneVerifiedAt: new Date(),
      });
      userId = createdUser.id;
    } else if (existingUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phoneVerifiedAt: new Date(),
          deletedAt: null,
          status: UserStatus.ACTIVE,
          ...(input.name && !existingUser.name
            ? { name: sanitizeDisplayName(input.name) }
            : {}),
        },
      });
    }

    let activeRole = existingUser?.roles[0]?.role ?? null;
    if (input.requestedRole) {
      const requestedRole = assertPublicRequestedRole(input.requestedRole);
      await this.profileBootstrapService.ensureRoleForUser(
        userId,
        requestedRole,
        {
          displayName: input.name,
          phone,
        },
      );
      await this.profileBootstrapService.setPrimaryRole(userId, requestedRole);
      activeRole = requestedRole;
    } else if (!activeRole) {
      throw new BadRequestException(
        'requestedRole is required for users without roles',
      );
    }

    return {
      userId,
      activeRole,
    };
  }

  async confirmPhoneBind(input: {
    userId: string;
    phone: string;
    code: string;
  }) {
    const phone = normalizePhone(input.phone);
    await this.consumeCode({
      userId: input.userId,
      phone,
      code: input.code,
      purpose: AuthCodePurpose.PHONE_BIND,
    });

    return this.identityLinkingService.bindPhoneToUser(
      input.userId,
      phone,
      new Date(),
    );
  }

  async confirmPasswordResetCode(input: {
    userId: string;
    phone: string;
    code: string;
  }) {
    const phone = normalizePhone(input.phone);
    await this.consumeCode({
      userId: input.userId,
      phone,
      code: input.code,
      purpose: AuthCodePurpose.PASSWORD_RESET,
    });
  }

  private async requestCode(input: {
    userId?: string;
    phone: string;
    purpose: AuthCodePurpose;
  }) {
    const cooldownSeconds = getAuthCodeResendCooldownSeconds();
    const ttlSeconds = getAuthCodeTtlSeconds();
    const cooldownCutoff = new Date(Date.now() - cooldownSeconds * 1000);

    const latestCode = await this.prisma.authVerificationCode.findFirst({
      where: {
        channel: AuthCodeChannel.SMS,
        purpose: input.purpose,
        target: input.phone,
        sentAt: {
          gte: cooldownCutoff,
        },
      },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
      },
    });

    if (latestCode) {
      throw new HttpException(
        `Please wait ${cooldownSeconds} seconds before requesting another code`,
        429,
      );
    }

    const code = generateVerificationCode();
    await this.prisma.authVerificationCode.updateMany({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        channel: AuthCodeChannel.SMS,
        purpose: input.purpose,
        target: input.phone,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await this.prisma.authVerificationCode.create({
      data: {
        userId: input.userId,
        channel: AuthCodeChannel.SMS,
        purpose: input.purpose,
        target: input.phone,
        codeHash: hashVerificationCode({
          channel: AuthCodeChannel.SMS,
          purpose: input.purpose,
          target: input.phone,
          code,
        }),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    await this.smsGateway.sendVerificationCode({
      phone: input.phone,
      code,
      purpose: input.purpose,
      ttlSeconds,
    });

    return {
      success: true,
      expiresInSeconds: ttlSeconds,
      cooldownSeconds,
    };
  }

  private async consumeCode(input: {
    userId?: string;
    phone: string;
    code: string;
    purpose: AuthCodePurpose;
  }) {
    const record = await this.prisma.authVerificationCode.findFirst({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        channel: AuthCodeChannel.SMS,
        purpose: input.purpose,
        target: input.phone,
        consumedAt: null,
      },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        userId: true,
        codeHash: true,
        expiresAt: true,
        consumedAt: true,
        attemptCount: true,
      },
    });

    if (!record || record.consumedAt) {
      throw new UnauthorizedException(
        'Verification code is invalid or already used',
      );
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.prisma.authVerificationCode.update({
        where: { id: record.id },
        data: {
          consumedAt: new Date(),
        },
      });
      throw new UnauthorizedException('Verification code has expired');
    }

    const valid = verifyVerificationCodeHash(
      {
        channel: AuthCodeChannel.SMS,
        purpose: input.purpose,
        target: input.phone,
        code: input.code,
      },
      record.codeHash,
    );

    if (!valid) {
      const nextAttempts = record.attemptCount + 1;
      const maxAttempts = getAuthCodeMaxAttempts();
      await this.prisma.authVerificationCode.update({
        where: { id: record.id },
        data: {
          attemptCount: nextAttempts,
          ...(nextAttempts >= maxAttempts ? { consumedAt: new Date() } : {}),
        },
      });
      throw new UnauthorizedException('Verification code is invalid');
    }

    await this.prisma.authVerificationCode.update({
      where: { id: record.id },
      data: {
        consumedAt: new Date(),
      },
    });

    return record;
  }
}
