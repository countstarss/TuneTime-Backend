import {
  PlatformRole,
  TeacherVerificationStatus,
  UserStatus,
} from '@prisma/client';
import type { JWTPayload } from 'jose';

export type LoginMethod = 'EMAIL_PASSWORD' | 'SMS' | 'WECHAT_APP';

export type AuthenticatedUserContext = {
  userId: string;
  roles: PlatformRole[];
  activeRole: PlatformRole | null;
  status: UserStatus;
  tokenPayload: JWTPayload;
};

export type AuthProfileIds = {
  teacherProfileId: string | null;
  guardianProfileId: string | null;
  studentProfileId: string | null;
};

export type AuthOnboardingState = {
  teacher: {
    profileExists: boolean;
    onboardingCompleted: boolean;
    completionPercent: number;
    missingRequiredItems: string[];
    missingOptionalItems: string[];
    realNameVerified: boolean;
    verificationStatus: TeacherVerificationStatus | null;
    canAcceptBookings: boolean;
  };
  guardian: {
    profileExists: boolean;
    onboardingCompleted: boolean;
    completionPercent: number;
    phoneVerified: boolean;
    realNameVerified: boolean;
    hasLinkedStudent: boolean;
    hasDefaultAddress: boolean;
    missingRequiredItems: string[];
    missingOptionalItems: string[];
    canBookLessons: boolean;
  };
  student: {
    profileExists: boolean;
    onboardingCompleted: boolean;
    completionPercent: number;
    phoneVerified: boolean;
    realNameVerified: boolean;
    missingRequiredItems: string[];
    missingOptionalItems: string[];
    canBookLessons: boolean;
  };
};

export type AuthUserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  realNameVerified: boolean;
  realNameVerifiedAt: Date | null;
  roles: PlatformRole[];
  availableRoles: PlatformRole[];
  primaryRole: PlatformRole | null;
  activeRole: PlatformRole | null;
  loginMethods: LoginMethod[];
  profileIds: AuthProfileIds;
  onboardingState: AuthOnboardingState;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUserProfile;
};
