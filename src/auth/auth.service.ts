import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordAuthService: PasswordAuthService,
    private readonly smsAuthService: SmsAuthService,
    private readonly wechatAuthService: WechatAuthService,
    private readonly profileBootstrapService: ProfileBootstrapService,
  ) {}

  private async getProfileProjection(userId: string) {
    return this.prisma.user.findUnique({
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
            verificationStatus: true,
            onboardingCompletedAt: true,
          },
        },
        guardianProfile: {
          select: {
            id: true,
          },
        },
        studentProfile: {
          select: {
            id: true,
          },
        },
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { role: true, isPrimary: true },
        },
      },
    });
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

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.image,
      hasPassword: !!user.passwordCredential,
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
          verificationStatus: user.teacherProfile?.verificationStatus ?? null,
          canAcceptBookings:
            !!user.teacherProfile?.onboardingCompletedAt &&
            user.teacherProfile?.verificationStatus ===
              TeacherVerificationStatus.APPROVED,
        },
        guardian: {
          profileExists: !!user.guardianProfile,
          phoneVerified: !!user.phoneVerifiedAt,
        },
        student: {
          profileExists: !!user.studentProfile,
          phoneVerified: !!user.phoneVerifiedAt,
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
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    await this.prisma.teacherProfile.update({
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
    },
  ) {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    if (dto.defaultServiceAddressId) {
      const address = await this.prisma.address.findUnique({
        where: { id: dto.defaultServiceAddressId },
        select: { id: true, userId: true },
      });

      if (!address || address.userId !== userId) {
        throw new BadRequestException(
          'defaultServiceAddressId must belong to the current user',
        );
      }
    }

    await this.prisma.guardianProfile.update({
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
    },
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    await this.prisma.studentProfile.update({
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
      },
    });

    return this.issueAuthResponse(userId, PlatformRole.STUDENT);
  }
}
