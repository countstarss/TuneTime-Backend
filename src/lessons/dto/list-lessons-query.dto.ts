import { ApiPropertyOptional } from '@nestjs/swagger';
import { LessonAttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListLessonsQueryDto {
  @ApiPropertyOptional({
    description: '按预约 ID 筛选。',
    example: 'cmc123booking001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingId?: string;

  @ApiPropertyOptional({
    description: '按老师档案 ID 筛选。',
    example: 'cmc123teacher001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  teacherProfileId?: string;

  @ApiPropertyOptional({
    description: '按学生档案 ID 筛选。',
    example: 'cmc123student001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentProfileId?: string;

  @ApiPropertyOptional({
    description: '按出勤状态筛选。',
    enum: LessonAttendanceStatus,
    example: LessonAttendanceStatus.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(LessonAttendanceStatus)
  attendanceStatus?: LessonAttendanceStatus;

  @ApiPropertyOptional({
    description: '按课程创建时间下界筛选。',
    example: '2026-03-20T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description: '按课程创建时间上界筛选。',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @ApiPropertyOptional({ description: '页码。', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: '每页数量，最大 100。',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
