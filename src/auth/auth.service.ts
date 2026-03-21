import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GuardianRelation,
  PlatformRole,
  TeacherEmploymentType,
  TeacherVerificationStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthenticatedUserContext,
  AuthResponse,
  AuthUserProfile,
} from './auth.types';
import { signAccessToken } from './token.util';
import { PasswordAuthService } from './password-auth.service';
import { SmsAuthService } from './sms-auth.service';
import { WechatAuthService } from './wechat-auth.service';
import { ProfileBootstrapService } from './profile-bootstrap.service';
import { normalizePhone, sanitizeDisplayName } from './auth.utils';
import { RealNameVerificationService } from './real-name-verification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordAuthService: PasswordAuthService,
    private readonly smsAuthService: SmsAuthService,
    private readonly wechatAuthService: WechatAuthService,
    private readonly profileBootstrapService: ProfileBootstrapService,
    private readonly realNameVerificationService: RealNameVerificationService,
  ) {}

  private buildCompletionState(
    requiredItems: Array<{ label: string; completed: boolean }>,
    optionalItems: Array<{ label: string; completed: boolean }>,
  ) {
    const total = requiredItems.length + optionalItems.length;
    const completed = [...requiredItems, ...optionalItems].filter(
      (item) => item.completed,
    ).length;

    return {
      completionPercent:
        total === 0 ? 100 : Math.round((completed / total) * 100),
      missingRequiredItems: requiredItems
        .filter((item) => !item.completed)
        .map((item) => item.label),
      missingOptionalItems: optionalItems
        .filter((item) => !item.completed)
        .map((item) => item.label),
    };
  }

  private async getProfileProjection(userId: string) {
    const prisma = this.prisma as any;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        image: true,
        status: true,
        passwordCredential: {
          select: { id: true },
        },
        accounts: {
          select: {
            provider: true,
          },
        },
        teacherProfile: {
          select: {
            id: true,
            displayName: true,
            bio: true,
            employmentType: true,
            baseHourlyRate: true,
            serviceRadiusKm: true,
            acceptTrial: true,
            maxTravelMinutes: true,
            agreementAcceptedAt: true,
            verificationStatus: true,
            onboardingCompletedAt: true,
            subjects: {
              where: { isActive: true },
              select: { id: true },
            },
            serviceAreas: {
              select: { id: true },
            },
            credentials: {
              select: { id: true },
            },
          },
        },
        guardianProfile: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            defaultServiceAddressId: true,
            onboardingCompletedAt: true,
            students: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              take: 1,
              select: {
                studentProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    gradeLevel: true,
                    dateOfBirth: true,
                    schoolName: true,
                    learningGoals: true,
                    specialNeeds: true,
                  },
                },
              },
            },
          },
        },
        studentProfile: {
          select: {
            id: true,
            displayName: true,
            gradeLevel: true,
            dateOfBirth: true,
            schoolName: true,
            learningGoals: true,
            specialNeeds: true,
            onboardingCompletedAt: true,
          },
        },
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { role: true, isPrimary: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    const realNameSnapshot =
      await this.realNameVerificationService.getVerificationSnapshot(userId);

    return {
      ...user,
      realNameVerifiedAt: realNameSnapshot.realNameVerifiedAt,
    };
  }

  private buildAuthUserProfile(
    user: NonNullable<Awaited<ReturnType<AuthService['getProfileProjection']>>>,
    requestedActiveRole?: PlatformRole | null,
  ): AuthUserProfile {
    const roles = user.roles.map((item) => item.role);
    const primaryRole =
      user.roles.find((item) => item.isPrimary)?.role ?? roles[0] ?? null;
    const activeRole =
      requestedActiveRole && roles.includes(requestedActiveRole)
        ? requestedActiveRole
        : primaryRole;
    const loginMethods = new Set<string>();

    if (user.email && user.passwordCredential) {
      loginMethods.add('EMAIL_PASSWORD');
    }
    if (user.phone && user.phoneVerifiedAt) {
      loginMethods.add('SMS');
    }
    if (user.accounts.some((item) => item.provider === 'WECHAT_APP')) {
      loginMethods.add('WECHAT_APP');
    }

    const realNameVerified = !!user.realNameVerifiedAt;
    const teacherRequiredItems = [
      { label: '老师档案', completed: !!user.teacherProfile },
      {
        label: '老师显示名',
        completed: !!user.teacherProfile?.displayName?.trim(),
      },
      { label: '个人简介', completed: !!user.teacherProfile?.bio?.trim() },
      {
        label: '老师身份类型',
        completed: !!user.teacherProfile?.employmentType,
      },
      {
        label: '课时费',
        completed: Number(user.teacherProfile?.baseHourlyRate ?? 0) > 0,
      },
      {
        label: '服务区域',
        completed: (user.teacherProfile?.serviceAreas.length ?? 0) > 0,
      },
      {
        label: '授课科目',
        completed: (user.teacherProfile?.subjects.length ?? 0) > 0,
      },
      {
        label: '入驻协议',
        completed: !!user.teacherProfile?.agreementAcceptedAt,
      },
      { label: '实名认证', completed: realNameVerified },
    ];
    const teacherOptionalItems = [
      {
        label: '资质材料',
        completed: (user.teacherProfile?.credentials.length ?? 0) > 0,
      },
      {
        label: '授课半径',
        completed: Number(user.teacherProfile?.serviceRadiusKm ?? 0) > 0,
      },
      {
        label: '路程时长',
        completed: Number(user.teacherProfile?.maxTravelMinutes ?? 0) > 0,
      },
    ];
    const teacherCompletion = this.buildCompletionState(
      teacherRequiredItems,
      teacherOptionalItems,
    );

    const guardianStudent = user.guardianProfile?.students[0]?.studentProfile;
    const guardianRequiredItems = [
      { label: '家长档案', completed: !!user.guardianProfile },
      {
        label: '家长显示名',
        completed: !!user.guardianProfile?.displayName?.trim(),
      },
      { label: '手机号已验证', completed: !!user.phoneVerifiedAt },
      {
        label: '紧急联系人',
        completed: !!user.guardianProfile?.emergencyContactName?.trim(),
      },
      {
        label: '紧急联系电话',
        completed: !!user.guardianProfile?.emergencyContactPhone?.trim(),
      },
      {
        label: '孩子信息',
        completed: !!guardianStudent?.displayName?.trim(),
      },
      {
        label: '孩子年级',
        completed: !!guardianStudent?.gradeLevel,
      },
      {
        label: '默认上课地址',
        completed: !!user.guardianProfile?.defaultServiceAddressId,
      },
      { label: '实名认证', completed: realNameVerified },
    ];
    const guardianOptionalItems = [
      { label: '出生日期', completed: !!guardianStudent?.dateOfBirth },
      { label: '学校信息', completed: !!guardianStudent?.schoolName?.trim() },
      {
        label: '学习目标',
        completed: !!guardianStudent?.learningGoals?.trim(),
      },
      {
        label: '特殊说明',
        completed: !!guardianStudent?.specialNeeds?.trim(),
      },
    ];
    const guardianCompletion = this.buildCompletionState(
      guardianRequiredItems,
      guardianOptionalItems,
    );

    const studentRequiredItems = [
      { label: '学生档案', completed: !!user.studentProfile },
      {
        label: '学生显示名',
        completed: !!user.studentProfile?.displayName?.trim(),
      },
      { label: '年级', completed: !!user.studentProfile?.gradeLevel },
      { label: '手机号已验证', completed: !!user.phoneVerifiedAt },
      { label: '实名认证', completed: realNameVerified },
    ];
    const studentOptionalItems = [
      { label: '出生日期', completed: !!user.studentProfile?.dateOfBirth },
      { label: '学校信息', completed: !!user.studentProfile?.schoolName?.trim() },
      {
        label: '学习目标',
        completed: !!user.studentProfile?.learningGoals?.trim(),
      },
      {
        label: '特殊说明',
        completed: !!user.studentProfile?.specialNeeds?.trim(),
      },
    ];
    const studentCompletion = this.buildCompletionState(
      studentRequiredItems,
      studentOptionalItems,
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.image,
      hasPassword: !!user.passwordCredential,
      realNameVerified,
      realNameVerifiedAt: user.realNameVerifiedAt,
      roles,
      availableRoles: roles,
      primaryRole,
      activeRole,
      loginMethods: Array.from(loginMethods) as AuthUserProfile['loginMethods'],
      profileIds: {
        teacherProfileId: user.teacherProfile?.id ?? null,
        guardianProfileId: user.guardianProfile?.id ?? null,
        studentProfileId: user.studentProfile?.id ?? null,
      },
      onboardingState: {
        teacher: {
          profileExists: !!user.teacherProfile,
          onboardingCompleted: !!user.teacherProfile?.onboardingCompletedAt,
          completionPercent: teacherCompletion.completionPercent,
          missingRequiredItems: teacherCompletion.missingRequiredItems,
          missingOptionalItems: teacherCompletion.missingOptionalItems,
          realNameVerified,
          verificationStatus: user.teacherProfile?.verificationStatus ?? null,
          canAcceptBookings:
            teacherCompletion.missingRequiredItems.length === 0 &&
            user.teacherProfile?.verificationStatus ===
              TeacherVerificationStatus.APPROVED,
        },
        guardian: {
          profileExists: !!user.guardianProfile,
          onboardingCompleted: !!user.guardianProfile?.onboardingCompletedAt,
          completionPercent: guardianCompletion.completionPercent,
          phoneVerified: !!user.phoneVerifiedAt,
          realNameVerified,
          hasLinkedStudent: !!guardianStudent,
          hasDefaultAddress: !!user.guardianProfile?.defaultServiceAddressId,
          missingRequiredItems: guardianCompletion.missingRequiredItems,
          missingOptionalItems: guardianCompletion.missingOptionalItems,
          canBookLessons: guardianCompletion.missingRequiredItems.length === 0,
        },
        student: {
          profileExists: !!user.studentProfile,
          onboardingCompleted: !!user.studentProfile?.onboardingCompletedAt,
          completionPercent: studentCompletion.completionPercent,
          phoneVerified: !!user.phoneVerifiedAt,
          realNameVerified,
          missingRequiredItems: studentCompletion.missingRequiredItems,
          missingOptionalItems: studentCompletion.missingOptionalItems,
          canBookLessons: studentCompletion.missingRequiredItems.length === 0,
        },
      },
    };
  }

  async issueAuthResponse(
    userId: string,
    requestedActiveRole?: PlatformRole | null,
  ): Promise<AuthResponse> {
    const profile = await this.getProfileByUserId(userId, requestedActiveRole);
    if (!profile) {
      throw new UnauthorizedException('User profile not found');
    }

    const accessToken = await signAccessToken({
      sub: profile.id,
      email: profile.email ?? undefined,
      name: profile.name ?? undefined,
      activeRole: profile.activeRole ?? undefined,
    });

    return {
      accessToken,
      user: profile,
    };
  }

  async registerWithPassword(input: {
    name?: string;
    email: string;
    password: string;
    requestedRole: PlatformRole;
  }): Promise<AuthResponse> {
    const result = await this.passwordAuthService.registerWithEmail(input);
    return this.issueAuthResponse(result.userId, result.activeRole);
  }

  async loginWithPassword(input: {
    email: string;
    password: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthResponse> {
    const result = await this.passwordAuthService.loginWithEmail(input);
    return this.issueAuthResponse(result.userId, result.activeRole);
  }

  async loginWithPhonePassword(input: {
    phone: string;
    password: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthResponse> {
    const result = await this.passwordAuthService.loginWithPhone(input);
    return this.issueAuthResponse(result.userId, result.activeRole);
  }

  async requestSmsCode(phone: string) {
    return this.smsAuthService.requestLoginCode(phone);
  }

  async verifySmsCode(input: {
    phone: string;
    code: string;
    requestedRole?: PlatformRole;
    name?: string;
  }): Promise<AuthResponse> {
    const result = await this.smsAuthService.verifyLoginCode(input);
    return this.issueAuthResponse(result.userId, result.activeRole);
  }

  async loginWithWechatApp(input: {
    code: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthResponse> {
    const result = await this.wechatAuthService.loginWithAppCode(input);
    return this.issueAuthResponse(result.userId, result.activeRole);
  }

  async requestPhoneBindCode(userId: string, phone: string) {
    return this.smsAuthService.requestPhoneBindCode(userId, phone);
  }

  async confirmPhoneBind(
    userId: string,
    phone: string,
    code: string,
    preferredRole?: PlatformRole | null,
  ): Promise<AuthResponse> {
    const mergedUserId = await this.smsAuthService.confirmPhoneBind({
      userId,
      phone,
      code,
    });
    return this.issueAuthResponse(mergedUserId, preferredRole);
  }

  async bindEmailPassword(
    userId: string,
    email: string,
    password: string,
    preferredRole?: PlatformRole | null,
  ): Promise<AuthResponse> {
    const mergedUserId = await this.passwordAuthService.bindEmailPassword({
      userId,
      email,
      password,
    });
    return this.issueAuthResponse(mergedUserId, preferredRole);
  }

  async requestPasswordResetCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        phoneVerifiedAt: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User profile not found');
    }

    if (!user.phone || !user.phoneVerifiedAt) {
      throw new BadRequestException(
        'A verified phone number is required to reset password',
      );
    }

    return this.smsAuthService.requestPasswordResetCode(userId, user.phone);
  }

  async confirmPasswordReset(
    userId: string,
    code: string,
    password: string,
    preferredRole?: PlatformRole | null,
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        phoneVerifiedAt: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User profile not found');
    }

    if (!user.phone || !user.phoneVerifiedAt) {
      throw new BadRequestException(
        'A verified phone number is required to reset password',
      );
    }

    await this.smsAuthService.confirmPasswordResetCode({
      userId,
      phone: user.phone,
      code,
    });
    await this.passwordAuthService.setPassword(userId, password);

    return this.issueAuthResponse(userId, preferredRole);
  }

  async createRealNameVerificationSession(
    userId: string,
    dto: { redirectUrl?: string },
  ) {
    return this.realNameVerificationService.createSession(
      userId,
      dto.redirectUrl,
    );
  }

  async completeMockRealNameVerification(
    userId: string,
    dto: { sessionId: string; fullName: string; idNumber: string },
    preferredRole?: PlatformRole | null,
  ) {
    await this.realNameVerificationService.completeMockSession({
      userId,
      sessionId: dto.sessionId,
      fullName: dto.fullName,
      idNumber: dto.idNumber,
    });
    return this.issueAuthResponse(userId, preferredRole);
  }

  async switchRole(userId: string, role: PlatformRole): Promise<AuthResponse> {
    const profile = await this.getProfileByUserId(userId);
    if (!profile) {
      throw new UnauthorizedException('User profile not found');
    }

    if (!profile.roles.includes(role)) {
      throw new ForbiddenException(
        'Requested role is not assigned to this user',
      );
    }

    await this.profileBootstrapService.setPrimaryRole(userId, role);
    return this.issueAuthResponse(userId, role);
  }

  async getProfileByUserId(
    userId: string,
    requestedActiveRole?: PlatformRole | null,
  ): Promise<AuthUserProfile | null> {
    const user = await this.getProfileProjection(userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return this.buildAuthUserProfile(user, requestedActiveRole);
  }

  async getProfileForContext(
    currentUser: AuthenticatedUserContext,
  ): Promise<AuthUserProfile> {
    const profile = await this.getProfileByUserId(
      currentUser.userId,
      currentUser.activeRole,
    );

    if (!profile) {
      throw new UnauthorizedException('User profile not found');
    }

    return profile;
  }

  async updateSelfTeacherProfile(
    userId: string,
    dto: {
      displayName?: string;
      bio?: string;
      employmentType?: TeacherEmploymentType;
      baseHourlyRate?: number;
      serviceRadiusKm?: number;
      acceptTrial?: boolean;
      maxTravelMinutes?: number;
      timezone?: string;
      agreementAcceptedAt?: string;
      agreementVersion?: string;
      onboardingCompleted?: boolean;
    },
  ) {
    const teacher = await (this.prisma as any).teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    await (this.prisma as any).teacherProfile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: sanitizeDisplayName(dto.displayName, '新老师') }
          : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
        ...(dto.employmentType !== undefined
          ? { employmentType: dto.employmentType as never }
          : {}),
        ...(dto.baseHourlyRate !== undefined
          ? { baseHourlyRate: dto.baseHourlyRate }
          : {}),
        ...(dto.serviceRadiusKm !== undefined
          ? { serviceRadiusKm: dto.serviceRadiusKm }
          : {}),
        ...(dto.acceptTrial !== undefined
          ? { acceptTrial: dto.acceptTrial }
          : {}),
        ...(dto.maxTravelMinutes !== undefined
          ? { maxTravelMinutes: dto.maxTravelMinutes }
          : {}),
        ...(dto.timezone !== undefined
          ? { timezone: dto.timezone?.trim() || 'Asia/Shanghai' }
          : {}),
        ...(dto.agreementAcceptedAt !== undefined
          ? {
              agreementAcceptedAt: dto.agreementAcceptedAt
                ? new Date(dto.agreementAcceptedAt)
                : null,
            }
          : {}),
        ...(dto.agreementVersion !== undefined
          ? { agreementVersion: dto.agreementVersion?.trim() || null }
          : {}),
        ...(dto.onboardingCompleted !== undefined
          ? {
              onboardingCompletedAt: dto.onboardingCompleted
                ? new Date()
                : null,
            }
          : {}),
      },
    });

    return this.issueAuthResponse(userId, PlatformRole.TEACHER);
  }

  async updateSelfGuardianProfile(
    userId: string,
    dto: {
      displayName?: string;
      phone?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      defaultServiceAddressId?: string;
      onboardingCompleted?: boolean;
    },
  ) {
    const guardian = await (this.prisma as any).guardianProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    if (dto.defaultServiceAddressId) {
      const address = await (this.prisma as any).address.findUnique({
        where: { id: dto.defaultServiceAddressId },
        select: { id: true, userId: true },
      });

      if (!address || address.userId !== userId) {
        throw new BadRequestException(
          'defaultServiceAddressId must belong to the current user',
        );
      }
    }

    await (this.prisma as any).guardianProfile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: sanitizeDisplayName(dto.displayName, '新家长') }
          : {}),
        ...(dto.phone !== undefined
          ? {
              phone: dto.phone?.trim() ? normalizePhone(dto.phone) : null,
            }
          : {}),
        ...(dto.emergencyContactName !== undefined
          ? {
              emergencyContactName: dto.emergencyContactName?.trim() || null,
            }
          : {}),
        ...(dto.emergencyContactPhone !== undefined
          ? {
              emergencyContactPhone: dto.emergencyContactPhone?.trim()
                ? normalizePhone(dto.emergencyContactPhone)
                : null,
            }
          : {}),
        ...(dto.defaultServiceAddressId !== undefined
          ? { defaultServiceAddressId: dto.defaultServiceAddressId || null }
          : {}),
        ...(dto.onboardingCompleted !== undefined
          ? {
              onboardingCompletedAt: dto.onboardingCompleted ? new Date() : null,
            }
          : {}),
      },
    });

    return this.issueAuthResponse(userId, PlatformRole.GUARDIAN);
  }

  async updateSelfStudentProfile(
    userId: string,
    dto: {
      displayName?: string;
      gradeLevel?: unknown;
      dateOfBirth?: string;
      schoolName?: string;
      learningGoals?: string;
      specialNeeds?: string;
      timezone?: string;
      onboardingCompleted?: boolean;
    },
  ) {
    const student = await (this.prisma as any).studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    await (this.prisma as any).studentProfile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: sanitizeDisplayName(dto.displayName, '新学生') }
          : {}),
        ...(dto.gradeLevel !== undefined
          ? { gradeLevel: dto.gradeLevel as never }
          : {}),
        ...(dto.dateOfBirth !== undefined
          ? {
              dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            }
          : {}),
        ...(dto.schoolName !== undefined
          ? { schoolName: dto.schoolName?.trim() || null }
          : {}),
        ...(dto.learningGoals !== undefined
          ? { learningGoals: dto.learningGoals?.trim() || null }
          : {}),
        ...(dto.specialNeeds !== undefined
          ? { specialNeeds: dto.specialNeeds?.trim() || null }
          : {}),
        ...(dto.timezone !== undefined
          ? { timezone: dto.timezone?.trim() || 'Asia/Shanghai' }
          : {}),
        ...(dto.onboardingCompleted !== undefined
          ? {
              onboardingCompletedAt: dto.onboardingCompleted ? new Date() : null,
            }
          : {}),
      },
    });

    return this.issueAuthResponse(userId, PlatformRole.STUDENT);
  }

  async updateSelfTeacherOnboarding(
    userId: string,
    dto: {
      displayName?: string;
      bio?: string;
      employmentType?: TeacherEmploymentType;
      baseHourlyRate?: number;
      serviceRadiusKm?: number;
      acceptTrial?: boolean;
      maxTravelMinutes?: number;
      timezone?: string;
      agreementAcceptedAt?: string;
      agreementVersion?: string;
      onboardingCompleted?: boolean;
      subjects?: Array<{
        subjectId: string;
        hourlyRate: number;
        trialRate?: number;
        experienceYears?: number;
      }>;
      serviceAreas?: Array<{
        province: string;
        city: string;
        district: string;
        radiusKm?: number;
      }>;
    },
  ) {
    const teacher = await (this.prisma as any).teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.teacherProfile.update({
        where: { userId },
        data: {
          ...(dto.displayName !== undefined
            ? { displayName: sanitizeDisplayName(dto.displayName, '新老师') }
            : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
          ...(dto.employmentType !== undefined
            ? { employmentType: dto.employmentType as never }
            : {}),
          ...(dto.baseHourlyRate !== undefined
            ? { baseHourlyRate: dto.baseHourlyRate }
            : {}),
          ...(dto.serviceRadiusKm !== undefined
            ? { serviceRadiusKm: dto.serviceRadiusKm }
            : {}),
          ...(dto.acceptTrial !== undefined
            ? { acceptTrial: dto.acceptTrial }
            : {}),
          ...(dto.maxTravelMinutes !== undefined
            ? { maxTravelMinutes: dto.maxTravelMinutes }
            : {}),
          ...(dto.timezone !== undefined
            ? { timezone: dto.timezone?.trim() || 'Asia/Shanghai' }
            : {}),
          ...(dto.agreementAcceptedAt !== undefined
            ? {
                agreementAcceptedAt: dto.agreementAcceptedAt
                  ? new Date(dto.agreementAcceptedAt)
                  : null,
              }
            : {}),
          ...(dto.agreementVersion !== undefined
            ? { agreementVersion: dto.agreementVersion?.trim() || null }
            : {}),
          ...(dto.onboardingCompleted !== undefined
            ? {
                onboardingCompletedAt: dto.onboardingCompleted ? new Date() : null,
              }
            : {}),
        },
      });

      if (dto.subjects) {
        await tx.teacherSubject.deleteMany({
          where: { teacherProfileId: teacher.id },
        });
        if (dto.subjects.length) {
          await tx.teacherSubject.createMany({
            data: dto.subjects.map((item) => ({
              teacherProfileId: teacher.id,
              subjectId: item.subjectId,
              hourlyRate: item.hourlyRate,
              trialRate: item.trialRate ?? null,
              experienceYears: item.experienceYears ?? 0,
              isActive: true,
            })),
          });
        }
      }

      if (dto.serviceAreas) {
        await tx.teacherServiceArea.deleteMany({
          where: { teacherProfileId: teacher.id },
        });
        if (dto.serviceAreas.length) {
          await tx.teacherServiceArea.createMany({
            data: dto.serviceAreas.map((item) => ({
              teacherProfileId: teacher.id,
              province: item.province.trim(),
              city: item.city.trim(),
              district: item.district.trim(),
              radiusKm: item.radiusKm ?? dto.serviceRadiusKm ?? 10,
            })),
          });
        }
      }
    });

    return this.issueAuthResponse(userId, PlatformRole.TEACHER);
  }

  async updateSelfGuardianOnboarding(
    userId: string,
    dto: {
      displayName?: string;
      phone?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      onboardingCompleted?: boolean;
      student?: {
        id?: string;
        displayName: string;
        gradeLevel: unknown;
        dateOfBirth?: string;
        schoolName?: string;
        learningGoals?: string;
        specialNeeds?: string;
      };
      defaultServiceAddress?: {
        id?: string;
        label?: string;
        contactName: string;
        contactPhone: string;
        country?: string;
        province: string;
        city: string;
        district: string;
        street: string;
        building?: string;
      };
    },
  ) {
    const guardian = await (this.prisma as any).guardianProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        defaultServiceAddressId: true,
      },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    await (this.prisma as any).$transaction(async (tx: any) => {
      let defaultServiceAddressId = guardian.defaultServiceAddressId ?? null;

      if (dto.defaultServiceAddress) {
        if (dto.defaultServiceAddress.id) {
          const currentAddress = await tx.address.findUnique({
            where: { id: dto.defaultServiceAddress.id },
            select: { id: true, userId: true },
          });
          if (!currentAddress || currentAddress.userId !== userId) {
            throw new BadRequestException('defaultServiceAddress is invalid');
          }

          await tx.address.update({
            where: { id: dto.defaultServiceAddress.id },
            data: {
              label: dto.defaultServiceAddress.label?.trim() || null,
              contactName: dto.defaultServiceAddress.contactName.trim(),
              contactPhone: normalizePhone(dto.defaultServiceAddress.contactPhone),
              country: dto.defaultServiceAddress.country?.trim() || 'CN',
              province: dto.defaultServiceAddress.province.trim(),
              city: dto.defaultServiceAddress.city.trim(),
              district: dto.defaultServiceAddress.district.trim(),
              street: dto.defaultServiceAddress.street.trim(),
              building: dto.defaultServiceAddress.building?.trim() || null,
              isDefault: true,
            },
          });
          defaultServiceAddressId = dto.defaultServiceAddress.id;
        } else {
          const createdAddress = await tx.address.create({
            data: {
              userId,
              label: dto.defaultServiceAddress.label?.trim() || '上课地址',
              contactName: dto.defaultServiceAddress.contactName.trim(),
              contactPhone: normalizePhone(dto.defaultServiceAddress.contactPhone),
              country: dto.defaultServiceAddress.country?.trim() || 'CN',
              province: dto.defaultServiceAddress.province.trim(),
              city: dto.defaultServiceAddress.city.trim(),
              district: dto.defaultServiceAddress.district.trim(),
              street: dto.defaultServiceAddress.street.trim(),
              building: dto.defaultServiceAddress.building?.trim() || null,
              isDefault: true,
            },
          });
          defaultServiceAddressId = createdAddress.id;
        }

        await tx.address.updateMany({
          where: {
            userId,
            NOT: { id: defaultServiceAddressId },
          },
          data: { isDefault: false },
        });
      }

      if (dto.student) {
        let studentProfileId = dto.student.id ?? null;
        if (studentProfileId) {
          const relation = await tx.studentGuardian.findFirst({
            where: {
              guardianProfileId: guardian.id,
              studentProfileId,
            },
            select: { id: true },
          });

          if (!relation) {
            throw new BadRequestException(
              'student does not belong to current guardian',
            );
          }
        } else {
          const existingPrimary = await tx.studentGuardian.findFirst({
            where: { guardianProfileId: guardian.id },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            select: { studentProfileId: true },
          });
          studentProfileId = existingPrimary?.studentProfileId ?? null;
        }

        if (studentProfileId) {
          await tx.studentProfile.update({
            where: { id: studentProfileId },
            data: {
              displayName: sanitizeDisplayName(dto.student.displayName, '孩子'),
              gradeLevel: dto.student.gradeLevel as never,
              dateOfBirth: dto.student.dateOfBirth
                ? new Date(dto.student.dateOfBirth)
                : null,
              schoolName: dto.student.schoolName?.trim() || null,
              learningGoals: dto.student.learningGoals?.trim() || null,
              specialNeeds: dto.student.specialNeeds?.trim() || null,
            },
          });
        } else {
          const createdStudent = await tx.studentProfile.create({
            data: {
              displayName: sanitizeDisplayName(dto.student.displayName, '孩子'),
              gradeLevel: dto.student.gradeLevel as never,
              dateOfBirth: dto.student.dateOfBirth
                ? new Date(dto.student.dateOfBirth)
                : null,
              schoolName: dto.student.schoolName?.trim() || null,
              learningGoals: dto.student.learningGoals?.trim() || null,
              specialNeeds: dto.student.specialNeeds?.trim() || null,
            },
            select: { id: true },
          });
          studentProfileId = createdStudent.id;

          await tx.studentGuardian.create({
            data: {
              guardianProfileId: guardian.id,
              studentProfileId,
              relation: GuardianRelation.OTHER,
              isPrimary: true,
              canBook: true,
              canViewRecords: true,
            },
          });
        }
      }

      await tx.guardianProfile.update({
        where: { userId },
        data: {
          ...(dto.displayName !== undefined
            ? { displayName: sanitizeDisplayName(dto.displayName, '新家长') }
            : {}),
          ...(dto.phone !== undefined
            ? {
                phone: dto.phone?.trim() ? normalizePhone(dto.phone) : null,
              }
            : {}),
          ...(dto.emergencyContactName !== undefined
            ? {
                emergencyContactName: dto.emergencyContactName?.trim() || null,
              }
            : {}),
          ...(dto.emergencyContactPhone !== undefined
            ? {
                emergencyContactPhone: dto.emergencyContactPhone?.trim()
                  ? normalizePhone(dto.emergencyContactPhone)
                  : null,
              }
            : {}),
          ...(dto.defaultServiceAddress !== undefined
            ? { defaultServiceAddressId }
            : {}),
          ...(dto.onboardingCompleted !== undefined
            ? {
                onboardingCompletedAt: dto.onboardingCompleted ? new Date() : null,
              }
            : {}),
        },
      });
    });

    return this.issueAuthResponse(userId, PlatformRole.GUARDIAN);
  }

  async updateSelfStudentOnboarding(
    userId: string,
    dto: {
      displayName?: string;
      gradeLevel?: unknown;
      dateOfBirth?: string;
      schoolName?: string;
      learningGoals?: string;
      specialNeeds?: string;
      timezone?: string;
      onboardingCompleted?: boolean;
    },
  ) {
    return this.updateSelfStudentProfile(userId, dto);
  }
}
