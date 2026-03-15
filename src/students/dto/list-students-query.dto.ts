import { ApiPropertyOptional } from '@nestjs/swagger';
import { GradeLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListStudentsQueryDto {
  @ApiPropertyOptional({
    description: '关键字搜索，会匹配学生姓名、学校名称和学习目标。',
    example: '钢琴',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional({
    description: '按年级阶段筛选。',
    enum: GradeLevel,
    example: GradeLevel.PRIMARY,
  })
  @IsOptional()
  @IsEnum(GradeLevel)
  gradeLevel?: GradeLevel;

  @ApiPropertyOptional({
    description: '按 userId 精确筛选。',
    example: 'cmc123user-student001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @ApiPropertyOptional({
    description: '按家长档案 ID 筛选，只返回该家长名下的孩子。',
    example: 'cmc123guardian001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  guardianProfileId?: string;

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
