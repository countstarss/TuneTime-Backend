import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WECHAT_APP_PROVIDER } from './auth.constants';

type WechatIdentity = {
  providerAppId: string;
  providerAccountId: string;
  unionId: string | null;
  openId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  idToken?: string | null;
  profileRaw?: Prisma.InputJsonValue;
};

type MergeCandidate = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    emailVerified: true;
    phone: true;
    phoneVerifiedAt: true;
    image: true;
    locale: true;
    timezone: true;
    roles: { select: { role: true; isPrimary: true } };
    accounts: {
      select: { id: true; provider: true; providerAccountId: true };
    };
    passwordCredential: { select: { id: true } };
    teacherProfile: { select: { id: true } };
    guardianProfile: { select: { id: true } };
    studentProfile: { select: { id: true } };
    wallet: { select: { id: true } };
  };
}>;

@Injectable()
export class IdentityLinkingService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async findUserByWechatIdentity(identity: {
    providerAccountId: string;
    unionId: string | null;
    openId: string;
  }) {
    if (identity.unionId) {
      const byUnion = await this.prisma.account.findFirst({
        where: {
          provider: WECHAT_APP_PROVIDER,
          unionId: identity.unionId,
        },
        select: {
          user: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (byUnion?.user) {
        return byUnion.user;
      }
    }

    const byOpenId = await this.prisma.account.findFirst({
      where: {
        provider: WECHAT_APP_PROVIDER,
        openId: identity.openId,
      },
      select: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return byOpenId?.user ?? null;
  }

  async createUser(data: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    image?: string | null;
    emailVerified?: Date | null;
    phoneVerifiedAt?: Date | null;
  }) {
    return this.prisma.user.create({
      data: {
        name: data.name ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        image: data.image ?? null,
        emailVerified: data.emailVerified ?? null,
        phoneVerifiedAt: data.phoneVerifiedAt ?? null,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });
  }

  async upsertWechatAccount(userId: string, identity: WechatIdentity) {
    const existing = await this.prisma.account.findFirst({
      where: {
        provider: WECHAT_APP_PROVIDER,
        OR: [
          ...(identity.unionId ? [{ unionId: identity.unionId }] : []),
          { openId: identity.openId },
          { providerAccountId: identity.providerAccountId },
        ],
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        'WeChat account is already linked to another user',
      );
    }

    if (existing) {
      await this.prisma.account.update({
        where: { id: existing.id },
        data: {
          providerAccountId: identity.providerAccountId,
          providerAppId: identity.providerAppId,
          unionId: identity.unionId,
          openId: identity.openId,
          access_token: identity.accessToken ?? null,
          refresh_token: identity.refreshToken ?? null,
          expires_at: identity.expiresAt ?? null,
          scope: identity.scope ?? null,
          id_token: identity.idToken ?? null,
          profileRaw: identity.profileRaw,
          lastLoginAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.account.create({
      data: {
        userId,
        type: 'oauth',
        provider: WECHAT_APP_PROVIDER,
        providerAccountId: identity.providerAccountId,
        providerAppId: identity.providerAppId,
        unionId: identity.unionId,
        openId: identity.openId,
        access_token: identity.accessToken ?? null,
        refresh_token: identity.refreshToken ?? null,
        expires_at: identity.expiresAt ?? null,
        scope: identity.scope ?? null,
        id_token: identity.idToken ?? null,
        profileRaw: identity.profileRaw,
        lastLoginAt: new Date(),
      },
    });
  }

  async bindPhoneToUser(userId: string, phone: string, verifiedAt: Date) {
    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phone,
          phoneVerifiedAt: verifiedAt,
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      });

      return userId;
    }

    if (existing.id === userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phoneVerifiedAt: verifiedAt,
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      });
      return userId;
    }

    const mergedUserId = await this.mergeUsers({
      targetUserId: existing.id,
      sourceUserId: userId,
    });

    await this.prisma.user.update({
      where: { id: mergedUserId },
      data: {
        phone,
        phoneVerifiedAt: verifiedAt,
      },
    });

    return mergedUserId;
  }

  async bindEmailToUser(userId: string, email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email,
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      });

      return userId;
    }

    if (existing.id === userId) {
      return userId;
    }

    return this.mergeUsers({
      targetUserId: existing.id,
      sourceUserId: userId,
    });
  }

  private async getMergeCandidate(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<MergeCandidate> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerifiedAt: true,
        image: true,
        locale: true,
        timezone: true,
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            role: true,
            isPrimary: true,
          },
        },
        accounts: {
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
          },
        },
        passwordCredential: {
          select: { id: true },
        },
        teacherProfile: {
          select: { id: true },
        },
        guardianProfile: {
          select: { id: true },
        },
        studentProfile: {
          select: { id: true },
        },
        wallet: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    return user;
  }

  async mergeUsers(input: { targetUserId: string; sourceUserId: string }) {
    if (input.targetUserId === input.sourceUserId) {
      return input.targetUserId;
    }

    return this.prisma.$transaction(async (tx) => {
      const [target, source] = await Promise.all([
        this.getMergeCandidate(tx, input.targetUserId),
        this.getMergeCandidate(tx, input.sourceUserId),
      ]);

      if (target.email && source.email && target.email !== source.email) {
        throw new ConflictException(
          'Cannot merge two users with different emails',
        );
      }

      if (target.phone && source.phone && target.phone !== source.phone) {
        throw new ConflictException(
          'Cannot merge two users with different phones',
        );
      }

      if (target.passwordCredential && source.passwordCredential) {
        throw new ConflictException(
          'Cannot merge two users that both have password credentials',
        );
      }

      if (target.teacherProfile && source.teacherProfile) {
        throw new ConflictException(
          'Cannot merge two users that both have teacher profiles',
        );
      }

      if (target.guardianProfile && source.guardianProfile) {
        throw new ConflictException(
          'Cannot merge two users that both have guardian profiles',
        );
      }

      if (target.studentProfile && source.studentProfile) {
        throw new ConflictException(
          'Cannot merge two users that both have student profiles',
        );
      }

      if (target.wallet && source.wallet) {
        throw new ConflictException(
          'Cannot merge two users that both have wallets',
        );
      }

      if (source.passwordCredential && !target.passwordCredential) {
        await tx.passwordCredential.update({
          where: { userId: source.id },
          data: { userId: target.id },
        });
      }

      if (source.teacherProfile && !target.teacherProfile) {
        await tx.teacherProfile.update({
          where: { userId: source.id },
          data: { userId: target.id },
        });
      }

      if (source.guardianProfile && !target.guardianProfile) {
        await tx.guardianProfile.update({
          where: { userId: source.id },
          data: { userId: target.id },
        });
      }

      if (source.studentProfile && !target.studentProfile) {
        await tx.studentProfile.update({
          where: { userId: source.id },
          data: { userId: target.id },
        });
      }

      if (source.wallet && !target.wallet) {
        await tx.wallet.update({
          where: { ownerUserId: source.id },
          data: { ownerUserId: target.id },
        });
      }

      const sourceRoles = source.roles.map((item) => item.role);
      const targetRoles = new Set(target.roles.map((item) => item.role));
      const rolesToCreate = sourceRoles
        .filter((role) => !targetRoles.has(role))
        .map((role) => ({
          userId: target.id,
          role,
          isPrimary: false,
        }));

      if (rolesToCreate.length) {
        await tx.userRole.createMany({
          data: rolesToCreate,
          skipDuplicates: true,
        });
      }

      const targetAccountKeys = new Set(
        target.accounts.map(
          (account) => `${account.provider}:${account.providerAccountId}`,
        ),
      );

      for (const account of source.accounts) {
        const key = `${account.provider}:${account.providerAccountId}`;
        if (targetAccountKeys.has(key)) {
          await tx.account.delete({ where: { id: account.id } });
          continue;
        }

        await tx.account.update({
          where: { id: account.id },
          data: { userId: target.id },
        });
      }

      await Promise.all([
        tx.session.updateMany({
          where: { userId: source.id },
          data: { userId: target.id },
        }),
        tx.authenticator.updateMany({
          where: { userId: source.id },
          data: { userId: target.id },
        }),
        tx.address.updateMany({
          where: { userId: source.id },
          data: { userId: target.id },
        }),
        tx.authVerificationCode.updateMany({
          where: { userId: source.id },
          data: { userId: target.id },
        }),
        tx.booking.updateMany({
          where: { cancelledByUserId: source.id },
          data: { cancelledByUserId: target.id },
        }),
        tx.paymentIntent.updateMany({
          where: { payerUserId: source.id },
          data: { payerUserId: target.id },
        }),
        tx.walletTransaction.updateMany({
          where: { createdByUserId: source.id },
          data: { createdByUserId: target.id },
        }),
        tx.adminAuditLog.updateMany({
          where: { actorUserId: source.id },
          data: { actorUserId: target.id },
        }),
        tx.teacherAvailabilityBlock.updateMany({
          where: { createdByUserId: source.id },
          data: { createdByUserId: target.id },
        }),
        tx.teacherCredential.updateMany({
          where: { reviewedByUserId: source.id },
          data: { reviewedByUserId: target.id },
        }),
      ]);

      const nextPrimaryRole =
        target.roles.find((item) => item.isPrimary)?.role ??
        source.roles.find((item) => item.isPrimary)?.role ??
        target.roles[0]?.role ??
        source.roles[0]?.role ??
        null;

      const targetUpdateAfterDelete: Prisma.UserUpdateInput = {
        deletedAt: null,
        status: UserStatus.ACTIVE,
      };

      if (!target.name && source.name) {
        targetUpdateAfterDelete.name = source.name;
      }

      if (!target.image && source.image) {
        targetUpdateAfterDelete.image = source.image;
      }

      if (!target.email && source.email) {
        targetUpdateAfterDelete.email = source.email;
      }

      if (!target.emailVerified && source.emailVerified) {
        targetUpdateAfterDelete.emailVerified = source.emailVerified;
      }

      if (!target.phone && source.phone) {
        targetUpdateAfterDelete.phone = source.phone;
      }

      if (!target.phoneVerifiedAt && source.phoneVerifiedAt) {
        targetUpdateAfterDelete.phoneVerifiedAt = source.phoneVerifiedAt;
      }

      if (!target.locale && source.locale) {
        targetUpdateAfterDelete.locale = source.locale;
      }

      if (!target.timezone && source.timezone) {
        targetUpdateAfterDelete.timezone = source.timezone;
      }

      await tx.user.delete({
        where: { id: source.id },
      });

      await tx.user.update({
        where: { id: target.id },
        data: targetUpdateAfterDelete,
      });

      if (nextPrimaryRole) {
        await tx.userRole.updateMany({
          where: { userId: target.id },
          data: { isPrimary: false },
        });

        await tx.userRole.update({
          where: {
            userId_role: {
              userId: target.id,
              role: nextPrimaryRole,
            },
          },
          data: { isPrimary: true },
        });
      }

      return target.id;
    });
  }
}
