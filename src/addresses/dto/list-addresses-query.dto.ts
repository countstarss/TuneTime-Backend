import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAddressesQueryDto {
  @ApiPropertyOptional({
    description: '按用户 ID 精确筛选。',
    example: 'cmc123user001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @ApiPropertyOptional({
    description: '关键字搜索，会匹配联系人、街道、楼栋、标签。',
    example: '黄河道',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional({ description: '按城市筛选。', example: '天津市' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @ApiPropertyOptional({ description: '按区县筛选。', example: '南开区' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  district?: string;

  @ApiPropertyOptional({ description: '按默认地址筛选。', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) {
      return true;
    }
    if (value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '页码。', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: '每页数量。', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
