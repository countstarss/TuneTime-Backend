import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherEmploymentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({
    description: '关联的用户 ID。',
    example: 'cmc123user-teacher001',
  })
  @IsString()
  @Length(8, 36)
  userId!: string;

  @ApiProperty({
    description: '老师展示名称。',
    example: '李老师',
  })
  @IsString()
  @Length(1, 64)
  displayName!: string;

  @ApiPropertyOptional({
    description: '老师个人简介。',
    example: '10 年钢琴教学经验，擅长儿童启蒙与考级冲刺。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiProperty({
    description: '雇佣类型。',
    enum: TeacherEmploymentType,
    example: TeacherEmploymentType.PART_TIME,
  })
  @IsEnum(TeacherEmploymentType)
  employmentType!: TeacherEmploymentType;

  @ApiPropertyOptional({
    description: '基础小时费。',
    example: 180,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseHourlyRate?: number;

  @ApiPropertyOptional({
    description: '默认服务半径，单位公里。',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({
    description: '是否接受试听单。',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  acceptTrial?: boolean;

  @ApiPropertyOptional({
    description: '最大可接受路程时间，单位分钟。',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxTravelMinutes?: number;

  @ApiPropertyOptional({
    description: '时区。',
    example: 'Asia/Shanghai',
    default: 'Asia/Shanghai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: '协议确认时间。',
    example: '2026-03-15T08:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  agreementAcceptedAt?: string;

  @ApiPropertyOptional({
    description: '协议版本。',
    example: 'v1.0.0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agreementVersion?: string;

  @ApiPropertyOptional({
    description: '面试时间。',
    example: '2026-03-16T10:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  interviewedAt?: string;

  @ApiPropertyOptional({
    description: '面试备注。',
    example: '沟通顺畅，表达能力较好。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  interviewNotes?: string;

  @ApiPropertyOptional({
    description: '入驻完成时间。',
    example: '2026-03-17T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  onboardingCompletedAt?: string;
}
