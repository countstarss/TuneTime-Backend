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

export type AuthTeacherProfileSnapshot = {
  displayName: string | null;
  bio: string | null;
  employmentType: string | null;
  baseHourlyRate: number | null;
  serviceRadiusKm: number | null;
  acceptTrial: boolean | null;
  maxTravelMinutes: number | null;
  timezone: string | null;
  agreementAcceptedAt: Date | null;
  agreementVersion: string | null;
};

export type AuthGuardianProfileSnapshot = {
  displayName: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  defaultServiceAddressId: string | null;
};

export type AuthStudentProfileSnapshot = {
  displayName: string | null;
  gradeLevel: string | null;
  dateOfBirth: Date | null;
  schoolName: string | null;
  learningGoals: string | null;
  specialNeeds: string | null;
  timezone: string | null;
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
  teacherProfile: AuthTeacherProfileSnapshot | null;
  guardianProfile: AuthGuardianProfileSnapshot | null;
  studentProfile: AuthStudentProfileSnapshot | null;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUserProfile;
};
