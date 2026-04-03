import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PlatformRole,
  TeacherEmploymentType,
  TeacherVerificationStatus,
  GradeLevel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class EmailRegisterDto {
  @ApiPropertyOptional({ description: '用户昵称。', example: '王女士' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @ApiProperty({ description: '邮箱地址。', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '密码。', example: 'TuneTime123!' })
  @IsString()
  password!: string;

  @ApiProperty({
    description: '本次注册的身份。',
    enum: [PlatformRole.TEACHER, PlatformRole.GUARDIAN, PlatformRole.STUDENT],
    example: PlatformRole.GUARDIAN,
  })
  @IsEnum(PlatformRole)
  requestedRole!: PlatformRole;
}

export class EmailLoginDto {
  @ApiProperty({ description: '邮箱地址。', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '密码。', example: 'TuneTime123!' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    description: '希望切换到的身份。',
    enum: [PlatformRole.TEACHER, PlatformRole.GUARDIAN, PlatformRole.STUDENT],
    example: PlatformRole.TEACHER,
  })
  @IsOptional()
  @IsEnum(PlatformRole)
  requestedRole?: PlatformRole;
}

export class PhonePasswordLoginDto {
  @ApiProperty({ description: '手机号。', example: '13800138000' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '密码。', example: 'TuneTime123!' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    description: '希望切换到的身份。',
    enum: [PlatformRole.TEACHER, PlatformRole.GUARDIAN, PlatformRole.STUDENT],
    example: PlatformRole.TEACHER,
  })
  @IsOptional()
  @IsEnum(PlatformRole)
  requestedRole?: PlatformRole;
}

export class SmsRequestCodeDto {
  @ApiProperty({ description: '手机号。', example: '13800138000' })
  @IsString()
  phone!: string;
}

export class SmsVerifyDto {
  @ApiProperty({ description: '手机号。', example: '13800138000' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '验证码。', example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional({
    description: '首次登录或补充身份时希望进入的身份。',
    enum: [PlatformRole.TEACHER, PlatformRole.GUARDIAN, PlatformRole.STUDENT],
    example: PlatformRole.GUARDIAN,
  })
  @IsOptional()
  @IsEnum(PlatformRole)
  requestedRole?: PlatformRole;

  @ApiPropertyOptional({ description: '昵称。', example: '王女士' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}

export class WechatAppLoginDto {
  @ApiProperty({ description: '微信 App 授权 code。' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({
    description: '首次登录或补充身份时希望进入的身份。',
    enum: [PlatformRole.TEACHER, PlatformRole.GUARDIAN, PlatformRole.STUDENT],
    example: PlatformRole.TEACHER,
  })
  @IsOptional()
  @IsEnum(PlatformRole)
  requestedRole?: PlatformRole;
}

export class WechatMiniappLoginDto {
  @ApiProperty({ description: '微信小程序登录 code。' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({
    description: '首次登录时希望进入的身份。',
    enum: [PlatformRole.TEACHER, PlatformRole.GUARDIAN, PlatformRole.STUDENT],
    example: PlatformRole.GUARDIAN,
  })
  @IsOptional()
  @IsEnum(PlatformRole)
  requestedRole?: PlatformRole;
}

export class RoleSwitchDto {
  @ApiProperty({ description: '切换到的身份。', enum: PlatformRole })
  @IsEnum(PlatformRole)
  role!: PlatformRole;
}

export class BindPhoneRequestDto {
  @ApiProperty({ description: '待绑定手机号。', example: '13800138000' })
  @IsString()
  phone!: string;
}

export class BindPhoneConfirmDto {
  @ApiProperty({ description: '待绑定手机号。', example: '13800138000' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '验证码。', example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;
}

export class BindEmailPasswordDto {
  @ApiProperty({ description: '待绑定邮箱。', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '待设置密码。', example: 'TuneTime123!' })
  @IsString()
  password!: string;
}

export class ResetPasswordWithSmsDto {
  @ApiProperty({ description: '验证码。', example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiProperty({ description: '新密码。', example: 'TuneTime123!' })
  @IsString()
  password!: string;
}

export class AuthProfileIdsDto {
  @ApiPropertyOptional({ nullable: true })
  teacherProfileId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  guardianProfileId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  studentProfileId!: string | null;
}

export class AuthTeacherProfileSnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiPropertyOptional({ nullable: true, enum: TeacherEmploymentType })
  employmentType!: TeacherEmploymentType | null;

  @ApiPropertyOptional({ nullable: true })
  baseHourlyRate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  serviceRadiusKm!: number | null;

  @ApiPropertyOptional({ nullable: true })
  acceptTrial!: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  maxTravelMinutes!: number | null;

  @ApiPropertyOptional({ nullable: true })
  timezone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  agreementAcceptedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  agreementVersion!: string | null;
}

export class AuthGuardianProfileSnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  defaultServiceAddressId!: string | null;
}

export class AuthStudentProfileSnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ nullable: true, enum: GradeLevel })
  gradeLevel!: GradeLevel | null;

  @ApiPropertyOptional({ nullable: true })
  dateOfBirth!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  schoolName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  learningGoals!: string | null;

  @ApiPropertyOptional({ nullable: true })
  specialNeeds!: string | null;

  @ApiPropertyOptional({ nullable: true })
  timezone!: string | null;
}

export class TeacherOnboardingStateDto {
  @ApiProperty()
  profileExists!: boolean;

  @ApiProperty()
  onboardingCompleted!: boolean;

  @ApiProperty()
  completionPercent!: number;

  @ApiProperty({ type: String, isArray: true })
  missingRequiredItems!: string[];

  @ApiProperty({ type: String, isArray: true })
  missingOptionalItems!: string[];

  @ApiProperty()
  realNameVerified!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    enum: TeacherVerificationStatus,
  })
  verificationStatus!: TeacherVerificationStatus | null;

  @ApiProperty()
  canAcceptBookings!: boolean;
}

export class ConsumerOnboardingStateDto {
  @ApiProperty()
  profileExists!: boolean;

  @ApiProperty()
  onboardingCompleted!: boolean;

  @ApiProperty()
  completionPercent!: number;

  @ApiProperty()
  phoneVerified!: boolean;

  @ApiProperty()
  realNameVerified!: boolean;

  @ApiProperty({ type: String, isArray: true })
  missingRequiredItems!: string[];

  @ApiProperty({ type: String, isArray: true })
  missingOptionalItems!: string[];

  @ApiProperty()
  canBookLessons!: boolean;
}

export class GuardianOnboardingStateDto extends ConsumerOnboardingStateDto {
  @ApiProperty()
  hasLinkedStudent!: boolean;

  @ApiProperty()
  hasDefaultAddress!: boolean;
}

export class AuthOnboardingStateDto {
  @ApiProperty({ type: TeacherOnboardingStateDto })
  teacher!: TeacherOnboardingStateDto;

  @ApiProperty({ type: GuardianOnboardingStateDto })
  guardian!: GuardianOnboardingStateDto;

  @ApiProperty({ type: ConsumerOnboardingStateDto })
  student!: ConsumerOnboardingStateDto;
}

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiProperty()
  realNameVerified!: boolean;

  @ApiPropertyOptional({ nullable: true })
  realNameVerifiedAt!: Date | null;

  @ApiProperty({ enum: PlatformRole, isArray: true })
  roles!: PlatformRole[];

  @ApiProperty({ enum: PlatformRole, isArray: true })
  availableRoles!: PlatformRole[];

  @ApiPropertyOptional({ nullable: true, enum: PlatformRole })
  primaryRole!: PlatformRole | null;

  @ApiPropertyOptional({ nullable: true, enum: PlatformRole })
  activeRole!: PlatformRole | null;

  @ApiProperty({
    isArray: true,
    enum: ['EMAIL_PASSWORD', 'SMS', 'WECHAT_APP', 'WECHAT_MINIAPP'],
  })
  loginMethods!: string[];

  @ApiProperty({ type: AuthProfileIdsDto })
  profileIds!: AuthProfileIdsDto;

  @ApiProperty({ type: AuthOnboardingStateDto })
  onboardingState!: AuthOnboardingStateDto;

  @ApiPropertyOptional({
    type: AuthTeacherProfileSnapshotDto,
    nullable: true,
  })
  teacherProfile!: AuthTeacherProfileSnapshotDto | null;

  @ApiPropertyOptional({
    type: AuthGuardianProfileSnapshotDto,
    nullable: true,
  })
  guardianProfile!: AuthGuardianProfileSnapshotDto | null;

  @ApiPropertyOptional({
    type: AuthStudentProfileSnapshotDto,
    nullable: true,
  })
  studentProfile!: AuthStudentProfileSnapshotDto | null;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class SelfBookingContextStudentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  gradeLevel!: string | null;
}

export class SelfBookingContextAddressDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  label!: string | null;

  @ApiProperty()
  contactName!: string;

  @ApiProperty()
  contactPhone!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  district!: string;

  @ApiProperty()
  street!: string;

  @ApiPropertyOptional({ nullable: true })
  building!: string | null;

  @ApiProperty()
  isDefault!: boolean;
}

export class SelfBookingContextDto {
  @ApiPropertyOptional({ nullable: true })
  guardianProfileId!: string | null;

  @ApiProperty({
    type: SelfBookingContextStudentDto,
    isArray: true,
  })
  students!: SelfBookingContextStudentDto[];

  @ApiProperty({
    type: SelfBookingContextAddressDto,
    isArray: true,
  })
  addresses!: SelfBookingContextAddressDto[];
}

export class AuthCodeDispatchResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  expiresInSeconds!: number;

  @ApiProperty()
  cooldownSeconds!: number;
}

export class SelfTeacherProfileUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ enum: TeacherEmploymentType, nullable: true })
  @IsOptional()
  @IsEnum(TeacherEmploymentType)
  employmentType?: TeacherEmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseHourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceRadiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptTrial?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxTravelMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  agreementAcceptedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agreementVersion?: string;

  @ApiPropertyOptional({
    description: '是否标记老师 onboarding 已完成。',
  })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

export class TeacherOnboardingSubjectDto {
  @ApiProperty()
  @IsString()
  @Length(8, 36)
  subjectId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRate!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  trialRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  experienceYears?: number;
}

export class TeacherOnboardingServiceAreaDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  province!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  city!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  district!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number;
}

export class SelfTeacherOnboardingUpdateDto extends SelfTeacherProfileUpdateDto {
  @ApiPropertyOptional({
    type: TeacherOnboardingSubjectDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherOnboardingSubjectDto)
  subjects?: TeacherOnboardingSubjectDto[];

  @ApiPropertyOptional({
    type: TeacherOnboardingServiceAreaDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherOnboardingServiceAreaDto)
  serviceAreas?: TeacherOnboardingServiceAreaDto[];
}

export class SelfGuardianProfileUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 36)
  defaultServiceAddressId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

export class GuardianOnboardingStudentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 36)
  id?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  displayName!: string;

  @ApiProperty({ enum: GradeLevel })
  @IsEnum(GradeLevel)
  gradeLevel!: GradeLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  schoolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  learningGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialNeeds?: string;
}

