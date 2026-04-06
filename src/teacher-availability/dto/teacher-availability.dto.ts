import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Weekday } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AvailabilityWindowDto {
  @ApiProperty({ example: '2026-03-24T10:00:00.000Z' })
  startAt!: Date;

  @ApiProperty({ example: '2026-03-24T11:00:00.000Z' })
  endAt!: Date;

  @ApiProperty({ example: 'Asia/Shanghai' })
  timezone!: string;

  @ApiProperty({ example: 'TUESDAY' })
  weekday!: string;

  @ApiProperty({ example: 60 })
  durationMinutes!: number;
}

export class AvailabilityWindowsResponseDto {
  @ApiProperty({ example: 'teacher_001' })
  teacherProfileId!: string;

  @ApiProperty({ type: AvailabilityWindowDto, isArray: true })
  windows!: AvailabilityWindowDto[];
}

export class AvailabilityWindowQueryDto {
  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-04-06T23:59:59.999Z' })
  @IsDateString()
  to!: string;
}

export class SearchTeacherAvailabilityDto {
  @ApiProperty({
    description: '目标开始时间。',
    example: '2026-03-24T10:00:00.000Z',
  })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    description: '科目关键字，可匹配科目名 / 编码 / ID。',
    example: '钢琴',
  })
  @IsString()
  @MaxLength(64)
  subject!: string;

  @ApiPropertyOptional({
    description: '课时长度，分钟。',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  durationMinutes = 60;
}

export class SearchAvailabilityTeacherDto {
  @ApiProperty({ example: 'teacher_001' })
  id!: string;

  @ApiProperty({ example: 'user_teacher_001' })
  userId!: string;

  @ApiProperty({ example: '李老师' })
  displayName!: string;

  @ApiPropertyOptional({ example: '10 年钢琴启蒙经验。', nullable: true })
  bio!: string | null;

  @ApiProperty({ example: 200 })
  baseHourlyRate!: number;

  @ApiPropertyOptional({ example: '南开区', nullable: true })
  district!: string | null;

  @ApiProperty({ example: 4.8 })
  ratingAvg!: number;

  @ApiProperty({ example: 12 })
  ratingCount!: number;

  @ApiProperty({ example: 5 })
  experienceYears!: number;

  @ApiProperty({ example: 'APPROVED' })
  verificationStatus!: string;

  @ApiProperty({ example: 'PART_TIME' })
  employmentType!: string;

  @ApiProperty({ example: '2026-03-15T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-21T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, isArray: true, example: ['钢琴', '乐理'] })
  subjects!: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['subject_piano', 'subject_theory'],
  })
  subjectIds!: string[];

  @ApiPropertyOptional({ example: 'subject_piano', nullable: true })
  primarySubjectId!: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['教师资格证'] })
  credentials!: string[];

  @ApiProperty({ type: AvailabilityWindowDto, isArray: true })
  matchingWindows!: AvailabilityWindowDto[];
}

export class SearchTeacherAvailabilityResponseDto {
  @ApiProperty({ type: SearchAvailabilityTeacherDto, isArray: true })
  items!: SearchAvailabilityTeacherDto[];
}

export class DiscoverTeachersQueryDto {
  @ApiPropertyOptional({
    description: '起始时间，默认当前时间。',
    example: '2026-03-24T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: '结束时间，默认起始时间后 14 天。',
    example: '2026-04-06T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: '每位老师返回的预览可约时段数量。',
    example: 3,
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  windowLimit = 3;
}

export class DiscoverTeacherDto {
  @ApiProperty({ example: 'teacher_001' })
  id!: string;

  @ApiProperty({ example: 'user_teacher_001' })
  userId!: string;

  @ApiProperty({ example: '李老师' })
  displayName!: string;

  @ApiPropertyOptional({ example: '10 年钢琴启蒙经验。', nullable: true })
  bio!: string | null;

  @ApiProperty({ example: 200 })
  baseHourlyRate!: number;

  @ApiPropertyOptional({ example: '南开区', nullable: true })
  district!: string | null;

  @ApiProperty({ example: 4.8 })
  ratingAvg!: number;

  @ApiProperty({ example: 12 })
  ratingCount!: number;

  @ApiProperty({ example: 5 })
  experienceYears!: number;

  @ApiProperty({ example: 'APPROVED' })
  verificationStatus!: string;

  @ApiProperty({ example: 'PART_TIME' })
  employmentType!: string;

  @ApiProperty({ example: '2026-03-15T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-21T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, isArray: true, example: ['钢琴', '乐理'] })
  subjects!: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['subject_piano', 'subject_theory'],
  })
  subjectIds!: string[];

  @ApiPropertyOptional({ example: 'subject_piano', nullable: true })
  primarySubjectId!: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['教师资格证'] })
  credentials!: string[];

  @ApiProperty({ type: AvailabilityWindowDto, isArray: true })
  previewWindows!: AvailabilityWindowDto[];
}

