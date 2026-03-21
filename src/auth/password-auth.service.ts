import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.util';
import { ProfileBootstrapService } from './profile-bootstrap.service';
import {
  assertPasswordStrength,
  assertPublicRequestedRole,
  normalizeEmail,
  normalizePhone,
} from './auth.utils';
import { IdentityLinkingService } from './identity-linking.service';

type AuthTarget = {
  userId: string;
  activeRole: PlatformRole | null;
};

@Injectable()
export class PasswordAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityLinkingService: IdentityLinkingService,
    private readonly profileBootstrapService: ProfileBootstrapService,
  ) {}

  async registerWithEmail(input: {
    name?: string;
    email: string;
    password: string;
    requestedRole: PlatformRole;
  }): Promise<AuthTarget> {
    const requestedRole = assertPublicRequestedRole(input.requestedRole);
    const email = normalizeEmail(input.email);
    assertPasswordStrength(input.password);
    const passwordHash = await hashPassword(input.password);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        roles: {
          select: { role: true },
        },
        passwordCredential: {
          select: { id: true },
        },
      },
    });

    if (existingUser?.passwordCredential) {
      throw new ConflictException('This email is already registered');
    }

    if (
      existingUser?.roles.some(
        (item) =>
          item.role === PlatformRole.ADMIN ||
          item.role === PlatformRole.SUPER_ADMIN,
      )
    ) {
      throw new ConflictException(
        'Admin accounts cannot use public registration',
      );
    }

    const userId = await this.prisma.$transaction(async (tx) => {
      let resolvedUserId = existingUser?.id;

      if (!resolvedUserId) {
        const createdUser = await tx.user.create({
          data: {
            name: input.name?.trim() || null,
            email,
            status: UserStatus.ACTIVE,
          },
          select: { id: true },
        });
        resolvedUserId = createdUser.id;
      } else {
        if (existingUser.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException('User is not active');
        }

        await tx.user.update({
          where: { id: resolvedUserId },
          data: {
            name: input.name?.trim() || undefined,
            deletedAt: null,
            status: UserStatus.ACTIVE,
          },
        });
      }

      await tx.passwordCredential.create({
        data: {
          userId: resolvedUserId,
          passwordHash,
        },
      });

      await this.profileBootstrapService.ensureRoleForUserTx(
        tx,
        resolvedUserId,
        requestedRole,
        {
          displayName: input.name,
        },
      );
      await this.profileBootstrapService.setPrimaryRole(
        resolvedUserId,
        requestedRole,
        tx,
      );

      return resolvedUserId;
    });

    return {
      userId,
      activeRole: requestedRole,
    };
  }

  async loginWithEmail(input: {
    email: string;
    password: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthTarget> {
    const email = normalizeEmail(input.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            role: true,
          },
        },
        passwordCredential: {
          select: {
            passwordHash: true,
          },
        },
      },
    });

    if (!user?.passwordCredential) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await verifyPassword(
      input.password,
      user.passwordCredential.passwordHash,
    );

    if (!isValid || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    let activeRole =
      input.requestedRole &&
      user.roles.some((item) => item.role === input.requestedRole)
        ? input.requestedRole
        : (user.roles[0]?.role ?? null);

    if (
      input.requestedRole &&
      !user.roles.some((item) => item.role === input.requestedRole)
    ) {
      if (
        input.requestedRole === PlatformRole.ADMIN ||
        input.requestedRole === PlatformRole.SUPER_ADMIN
      ) {
        throw new BadRequestException(
          'Requested role is not assigned to this user',
        );
      }

      const requestedRole = assertPublicRequestedRole(input.requestedRole);
      await this.profileBootstrapService.ensureRoleForUser(
        user.id,
        requestedRole,
      );
      await this.profileBootstrapService.setPrimaryRole(user.id, requestedRole);
      activeRole = requestedRole;
    }

    return {
      userId: user.id,
      activeRole,
    };
  }

  async loginWithPhone(input: {
    phone: string;
    password: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthTarget> {
    const phone = normalizePhone(input.phone);

    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        status: true,
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            role: true,
          },
        },
        passwordCredential: {
          select: {
            passwordHash: true,
          },
        },
      },
    });

    if (!user?.passwordCredential) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const isValid = await verifyPassword(
      input.password,
      user.passwordCredential.passwordHash,
    );

    if (!isValid || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    let activeRole =
      input.requestedRole &&
      user.roles.some((item) => item.role === input.requestedRole)
        ? input.requestedRole
        : (user.roles[0]?.role ?? null);

    if (
      input.requestedRole &&
      !user.roles.some((item) => item.role === input.requestedRole)
    ) {
      if (
        input.requestedRole === PlatformRole.ADMIN ||
        input.requestedRole === PlatformRole.SUPER_ADMIN
      ) {
        throw new BadRequestException(
          'Requested role is not assigned to this user',
        );
      }

      const requestedRole = assertPublicRequestedRole(input.requestedRole);
      await this.profileBootstrapService.ensureRoleForUser(
        user.id,
        requestedRole,
        { phone },
      );
      await this.profileBootstrapService.setPrimaryRole(user.id, requestedRole);
      activeRole = requestedRole;
    }

    return {
      userId: user.id,
      activeRole,
    };
  }

  async bindEmailPassword(input: {
    userId: string;
    email: string;
    password: string;
  }): Promise<string> {
    const email = normalizeEmail(input.email);
    assertPasswordStrength(input.password);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordCredential: {
          select: { passwordHash: true },
        },
      },
    });

    if (!existing) {
      const passwordHash = await hashPassword(input.password);
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            email,
            deletedAt: null,
            status: UserStatus.ACTIVE,
          },
        });

        const credential = await tx.passwordCredential.findUnique({
          where: { userId: input.userId },
          select: { id: true },
        });

        if (credential) {
          throw new ConflictException(
            'Password is already configured for this user',
          );
        }

        await tx.passwordCredential.create({
          data: {
            userId: input.userId,
            passwordHash,
          },
        });
      });

      return input.userId;
    }

    if (existing.id === input.userId) {
      if (existing.passwordCredential) {
        throw new ConflictException('Email and password are already bound');
      }

      await this.prisma.passwordCredential.create({
        data: {
          userId: input.userId,
          passwordHash: await hashPassword(input.password),
        },
      });

      return input.userId;
    }

    if (!existing.passwordCredential) {
      throw new ConflictException(
        'This email is already occupied and cannot be merged automatically',
      );
    }

    const verified = await verifyPassword(
      input.password,
      existing.passwordCredential.passwordHash,
    );

    if (!verified) {
      throw new UnauthorizedException('Email binding verification failed');
    }

    return this.identityLinkingService.mergeUsers({
      targetUserId: existing.id,
      sourceUserId: input.userId,
    });
  }

  async setPassword(userId: string, password: string) {
    assertPasswordStrength(password);
    const passwordHash = await hashPassword(password);

    await this.prisma.passwordCredential.upsert({
      where: { userId },
      create: {
        userId,
        passwordHash,
      },
      update: {
        passwordHash,
      },
    });
  }
}
