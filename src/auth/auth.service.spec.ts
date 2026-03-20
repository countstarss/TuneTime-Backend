jest.mock('./token.util', () => ({
  signAccessToken: jest.fn().mockResolvedValue('test-token'),
}));

import { ForbiddenException } from '@nestjs/common';
import {
  PlatformRole,
  TeacherVerificationStatus,
  UserStatus,
} from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    guardianProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    studentProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
  };

  const passwordAuthService = {
    registerWithEmail: jest.fn(),
    loginWithEmail: jest.fn(),
    bindEmailPassword: jest.fn(),
  };

  const smsAuthService = {
    requestLoginCode: jest.fn(),
    verifyLoginCode: jest.fn(),
    requestPhoneBindCode: jest.fn(),
    confirmPhoneBind: jest.fn(),
  };

  const wechatAuthService = {
    loginWithAppCode: jest.fn(),
  };

  const profileBootstrapService = {
    setPrimaryRole: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_JWT_SECRET = '12345678901234567890123456789012';
    service = new AuthService(
      prisma as never,
      passwordAuthService as never,
      smsAuthService as never,
      wechatAuthService as never,
      profileBootstrapService as never,
    );
  });

  it('should build auth profile with login methods and onboarding state', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '王女士',
      email: 'user@example.com',
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      image: 'https://example.com/avatar.png',
      status: UserStatus.ACTIVE,
      passwordCredential: { id: 'pwd_1' },
      accounts: [{ provider: 'WECHAT_APP' }],
      teacherProfile: {
        id: 'teacher_1',
        verificationStatus: TeacherVerificationStatus.APPROVED,
        onboardingCompletedAt: new Date('2026-03-20T00:00:00.000Z'),
      },
      guardianProfile: {
        id: 'guardian_1',
      },
      studentProfile: null,
      roles: [
        { role: PlatformRole.GUARDIAN, isPrimary: true },
        { role: PlatformRole.TEACHER, isPrimary: false },
      ],
    });

    const profile = await service.getProfileByUserId(
      'user_1',
      PlatformRole.TEACHER,
    );

    expect(profile).toEqual(
      expect.objectContaining({
        id: 'user_1',
        roles: [PlatformRole.GUARDIAN, PlatformRole.TEACHER],
        activeRole: PlatformRole.TEACHER,
        loginMethods: expect.arrayContaining([
          'EMAIL_PASSWORD',
          'SMS',
          'WECHAT_APP',
        ]),
        profileIds: {
          teacherProfileId: 'teacher_1',
          guardianProfileId: 'guardian_1',
          studentProfileId: null,
        },
      }),
    );
    expect(profile?.onboardingState.teacher.canAcceptBookings).toBe(true);
  });

  it('should switch role and issue a new token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '王女士',
      email: 'user@example.com',
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      image: null,
      status: UserStatus.ACTIVE,
      passwordCredential: { id: 'pwd_1' },
      accounts: [],
      teacherProfile: null,
      guardianProfile: { id: 'guardian_1' },
      studentProfile: { id: 'student_1' },
      roles: [
        { role: PlatformRole.GUARDIAN, isPrimary: true },
        { role: PlatformRole.STUDENT, isPrimary: false },
      ],
    });

    const result = await service.switchRole('user_1', PlatformRole.STUDENT);

    expect(profileBootstrapService.setPrimaryRole).toHaveBeenCalledWith(
      'user_1',
      PlatformRole.STUDENT,
    );
    expect(result.user.activeRole).toBe(PlatformRole.STUDENT);
    expect(result.accessToken).toBe('test-token');
  });

  it('should reject switching to a missing role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '王女士',
      email: null,
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      image: null,
      status: UserStatus.ACTIVE,
      passwordCredential: null,
      accounts: [],
      teacherProfile: null,
      guardianProfile: { id: 'guardian_1' },
      studentProfile: null,
      roles: [{ role: PlatformRole.GUARDIAN, isPrimary: true }],
    });

    await expect(
      service.switchRole('user_1', PlatformRole.TEACHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
