import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateLessonDto {
  @ApiPropertyOptional({
    description: '课程开始时间。未传则保持原值。',
    example: '2026-03-20T09:05:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({
    description: '课程结束时间。未传则保持原值。',
    example: '2026-03-20T10:05:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional({
    description: '老师课堂总结。',
    example: '完成右手五指练习，节奏感较好。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  teacherSummary?: string;

  @ApiPropertyOptional({
    description: '课后作业。',
    example: '练习《小星星》前 8 小节，每天 2 次。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  homework?: string;

  @ApiPropertyOptional({
    description: '课后成果视频地址。',
    example: 'https://example.com/outcome-video.mp4',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  outcomeVideoUrl?: string;

  @ApiPropertyOptional({
    description: '家长反馈。',
    example: '孩子愿意继续上课，老师沟通清晰。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  guardianFeedback?: string;

  @ApiPropertyOptional({
    description: '反馈提交时间。未传则保持原值。',
    example: '2026-03-20T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  feedbackSubmittedAt?: string;
}
