import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PlatformRole, UserStatus } from '@prisma/client';
import { hashPassword } from './password.util';
import { PasswordAuthService } from './password-auth.service';

describe('PasswordAuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    passwordCredential: {
      create: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const identityLinkingService = {
    mergeUsers: jest.fn(),
  };

  const profileBootstrapService = {
    ensureRoleForUser: jest.fn(),
    ensureRoleForUserTx: jest.fn(),
    setPrimaryRole: jest.fn(),
  };

  let service: PasswordAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PasswordAuthService(
      prisma as never,
      identityLinkingService as never,
      profileBootstrapService as never,
    );
  });

  it('should login with phone and password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      status: UserStatus.ACTIVE,
      roles: [{ role: PlatformRole.GUARDIAN }],
      passwordCredential: {
        passwordHash: await hashPassword('TuneTime123!'),
      },
    });

    const result = await service.loginWithPhone({
      phone: '13800138000',
      password: 'TuneTime123!',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { phone: '13800138000' },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      userId: 'user_1',
      activeRole: PlatformRole.GUARDIAN,
    });
  });

  it('should reject phone login when password is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      status: UserStatus.ACTIVE,
      roles: [{ role: PlatformRole.GUARDIAN }],
      passwordCredential: {
        passwordHash: await hashPassword('TuneTime123!'),
      },
    });

    await expect(
      service.loginWithPhone({
        phone: '13800138000',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should attach a requested public role during phone login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      status: UserStatus.ACTIVE,
      roles: [{ role: PlatformRole.GUARDIAN }],
      passwordCredential: {
        passwordHash: await hashPassword('TuneTime123!'),
      },
    });

    const result = await service.loginWithPhone({
      phone: '13800138000',
      password: 'TuneTime123!',
      requestedRole: PlatformRole.TEACHER,
    });

    expect(profileBootstrapService.ensureRoleForUser).toHaveBeenCalledWith(
      'user_1',
      PlatformRole.TEACHER,
      { phone: '13800138000' },
    );
    expect(profileBootstrapService.setPrimaryRole).toHaveBeenCalledWith(
      'user_1',
      PlatformRole.TEACHER,
    );
    expect(result.activeRole).toBe(PlatformRole.TEACHER);
  });

  it('should reject assigning an admin role during phone login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      status: UserStatus.ACTIVE,
      roles: [{ role: PlatformRole.GUARDIAN }],
      passwordCredential: {
        passwordHash: await hashPassword('TuneTime123!'),
      },
    });

    await expect(
      service.loginWithPhone({
        phone: '13800138000',
        password: 'TuneTime123!',
        requestedRole: PlatformRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should upsert password credentials when setting password', async () => {
    prisma.passwordCredential.upsert.mockResolvedValue({ id: 'pwd_1' });

    await service.setPassword('user_1', 'TuneTime123!');

    expect(prisma.passwordCredential.upsert).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      create: {
        userId: 'user_1',
        passwordHash: expect.any(String),
      },
      update: {
        passwordHash: expect.any(String),
      },
    });
  });
});
