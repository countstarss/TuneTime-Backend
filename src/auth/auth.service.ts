import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SyncUserInput = {
  userId?: string;
  email?: string;
  name?: string;
  image?: string;
};

/** 与 schema 中 UserStatus 枚举一致，避免依赖 @prisma/client 解析 */
const USER_STATUS_ACTIVE = 'ACTIVE' as const;

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
}