export class TeacherPublicProfileDto {
  @ApiProperty({ example: 'teacher_001' })
  id!: string;

  @ApiProperty({ example: 'user_teacher_001' })
  userId!: string;

  @ApiProperty({ example: '李老师' })
  displayName!: string;

  @ApiPropertyOptional({ example: '10 年钢琴启蒙经验。', nullable: true })
  bio!: string | null;

  @ApiProperty({ example: 200 })
  baseHourlyRate!: number;

  @ApiPropertyOptional({ example: '南开区', nullable: true })
  district!: string | null;

  @ApiProperty({ example: 4.8 })
  ratingAvg!: number;

  @ApiProperty({ example: 12 })
  ratingCount!: number;

  @ApiProperty({ example: 5 })
  experienceYears!: number;

  @ApiProperty({ example: 'APPROVED' })
  verificationStatus!: string;

  @ApiProperty({ example: 'PART_TIME' })
  employmentType!: string;

  @ApiProperty({ example: '2026-03-15T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-21T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, isArray: true, example: ['钢琴', '乐理'] })
  subjects!: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['subject_piano', 'subject_theory'],
  })
  subjectIds!: string[];

  @ApiPropertyOptional({ example: 'subject_piano', nullable: true })
  primarySubjectId!: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['教师资格证'] })
  credentials!: string[];
}

export class DiscoverTeachersResponseDto {
  @ApiProperty({ type: DiscoverTeacherDto, isArray: true })
  items!: DiscoverTeacherDto[];
}

export class TeacherAvailabilityRuleDto {
  @ApiProperty({ example: 'rule_001' })
  id!: string;

  @ApiProperty({ enum: Weekday, example: Weekday.MONDAY })
  weekday!: Weekday;

  @ApiProperty({ example: 1140 })
  startMinute!: number;

  @ApiProperty({ example: 1260 })
  endMinute!: number;

  @ApiProperty({ example: 60 })
  slotDurationMinutes!: number;

  @ApiProperty({ example: 0 })
  bufferMinutes!: number;
}

export class TeacherAvailabilityBlockDto {
  @ApiProperty({ example: 'block_001' })
  id!: string;

  @ApiProperty({ example: '2026-03-24T10:00:00.000Z' })
  startAt!: Date;

  @ApiProperty({ example: '2026-03-24T11:00:00.000Z' })
  endAt!: Date;

  @ApiPropertyOptional({ example: '家长请假', nullable: true })
  reason!: string | null;
}

export class TeacherAvailabilityExtraSlotDto {
  @ApiProperty({ example: 'rule_extra_001' })
  id!: string;

  @ApiProperty({ example: '2026-03-25' })
  date!: string;

  @ApiProperty({ example: 'TUESDAY' })
  weekday!: string;

  @ApiProperty({ example: 600 })
  startMinute!: number;

  @ApiProperty({ example: 660 })
  endMinute!: number;

  @ApiProperty({ example: 60 })
  slotDurationMinutes!: number;

  @ApiProperty({ example: 0 })
  bufferMinutes!: number;
}

export class TeacherAvailabilityConfigResponseDto {
  @ApiProperty({ example: 'teacher_001' })
  teacherProfileId!: string;

  @ApiProperty({ type: TeacherAvailabilityRuleDto, isArray: true })
  weeklyRules!: TeacherAvailabilityRuleDto[];

  @ApiProperty({ type: TeacherAvailabilityBlockDto, isArray: true })
  blocks!: TeacherAvailabilityBlockDto[];

  @ApiProperty({ type: TeacherAvailabilityExtraSlotDto, isArray: true })
  extraSlots!: TeacherAvailabilityExtraSlotDto[];
}

export class WeeklyRuleInputDto {
  @ApiProperty({ enum: Weekday, example: Weekday.MONDAY })
  @IsEnum(Weekday)
  weekday!: Weekday;

  @ApiProperty({ example: 1140 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startMinute!: number;

  @ApiProperty({ example: 1260 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  endMinute!: number;

  @ApiProperty({ example: 60, default: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  slotDurationMinutes = 60;

  @ApiProperty({ example: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  bufferMinutes = 0;
}

export class ReplaceWeeklyRulesDto {
  @ApiProperty({ type: WeeklyRuleInputDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyRuleInputDto)
  items!: WeeklyRuleInputDto[];
}

export class CreateAvailabilityBlockDto {
  @ApiProperty({ example: '2026-03-24T10:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ example: '2026-03-24T11:00:00.000Z' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ example: '当日请假', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string | null;
}

export class CreateAvailabilityExtraSlotDto {
  @ApiProperty({ example: '2026-03-25' })
  @IsString()
  date!: string;

  @ApiProperty({ example: 600 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startMinute!: number;

  @ApiProperty({ example: 660 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  endMinute!: number;

  @ApiProperty({ example: 60, default: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  slotDurationMinutes = 60;

  @ApiProperty({ example: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  bufferMinutes = 0;
}