export class GuardianOnboardingAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 36)
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  contactName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  contactPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  province!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  city!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  district!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  street!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  building?: string;
}

export class SelfGuardianOnboardingUpdateDto extends SelfGuardianProfileUpdateDto {
  @ApiPropertyOptional({ type: GuardianOnboardingStudentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianOnboardingStudentDto)
  student?: GuardianOnboardingStudentDto;

  @ApiPropertyOptional({ type: GuardianOnboardingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianOnboardingAddressDto)
  defaultServiceAddress?: GuardianOnboardingAddressDto;
}

export class SelfGuardianStudentCreateDto extends GuardianOnboardingStudentDto {}

export class SelfGuardianStudentUpdateDto extends PartialType(
  SelfGuardianStudentCreateDto,
) {}

export class SelfGuardianAddressCreateDto extends GuardianOnboardingAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SelfGuardianAddressUpdateDto extends PartialType(
  SelfGuardianAddressCreateDto,
) {}

export class SelfStudentProfileUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional({ enum: GradeLevel, nullable: true })
  @IsOptional()
  @IsEnum(GradeLevel)
  gradeLevel?: GradeLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  schoolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  learningGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialNeeds?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

export class SelfStudentOnboardingUpdateDto extends SelfStudentProfileUpdateDto {}

export class RealNameVerificationSessionRequestDto {
  @ApiPropertyOptional({
    description: '实名核身完成后的回跳地址。',
    example: 'tunetime://real-name/callback',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  redirectUrl?: string;
}

export class RealNameVerificationSessionDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  startUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  mockMode!: boolean;
}

export class CompleteMockRealNameVerificationDto {
  @ApiProperty()
  @IsString()
  @Length(8, 36)
  sessionId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  idNumber!: string;
}
