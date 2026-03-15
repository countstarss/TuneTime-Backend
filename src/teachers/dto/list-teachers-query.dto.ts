import { ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherEmploymentType, TeacherVerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListTeachersQueryDto {
  @ApiPropertyOptional({
    description: '关键字搜索，会匹配老师名称、简介。',
    example: '钢琴',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional({
    description: '按审核状态筛选。',
    enum: TeacherVerificationStatus,
    example: TeacherVerificationStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(TeacherVerificationStatus)
  verificationStatus?: TeacherVerificationStatus;

  @ApiPropertyOptional({
    description: '按雇佣类型筛选。',
    enum: TeacherEmploymentType,
    example: TeacherEmploymentType.PART_TIME,
  })
  @IsOptional()
  @IsEnum(TeacherEmploymentType)
  employmentType?: TeacherEmploymentType;

  @ApiPropertyOptional({
    description: '按科目 ID 筛选。',
    example: 'cmc123subject001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subjectId?: string;

  @ApiPropertyOptional({
    description: '按城市筛选服务范围。',
    example: '天津市',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @ApiPropertyOptional({
    description: '按区县筛选服务范围。',
    example: '南开区',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  district?: string;

  @ApiPropertyOptional({
    description: '页码，从 1 开始。',
    example: 1,
    default: 1,
  })
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
