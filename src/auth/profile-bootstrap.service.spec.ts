import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PlatformRole, TeacherVerificationStatus } from '@prisma/client';
import { ProfileBootstrapService } from './profile-bootstrap.service';

describe('ProfileBootstrapService', () => {
  const prisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    userRole: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    guardianProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    studentProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: ProfileBootstrapService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileBootstrapService(prisma as never);
  });

  it('should create teacher role shell with pending verification', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '李老师',
      phone: '13800138000',
      timezone: 'Asia/Shanghai',
    });
    prisma.teacherProfile.findUnique.mockResolvedValue(null);

    await service.ensureRoleForUserTx(
      prisma as never,
      'user_1',
      PlatformRole.TEACHER,
      { displayName: '李老师' },
    );

    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user_1',
          role: PlatformRole.TEACHER,
        }),
      }),
    );
    expect(prisma.teacherProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        displayName: '李老师',
        employmentType: null,
        verificationStatus: TeacherVerificationStatus.PENDING,
      }),
    });
  });

  it('should keep bootstrap idempotent when guardian profile already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_2',
      name: '王女士',
      phone: '13800138000',
      timezone: 'Asia/Shanghai',
    });
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'guardian_1' });

    await service.ensureRoleForUserTx(
      prisma as never,
      'user_2',
      PlatformRole.GUARDIAN,
    );

    expect(prisma.guardianProfile.create).not.toHaveBeenCalled();
  });

  it('should switch primary role', async () => {
    prisma.userRole.findUnique.mockResolvedValue({ id: 'role_1' });

    await service.setPrimaryRole(
      'user_1',
      PlatformRole.GUARDIAN,
      prisma as never,
    );

    expect(prisma.userRole.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { isPrimary: false },
    });
    expect(prisma.userRole.update).toHaveBeenCalledWith({
      where: {
        userId_role: {
          userId: 'user_1',
          role: PlatformRole.GUARDIAN,
        },
      },
      data: { isPrimary: true },
    });
  });

  it('should throw when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.ensureRoleForUserTx(
        prisma as never,
        'missing',
        PlatformRole.GUARDIAN,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should reject non-public roles from bootstrap flow', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_3',
      name: '管理员',
      phone: null,
      timezone: 'Asia/Shanghai',
    });

    await expect(
      service.ensureRoleForUserTx(
        prisma as never,
        'user_3',
        PlatformRole.ADMIN,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
