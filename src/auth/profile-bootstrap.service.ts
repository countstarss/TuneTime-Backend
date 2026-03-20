import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PlatformRole,
  Prisma,
  TeacherVerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeDisplayName } from './auth.utils';

type DbClient = Prisma.TransactionClient | PrismaService;

type BootstrapOptions = {
  displayName?: string | null;
  phone?: string | null;
};

@Injectable()
export class ProfileBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureRoleForUser(
    userId: string,
    role: PlatformRole,
    options?: BootstrapOptions,
  ) {
    return this.prisma.$transaction((tx) =>
      this.ensureRoleForUserTx(tx, userId, role, options),
    );
  }

  async ensureRoleForUserTx(
    db: DbClient,
    userId: string,
    role: PlatformRole,
    options?: BootstrapOptions,
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        timezone: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const displayName = sanitizeDisplayName(
      options?.displayName ?? user.name,
      role === PlatformRole.TEACHER ? '新老师' : '新用户',
    );

    await db.userRole.upsert({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
      create: {
        userId,
        role,
        isPrimary: false,
      },
      update: {},
    });

    if (role === PlatformRole.TEACHER) {
      const profile = await db.teacherProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        await db.teacherProfile.create({
          data: {
            userId,
            displayName,
            employmentType: null,
            verificationStatus: TeacherVerificationStatus.PENDING,
            timezone: user.timezone,
          },
        });
      }

      return;
    }

    if (role === PlatformRole.GUARDIAN) {
      const profile = await db.guardianProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        await db.guardianProfile.create({
          data: {
            userId,
            displayName,
            phone: options?.phone ?? user.phone ?? null,
          },
        });
      }

      return;
    }

    if (role === PlatformRole.STUDENT) {
      const profile = await db.studentProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        await db.studentProfile.create({
          data: {
            userId,
            displayName,
            gradeLevel: null,
            timezone: user.timezone,
          },
        });
      }

      return;
    }

    throw new UnauthorizedException(
      `Role ${role} cannot be created through public auth`,
    );
  }

  async setPrimaryRole(userId: string, role: PlatformRole, db?: DbClient) {
    const client = db ?? this.prisma;
    const existingRole = await client.userRole.findUnique({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
      select: { id: true },
    });

    if (!existingRole) {
      throw new NotFoundException(
        `Role ${role} is not assigned to user ${userId}`,
      );
    }

    await client.userRole.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    await client.userRole.update({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
      data: { isPrimary: true },
    });
  }

  async getPrimaryRole(userId: string): Promise<PlatformRole | null> {
    const primaryRole = await this.prisma.userRole.findFirst({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { role: true },
    });

    return primaryRole?.role ?? null;
  }
}
