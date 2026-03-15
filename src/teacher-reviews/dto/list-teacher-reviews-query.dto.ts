import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListTeacherReviewsQueryDto {
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
    description: '按家长档案 ID 筛选。',
    example: 'cmc123guardian001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  guardianProfileId?: string;

  @ApiPropertyOptional({
    description: '关键字搜索，会匹配评价内容、改进建议和标签。',
    example: '耐心',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

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
