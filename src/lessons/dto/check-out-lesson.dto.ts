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

export class CheckOutLessonDto {
  @ApiPropertyOptional({
    description: '签退时间。未传则默认使用当前时间。',
    example: '2026-03-20T10:05:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @ApiPropertyOptional({ description: '签退纬度。', example: 39.1267 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  checkOutLatitude?: number;

  @ApiPropertyOptional({ description: '签退经度。', example: 117.2059 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  checkOutLongitude?: number;

  @ApiPropertyOptional({
    description: '签退地址描述。',
    example: '天津市南开区黄河道 100 号',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  checkOutAddress?: string;

  @ApiPropertyOptional({
    description: '实际下课时间。未传时默认等于签退时间。',
    example: '2026-03-20T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}
