import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class SubmitLessonFeedbackDto {
  @ApiPropertyOptional({
    description: '老师课堂总结。',
    example: '本节课完成哈农第一组练习。',
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
    description: '家长补充反馈。',
    example: '老师很有耐心，孩子课后愿意继续练琴。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  guardianFeedback?: string;

  @ApiPropertyOptional({
    description: '反馈提交时间。未传时默认使用当前时间。',
    example: '2026-03-20T12:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  feedbackSubmittedAt?: string;
}
