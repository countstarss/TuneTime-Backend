import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateBookingFromHoldDto {
  @ApiProperty({ description: '占位 ID。', example: 'hold_001' })
  @IsString()
  @Length(8, 36)
  holdId!: string;

  @ApiPropertyOptional({
    description: '是否试听单。',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;

  @ApiPropertyOptional({
    description: '课前计划摘要。',
    example: '首节课先做启蒙评估。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  planSummary?: string;

  @ApiPropertyOptional({
    description: '预约备注。',
    example: '门口有门禁，请提前联系。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
