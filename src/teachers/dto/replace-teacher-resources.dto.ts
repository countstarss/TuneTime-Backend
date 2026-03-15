import { ApiProperty } from '@nestjs/swagger';
import {
  CredentialType,
  DocumentReviewStatus,
  Weekday,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TeacherSubjectInputDto {
  @ApiProperty({ description: '科目 ID。', example: 'cmc123subject001' })
  @IsString()
  @Length(8, 36)
  subjectId!: string;

  @ApiProperty({ description: '标准课时费。', example: 180 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRate!: number;

  @ApiProperty({ description: '试听价。', example: 99, required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  trialRate?: number | null;

  @ApiProperty({ description: '教学年限。', example: 5, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experienceYears = 0;

  @ApiProperty({ description: '是否启用该科目。', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReplaceTeacherSubjectsDto {
  @ApiProperty({
    description: '新的老师科目列表，会整体替换原有配置。',
    type: TeacherSubjectInputDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherSubjectInputDto)
  items!: TeacherSubjectInputDto[];
}

export class TeacherServiceAreaInputDto {
  @ApiProperty({ description: '省份。', example: '天津市' })
  @IsString()
  @MaxLength(64)
  province!: string;

  @ApiProperty({ description: '城市。', example: '天津市' })
  @IsString()
  @MaxLength(64)
  city!: string;

  @ApiProperty({ description: '区县。', example: '南开区' })
  @IsString()
  @MaxLength(64)
  district!: string;

  @ApiProperty({ description: '服务半径，单位公里。', example: 8, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  radiusKm = 10;
}

export class ReplaceTeacherServiceAreasDto {
  @ApiProperty({
    description: '新的服务区域列表，会整体替换原有配置。',
    type: TeacherServiceAreaInputDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherServiceAreaInputDto)
  items!: TeacherServiceAreaInputDto[];
}

export class TeacherAvailabilityRuleInputDto {
  @ApiProperty({ description: '星期。', enum: Weekday, example: Weekday.SATURDAY })
  @IsEnum(Weekday)
  weekday!: Weekday;

  @ApiProperty({ description: '开始分钟，按 0-1440 计。', example: 540 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startMinute!: number;

  @ApiProperty({ description: '结束分钟，按 0-1440 计。', example: 720 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  endMinute!: number;

  @ApiProperty({ description: '单个时间段时长，单位分钟。', example: 60, default: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slotDurationMinutes = 60;

  @ApiProperty({ description: '缓冲时间，单位分钟。', example: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferMinutes = 0;

  @ApiProperty({ description: '是否启用。', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: '规则生效起始日期。',
    example: '2026-03-15',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  effectiveFrom?: string | null;

  @ApiProperty({
    description: '规则生效结束日期。',
    example: '2026-12-31',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  effectiveTo?: string | null;
}

export class ReplaceTeacherAvailabilityRulesDto {
  @ApiProperty({
    description: '新的可预约规则列表，会整体替换原有配置。',
    type: TeacherAvailabilityRuleInputDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherAvailabilityRuleInputDto)
  items!: TeacherAvailabilityRuleInputDto[];
}

export class TeacherCredentialInputDto {
  @ApiProperty({ description: '资质类型。', enum: CredentialType, example: CredentialType.TEACHING_LICENSE })
  @IsEnum(CredentialType)
  credentialType!: CredentialType;

  @ApiProperty({ description: '资质名称。', example: '钢琴教师资格证' })
  @IsString()
  @MaxLength(128)
  name!: string;

  @ApiProperty({ description: '文件 URL。', example: 'https://example.com/license.pdf' })
  @IsString()
  @MaxLength(1000)
  fileUrl!: string;

  @ApiProperty({ description: '签发机构。', example: '中国音乐学院', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  issuedBy?: string | null;

  @ApiProperty({ description: '签发日期。', example: '2024-01-01', required: false, nullable: true })
  @IsOptional()
  @IsString()
  issuedAt?: string | null;

  @ApiProperty({ description: '过期日期。', example: '2030-01-01', required: false, nullable: true })
  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @ApiProperty({
    description: '审核状态。',
    enum: DocumentReviewStatus,
    example: DocumentReviewStatus.PENDING,
    default: DocumentReviewStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(DocumentReviewStatus)
  reviewStatus?: DocumentReviewStatus;

  @ApiProperty({ description: '审核备注。', example: '待补充清晰扫描件', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string | null;
}

export class ReplaceTeacherCredentialsDto {
  @ApiProperty({
    description: '新的资质材料列表，会整体替换原有配置。',
    type: TeacherCredentialInputDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherCredentialInputDto)
  items!: TeacherCredentialInputDto[];
}
