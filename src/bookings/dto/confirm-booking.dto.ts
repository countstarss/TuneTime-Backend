import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmBookingDto {
  @ApiPropertyOptional({
    description: '家长确认时间。未传时默认使用当前时间。',
    example: '2026-03-18T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  guardianConfirmedAt?: string;

  @ApiPropertyOptional({
    description: '家长确认后的计划摘要，可覆盖原计划。',
    example: '确认试听课先了解孩子目前的基本功。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  planSummary?: string;
}
