import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ description: '所属用户 ID。', example: 'cmc123user001' })
  @IsString()
  @Length(8, 36)
  userId!: string;

  @ApiPropertyOptional({ description: '地址标签。', example: '家里' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @ApiProperty({ description: '联系人姓名。', example: '王女士' })
  @IsString()
  @Length(1, 64)
  contactName!: string;

  @ApiProperty({ description: '联系人电话。', example: '13800138000' })
  @IsString()
  @MaxLength(32)
  contactPhone!: string;

  @ApiPropertyOptional({
    description: '国家代码。',
    example: 'CN',
    default: 'CN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;

  @ApiProperty({ description: '省份。', example: '天津市' })
  @IsString()
  @MaxLength(64)
  province!: string;

  @ApiProperty({ description: '城市。', example: '天津市' })
  @IsString()
  @MaxLength(64)
  city!: string;

  @ApiProperty({ description: '区县。', example: '南开区' })
  @IsString()
  @MaxLength(64)
  district!: string;

  @ApiProperty({ description: '街道地址。', example: '黄河道 100 号' })
  @IsString()
  @MaxLength(255)
  street!: string;

  @ApiPropertyOptional({
    description: '楼栋、门牌等补充信息。',
    example: '3 号楼 2 单元 501',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  building?: string;

  @ApiPropertyOptional({ description: '纬度。', example: 39.1267 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  latitude?: number;

  @ApiPropertyOptional({ description: '经度。', example: 117.2059 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  longitude?: number;

  @ApiPropertyOptional({
    description: '是否设为默认地址。',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
