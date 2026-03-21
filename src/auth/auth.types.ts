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
    verificationStatus: TeacherVerificationStatus | null;
    canAcceptBookings: boolean;
  };
  guardian: {
    profileExists: boolean;
    phoneVerified: boolean;
  };
  student: {
    profileExists: boolean;
    phoneVerified: boolean;
  };
};

export type AuthUserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
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
