import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ArriveBookingDto {
  @ApiPropertyOptional({
    description: '到达确认时间。未传时默认使用当前时间。',
    example: '2026-04-04T09:55:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  arrivedAt?: string;

  @ApiPropertyOptional({ description: '到达纬度。', example: 39.1267 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  arrivalLatitude?: number;

  @ApiPropertyOptional({ description: '到达经度。', example: 117.2059 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  arrivalLongitude?: number;

  @ApiPropertyOptional({
    description: '到达地址描述。',
    example: '天津市南开区黄河道 100 号',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  arrivalAddress?: string;

  @ApiPropertyOptional({
    description: '到达备注。',
    example: '已到楼下，等待家长开门。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  arrivalNote?: string;
}
