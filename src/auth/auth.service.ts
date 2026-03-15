import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password.util';
import { signAccessToken } from './token.util';

type SyncUserInput = {
  userId?: string;
  email?: string;
  name?: string;
  image?: string;
};

/** 与 schema 中 UserStatus 枚举一致，避免依赖 @prisma/client 解析 */
const USER_STATUS_ACTIVE = 'ACTIVE' as const;
const DEFAULT_ROLE = 'STUDENT' as const;

type RegisterInput = {
  name?: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type PublicUser = {
  id: string;
  name: string | null;
  email: string;
};

type AuthResponse = {
  accessToken: string;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * 同步或创建用户到数据库
   */
  async syncUser(input: SyncUserInput) {
    const { userId, email, name, image } = input;

    if (!userId && !email) {
      return null;
    }

    const commonUpdate = {
      status: USER_STATUS_ACTIVE,
      deletedAt: null,
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      ...(image ? { image } : {}),
    };

    const prisma = this.prisma as unknown as {
      user: { upsert: (args: unknown) => Promise<unknown> };
    };

    if (userId) {
      return prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
          name,
          image,
        },
        update: commonUpdate,
      });
    }

    return prisma.user.upsert({
      where: { email: email! },
      create: {
        email,
        name,
        image,
      },
      update: commonUpdate,
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: {
    id: string;
    name: string | null;
    email: string | null;
  }): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email ?? '',
    };
  }

  private async buildAuthResponse(user: {
    id: string;
    name: string | null;
    email: string | null;
  }): Promise<AuthResponse> {
    if (!user.email) {
      throw new UnauthorizedException('User email is missing');
    }

    const publicUser = this.toPublicUser(user);
    const accessToken = await signAccessToken({
      sub: publicUser.id,
      email: publicUser.email,
      name: publicUser.name ?? undefined,
    });

    return { accessToken, user: publicUser };
  }

  async registerWithPassword(input: RegisterInput): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);

    const prisma = this.prisma as unknown as {
      $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
      user: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          name: string | null;
          email: string | null;
          passwordCredential?: { id: string } | null;
        } | null>;
      };
    };

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });

    if (existingUser?.passwordCredential) {
      throw new ConflictException('This email is already registered');
    }

    const user = await prisma.$transaction(async (txUnknown) => {
      const tx = txUnknown as {
        user: {
          update: (args: unknown) => Promise<{
            id: string;
            name: string | null;
            email: string | null;
          }>;
          create: (args: unknown) => Promise<{
            id: string;
            name: string | null;
            email: string | null;
          }>;
        };
        passwordCredential: {
          create: (args: unknown) => Promise<unknown>;
        };
        userRole: {
          upsert: (args: unknown) => Promise<unknown>;
        };
      };

      if (existingUser) {
        await tx.passwordCredential.create({
          data: {
            userId: existingUser.id,
            passwordHash,
          },
        });

        await tx.userRole.upsert({
          where: {
            userId_role: {
              userId: existingUser.id,
              role: DEFAULT_ROLE,
            },
          },
          create: {
            userId: existingUser.id,
            role: DEFAULT_ROLE,
            isPrimary: true,
          },
          update: {},
        });

        return tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: input.name?.trim() || existingUser.name,
            status: USER_STATUS_ACTIVE,
            deletedAt: null,
          },
          select: { id: true, name: true, email: true },
        });
      }

      return tx.user.create({
        data: {
          name: input.name?.trim() || null,
          email,
          status: USER_STATUS_ACTIVE,
          roles: {
            create: {
              role: DEFAULT_ROLE,
              isPrimary: true,
            },
          },
          passwordCredential: {
            create: {
              passwordHash,
            },
          },
        },
        select: { id: true, name: true, email: true },
      });
    });

    return this.buildAuthResponse(user);
  }

  async loginWithPassword(input: LoginInput): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);

    const prisma = this.prisma as unknown as {
      user: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          name: string | null;
          email: string | null;
          status: string;
          passwordCredential: { passwordHash: string } | null;
        } | null>;
      };
    };

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        passwordCredential: {
          select: { passwordHash: true },
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

    if (!isValid || user.status !== USER_STATUS_ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async getProfileByUserId(userId: string): Promise<PublicUser | null> {
    const prisma = this.prisma as unknown as {
      user: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          name: string | null;
          email: string | null;
          status: string;
        } | null>;
      };
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, status: true },
    });

    if (!user || user.status !== USER_STATUS_ACTIVE || !user.email) {
      return null;
    }

    return this.toPublicUser(user);
  }
}
