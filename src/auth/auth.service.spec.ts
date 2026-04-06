jest.mock('./token.util', () => ({
  signAccessToken: jest.fn().mockResolvedValue('test-token'),
}));

import { ForbiddenException } from '@nestjs/common';
import {
  PlatformRole,
  TeacherVerificationStatus,
  UserStatus,
  Weekday,
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
    teacherAvailabilityRule: {
      count: jest.fn(),
      createMany: jest.fn(),
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
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  };

  const passwordAuthService = {
    registerWithEmail: jest.fn(),
    loginWithEmail: jest.fn(),
    loginWithPhone: jest.fn(),
    bindEmailPassword: jest.fn(),
    setPassword: jest.fn(),
  };

  const smsAuthService = {
    requestLoginCode: jest.fn(),
    verifyLoginCode: jest.fn(),
    requestPhoneBindCode: jest.fn(),
    confirmPhoneBind: jest.fn(),
    requestPasswordResetCode: jest.fn(),
    confirmPasswordResetCode: jest.fn(),
  };

  const wechatAuthService = {
    loginWithAppCode: jest.fn(),
    loginWithMiniappCode: jest.fn(),
  };

  const profileBootstrapService = {
    setPrimaryRole: jest.fn(),
  };

  const realNameVerificationService = {
    createSession: jest.fn(),
    completeMockSession: jest.fn(),
    getVerificationSnapshot: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEV_MVP_RELAXATIONS_ENABLED;
    process.env.AUTH_JWT_SECRET = '12345678901234567890123456789012';
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
    prisma.teacherAvailabilityRule.count.mockResolvedValue(0);
    prisma.teacherAvailabilityRule.createMany.mockResolvedValue({ count: 7 });
    realNameVerificationService.getVerificationSnapshot.mockResolvedValue({
      realNameVerifiedAt: null,
      realNameProvider: null,
      realNameVerifiedName: null,
      realNameIdNumberMasked: null,
    });
    service = new AuthService(
      prisma as never,
      passwordAuthService as never,
      smsAuthService as never,
      wechatAuthService as never,
      profileBootstrapService as never,
      realNameVerificationService as never,
    );
  });

  it('should build auth profile with login methods and onboarding state', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '王女士',
      email: 'user@example.com',
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      realNameVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      image: 'https://example.com/avatar.png',
      status: UserStatus.ACTIVE,
      passwordCredential: { id: 'pwd_1' },
      accounts: [{ provider: 'WECHAT_APP' }],
      teacherProfile: {
        id: 'teacher_1',
        displayName: '李老师',
        bio: '钢琴老师',
        employmentType: 'PART_TIME',
        baseHourlyRate: { toString: () => '200' },
        serviceRadiusKm: 8,
        acceptTrial: true,
        maxTravelMinutes: 50,
        agreementAcceptedAt: new Date('2026-03-18T00:00:00.000Z'),
        verificationStatus: TeacherVerificationStatus.APPROVED,
        onboardingCompletedAt: new Date('2026-03-20T00:00:00.000Z'),
        subjects: [{ id: 'teacher_subject_1' }],
        serviceAreas: [{ id: 'service_area_1' }],
        credentials: [{ id: 'credential_1' }],
      },
      guardianProfile: {
        id: 'guardian_1',
        displayName: '王女士',
        phone: '13800138000',
        emergencyContactName: '王先生',
        emergencyContactPhone: '13800138001',
        defaultServiceAddressId: 'addr_1',
        onboardingCompletedAt: new Date('2026-03-20T00:00:00.000Z'),
        students: [
          {
            studentProfile: {
              id: 'student_1',
              displayName: '小王',
              gradeLevel: 'PRIMARY',
              dateOfBirth: null,
              schoolName: null,
              learningGoals: null,
              specialNeeds: null,
            },
          },
        ],
      },
      studentProfile: null,
      roles: [
        { role: PlatformRole.GUARDIAN, isPrimary: true },
        { role: PlatformRole.TEACHER, isPrimary: false },
      ],
    });
    realNameVerificationService.getVerificationSnapshot.mockResolvedValue({
      realNameVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      realNameProvider: 'MOCK',
      realNameVerifiedName: '王女士',
      realNameIdNumberMasked: '1101********1234',
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
        hasPassword: true,
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
    expect(profile?.realNameVerified).toBe(true);
    expect(profile?.onboardingState.guardian.canBookLessons).toBe(true);
  });

  it('should switch role and issue a new token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '王女士',
      email: 'user@example.com',
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      realNameVerifiedAt: null,
      image: null,
      status: UserStatus.ACTIVE,
      passwordCredential: { id: 'pwd_1' },
      accounts: [],
      teacherProfile: null,
      guardianProfile: {
        id: 'guardian_1',
        displayName: '王女士',
        phone: '13800138000',
        emergencyContactName: null,
        emergencyContactPhone: null,
        defaultServiceAddressId: null,
        onboardingCompletedAt: null,
        students: [],
      },
      studentProfile: {
        id: 'student_1',
        displayName: '小宇',
        gradeLevel: 'PRIMARY',
        dateOfBirth: null,
        schoolName: null,
        learningGoals: null,
        specialNeeds: null,
        onboardingCompletedAt: null,
      },
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

  it('should allow dev MVP readiness without real-name verification or teacher approval', async () => {
    process.env.DEV_MVP_RELAXATIONS_ENABLED = 'true';
    service = new AuthService(
      prisma as never,
      passwordAuthService as never,
      smsAuthService as never,
      wechatAuthService as never,
      profileBootstrapService as never,
      realNameVerificationService as never,
    );

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
      teacherProfile: {
        id: 'teacher_1',
        displayName: '李老师',
        bio: '钢琴老师',
        employmentType: 'PART_TIME',
        baseHourlyRate: { toString: () => '200' },
        serviceRadiusKm: 8,
        acceptTrial: true,
        maxTravelMinutes: 50,
        agreementAcceptedAt: new Date('2026-03-18T00:00:00.000Z'),
        agreementVersion: 'miniapp-mvp-v1',
        verificationStatus: TeacherVerificationStatus.PENDING,
        onboardingCompletedAt: new Date('2026-03-20T00:00:00.000Z'),
        subjects: [{ id: 'teacher_subject_1' }],
        serviceAreas: [{ id: 'service_area_1' }],
        credentials: [],
      },
      guardianProfile: {
        id: 'guardian_1',
        displayName: '王女士',
        phone: '13800138000',
        emergencyContactName: '王先生',
        emergencyContactPhone: '13800138001',
        defaultServiceAddressId: 'addr_1',
        onboardingCompletedAt: new Date('2026-03-20T00:00:00.000Z'),
        students: [
          {
            studentProfile: {
              id: 'student_1',
              displayName: '小王',
              gradeLevel: 'PRIMARY',
              dateOfBirth: null,
              schoolName: null,
              learningGoals: null,
              specialNeeds: null,
            },
          },
        ],
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

    expect(profile?.onboardingState.teacher.canAcceptBookings).toBe(true);
    expect(profile?.onboardingState.guardian.canBookLessons).toBe(true);
    expect(profile?.onboardingState.teacher.missingRequiredItems).not.toContain(
      '实名认证',
    );
    expect(
      profile?.onboardingState.guardian.missingRequiredItems,
    ).not.toContain('实名认证');
  });

  it('should delegate miniapp login and issue auth response', async () => {
    wechatAuthService.loginWithMiniappCode.mockResolvedValue({
      userId: 'user_1',
      activeRole: PlatformRole.GUARDIAN,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '微信用户',
      email: null,
      phone: null,
      phoneVerifiedAt: null,
      image: null,
      status: UserStatus.ACTIVE,
      passwordCredential: null,
      accounts: [{ provider: 'WECHAT_MINIAPP' }],
      teacherProfile: null,
      guardianProfile: {
        id: 'guardian_1',
        displayName: '微信用户',
        phone: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        defaultServiceAddressId: null,
        onboardingCompletedAt: null,
        students: [],
      },
      studentProfile: null,
      roles: [{ role: PlatformRole.GUARDIAN, isPrimary: true }],
    });

    const result = await service.loginWithWechatMiniapp({
      code: 'miniapp-code',
      requestedRole: PlatformRole.GUARDIAN,
    });

    expect(wechatAuthService.loginWithMiniappCode).toHaveBeenCalledWith({
      code: 'miniapp-code',
      requestedRole: PlatformRole.GUARDIAN,
    });
    expect(result.accessToken).toBe('test-token');
    expect(result.user.loginMethods).toContain('WECHAT_MINIAPP');
  });

  it('should reject switching to a missing role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '王女士',
      email: null,
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      realNameVerifiedAt: null,
      image: null,
      status: UserStatus.ACTIVE,
      passwordCredential: null,
      accounts: [],
      teacherProfile: null,
      guardianProfile: {
        id: 'guardian_1',
        displayName: '王女士',
        phone: '13800138000',
        emergencyContactName: null,
        emergencyContactPhone: null,
        defaultServiceAddressId: null,
        onboardingCompletedAt: null,
        students: [],
      },
      studentProfile: null,
      roles: [{ role: PlatformRole.GUARDIAN, isPrimary: true }],
    });

    await expect(
      service.switchRole('user_1', PlatformRole.TEACHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should request password reset code for current verified phone', async () => {
    prisma.user.findUnique.mockResolvedValue({
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      status: UserStatus.ACTIVE,
    });
    smsAuthService.requestPasswordResetCode.mockResolvedValue({
      success: true,
      expiresInSeconds: 600,
      cooldownSeconds: 60,
    });

    const result = await service.requestPasswordResetCode('user_1');

    expect(smsAuthService.requestPasswordResetCode).toHaveBeenCalledWith(
      'user_1',
      '13800138000',
    );
    expect(result).toEqual({
      success: true,
      expiresInSeconds: 600,
      cooldownSeconds: 60,
    });
  });

  it('should seed default teacher availability rules after onboarding completion', async () => {
    process.env.DEV_MVP_RELAXATIONS_ENABLED = 'true';
    service = new AuthService(
      prisma as never,
      passwordAuthService as never,
      smsAuthService as never,
      wechatAuthService as never,
      profileBootstrapService as never,
      realNameVerificationService as never,
    );

    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher_1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: '李老师',
      email: null,
      phone: '13800138000',
      phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
      image: null,
      status: UserStatus.ACTIVE,
      passwordCredential: null,
      accounts: [],
      teacherProfile: {
        id: 'teacher_1',
        displayName: '李老师',
        bio: '钢琴老师',
        employmentType: 'PART_TIME',
        baseHourlyRate: { toString: () => '200' },
        serviceRadiusKm: 8,
        acceptTrial: true,
        maxTravelMinutes: 50,
        agreementAcceptedAt: new Date('2026-03-18T00:00:00.000Z'),
        agreementVersion: 'miniapp-mvp-v1',
        verificationStatus: TeacherVerificationStatus.PENDING,
        onboardingCompletedAt: new Date('2026-03-20T00:00:00.000Z'),
        subjects: [{ id: 'teacher_subject_1' }],
        serviceAreas: [{ id: 'service_area_1' }],
        credentials: [],
      },
      guardianProfile: null,
      studentProfile: null,
      roles: [{ role: PlatformRole.TEACHER, isPrimary: true }],
    });

    await service.updateSelfTeacherOnboarding('user_1', {
      displayName: '李老师',
      bio: '钢琴老师',
      employmentType: 'PART_TIME' as any,
      baseHourlyRate: 200,
      agreementAcceptedAt: '2026-03-18T00:00:00.000Z',
      agreementVersion: 'miniapp-mvp-v1',
      onboardingCompleted: true,
    });

    expect(prisma.teacherAvailabilityRule.count).toHaveBeenCalledWith({
      where: { teacherProfileId: 'teacher_1' },
    });
    expect(prisma.teacherAvailabilityRule.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          teacherProfileId: 'teacher_1',
          weekday: Weekday.MONDAY,
          startMinute: 1140,
          endMinute: 1260,
          slotDurationMinutes: 60,
          bufferMinutes: 0,
        }),
      ]),
    });
  });

  it('should confirm password reset and issue updated auth response', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        phone: '13800138000',
        phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
        status: UserStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: 'user_1',
        name: '王女士',
        email: null,
        phone: '13800138000',
        phoneVerifiedAt: new Date('2026-03-20T00:00:00.000Z'),
        realNameVerifiedAt: null,
        image: null,
        status: UserStatus.ACTIVE,
        passwordCredential: { id: 'pwd_1' },
        accounts: [],
        teacherProfile: null,
        guardianProfile: {
          id: 'guardian_1',
          displayName: '王女士',
          phone: '13800138000',
          emergencyContactName: null,
          emergencyContactPhone: null,
          defaultServiceAddressId: null,
          onboardingCompletedAt: null,
          students: [],
        },
        studentProfile: null,
        roles: [{ role: PlatformRole.GUARDIAN, isPrimary: true }],
      });

    const result = await service.confirmPasswordReset(
      'user_1',
      '123456',
      'TuneTime123!',
      PlatformRole.GUARDIAN,
    );

    expect(smsAuthService.confirmPasswordResetCode).toHaveBeenCalledWith({
      userId: 'user_1',
      phone: '13800138000',
      code: '123456',
    });
    expect(passwordAuthService.setPassword).toHaveBeenCalledWith(
      'user_1',
      'TuneTime123!',
    );
    expect(result.user.hasPassword).toBe(true);
    expect(result.accessToken).toBe('test-token');
  });
});
