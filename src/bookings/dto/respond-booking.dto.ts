import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum BookingTeacherResponseAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export class RespondBookingDto {
  @ApiProperty({
    description: '老师响应动作。',
    enum: BookingTeacherResponseAction,
    example: BookingTeacherResponseAction.ACCEPT,
  })
  @IsEnum(BookingTeacherResponseAction)
  action!: BookingTeacherResponseAction;

  @ApiPropertyOptional({
    description: '老师响应时间。',
    example: '2026-03-28T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  respondedAt?: string;

  @ApiPropertyOptional({
    description: '拒单原因或补充说明。',
    example: '当天晚上已有演出，无法接单。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: '接单后的课前摘要。',
    example: '先做试听评估和启蒙测音。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  planSummary?: string;
}
