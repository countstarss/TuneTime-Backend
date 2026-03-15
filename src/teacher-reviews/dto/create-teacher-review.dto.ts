import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTeacherReviewDto {
  @ApiProperty({ description: '关联预约 ID。', example: 'cmc123booking001' })
  @IsString()
  @Length(8, 36)
  bookingId!: string;

  @ApiProperty({ description: '总体评分，1-5 分。', example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: '课程质量评分，1-5 分。', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  lessonQualityRating?: number;

  @ApiPropertyOptional({ description: '老师表现评分，1-5 分。', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  teacherPerformanceRating?: number;

  @ApiPropertyOptional({
    description: '评价内容。',
    example: '老师很有耐心，孩子上完课更愿意练琴。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({
    description: '改进建议。',
    example: '可以再多一些节奏训练。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  improvementNotes?: string;

  @ApiPropertyOptional({
    description: '评价标签。',
    example: ['耐心', '专业', '沟通好'],
    type: String,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];
}
