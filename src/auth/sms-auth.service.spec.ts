import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthCodeChannel, AuthCodePurpose, PlatformRole } from '@prisma/client';
import { SmsAuthService } from './sms-auth.service';
import { hashVerificationCode } from './auth.utils';

describe('SmsAuthService', () => {
  const prisma = {
    authVerificationCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const smsGateway = {
    sendVerificationCode: jest.fn(),
  };

  const identityLinkingService = {
    createUser: jest.fn(),
    bindPhoneToUser: jest.fn(),
  };

  const profileBootstrapService = {
    ensureRoleForUser: jest.fn(),
    setPrimaryRole: jest.fn(),
  };

  let service: SmsAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SmsAuthService(
      prisma as never,
      smsGateway as never,
      identityLinkingService as never,
      profileBootstrapService as never,
    );
  });

  it('should throttle repeated code requests inside cooldown window', async () => {
    prisma.authVerificationCode.findFirst.mockResolvedValue({ id: 'code_1' });

    const error = (await service
      .requestLoginCode('13800138000')
      .catch((caughtError) => caughtError)) as HttpException;

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
  });

  it('should create verification code and dispatch sms', async () => {
    prisma.authVerificationCode.findFirst.mockResolvedValue(null);
    prisma.authVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.authVerificationCode.create.mockResolvedValue({ id: 'code_1' });

    const result = await service.requestLoginCode('13800138000');

    expect(prisma.authVerificationCode.updateMany).toHaveBeenCalledWith({
      where: {
        channel: AuthCodeChannel.SMS,
        purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
        target: '13800138000',
        consumedAt: null,
      },
      data: {
        consumedAt: expect.any(Date),
      },
    });
    expect(prisma.authVerificationCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: AuthCodeChannel.SMS,
        purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
        target: '13800138000',
      }),
    });
    expect(smsGateway.sendVerificationCode).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should create user and bootstrap requested role on first sms login', async () => {
    process.env.AUTH_CODE_SECRET = '12345678901234567890123456789012';
    prisma.authVerificationCode.findFirst.mockImplementation(async (args) => {
      expect(args).toMatchObject({
        where: {
          channel: AuthCodeChannel.SMS,
          purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
          target: '13800138000',
          consumedAt: null,
        },
        orderBy: { sentAt: 'desc' },
      });

      return {
        id: 'code_1',
        userId: null,
        codeHash: hashVerificationCode({
          channel: AuthCodeChannel.SMS,
          purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
          target: '13800138000',
          code: '123456',
        }),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        consumedAt: null,
        attemptCount: 0,
      };
    });
    prisma.authVerificationCode.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue(null);
    identityLinkingService.createUser.mockResolvedValue({ id: 'user_1' });

    const result = await service.verifyLoginCode({
      phone: '13800138000',
      code: '123456',
      requestedRole: PlatformRole.GUARDIAN,
      name: '王女士',
    });

    expect(identityLinkingService.createUser).toHaveBeenCalledWith({
      name: '王女士',
      phone: '13800138000',
      phoneVerifiedAt: expect.any(Date),
    });
    expect(profileBootstrapService.ensureRoleForUser).toHaveBeenCalledWith(
      'user_1',
      PlatformRole.GUARDIAN,
      expect.objectContaining({
        displayName: '王女士',
        phone: '13800138000',
      }),
    );
    expect(profileBootstrapService.setPrimaryRole).toHaveBeenCalledWith(
      'user_1',
      PlatformRole.GUARDIAN,
    );
    expect(result).toEqual({
      userId: 'user_1',
      activeRole: PlatformRole.GUARDIAN,
    });
  });

  it('should reject invalid verification code and increase attempts', async () => {
    prisma.authVerificationCode.findFirst.mockResolvedValue({
      id: 'code_2',
      userId: null,
      codeHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      attemptCount: 0,
    });
    prisma.authVerificationCode.update.mockResolvedValue({});

    await expect(
      service.verifyLoginCode({
        phone: '13800138000',
        code: '999999',
        requestedRole: PlatformRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.authVerificationCode.update).toHaveBeenCalledWith({
      where: { id: 'code_2' },
      data: {
        attemptCount: 1,
      },
    });
  });

  it('should ignore previously consumed codes when verifying the latest sms code', async () => {
    process.env.AUTH_CODE_SECRET = '12345678901234567890123456789012';
    prisma.authVerificationCode.findFirst.mockImplementation(async (args) => {
      expect(args).toMatchObject({
        where: {
          channel: AuthCodeChannel.SMS,
          purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
          target: '13800138000',
          consumedAt: null,
        },
        orderBy: { sentAt: 'desc' },
      });

      return {
        id: 'code_latest',
        userId: null,
        codeHash: hashVerificationCode({
          channel: AuthCodeChannel.SMS,
          purpose: AuthCodePurpose.LOGIN_OR_REGISTER,
          target: '13800138000',
          code: '654321',
        }),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        consumedAt: null,
        attemptCount: 0,
      };
    });
    prisma.authVerificationCode.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_existing',
      status: 'ACTIVE',
      roles: [{ role: PlatformRole.GUARDIAN }],
      name: '王女士',
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.verifyLoginCode({
      phone: '13800138000',
      code: '654321',
    });

    expect(result).toEqual({
      userId: 'user_existing',
      activeRole: PlatformRole.GUARDIAN,
    });
    expect(prisma.authVerificationCode.update).toHaveBeenCalledWith({
      where: { id: 'code_latest' },
      data: {
        consumedAt: expect.any(Date),
      },
    });
  });
});
