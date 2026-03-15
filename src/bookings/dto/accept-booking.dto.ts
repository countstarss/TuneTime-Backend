import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptBookingDto {
  @ApiPropertyOptional({
    description: '老师接单时间。未传时默认使用当前时间。',
    example: '2026-03-18T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  acceptedAt?: string;

  @ApiPropertyOptional({
    description: '老师接单后补充的教学计划摘要。',
    example: '首节课先做手型与节奏评估。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  planSummary?: string;
}
