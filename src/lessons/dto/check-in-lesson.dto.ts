import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CheckInLessonDto {
  @ApiPropertyOptional({
    description: '签到时间。未传则默认使用当前时间。',
    example: '2026-03-20T08:58:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional({ description: '签到纬度。', example: 39.1267 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  checkInLatitude?: number;

  @ApiPropertyOptional({ description: '签到经度。', example: 117.2059 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  checkInLongitude?: number;

  @ApiPropertyOptional({
    description: '签到地址描述。',
    example: '天津市南开区黄河道 100 号',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  checkInAddress?: string;

  @ApiPropertyOptional({
    description: '实际上课开始时间。未传时默认等于签到时间。',
    example: '2026-03-20T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string;
}
