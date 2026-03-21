import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRescheduleRequestDto {
  @ApiProperty({
    description: '建议的新开始时间。',
    example: '2026-03-29T10:00:00.000Z',
  })
  @IsDateString()
  proposedStartAt!: string;

  @ApiProperty({
    description: '建议的新结束时间。',
    example: '2026-03-29T11:00:00.000Z',
  })
  @IsDateString()
  proposedEndAt!: string;

  @ApiPropertyOptional({
    description: '改约原因。',
    example: '孩子周五有校内活动，希望改到周六上午。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
