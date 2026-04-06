import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteBookingDto {
  @ApiPropertyOptional({
    description: '家长确认完课时间。未传时默认使用当前时间。',
    example: '2026-04-04T12:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  confirmedAt?: string;

  @ApiPropertyOptional({
    description: '家长确认备注。',
    example: '本节课正常完成。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
