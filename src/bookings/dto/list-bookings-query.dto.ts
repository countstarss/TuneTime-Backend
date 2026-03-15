import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListBookingsQueryDto {
  @ApiPropertyOptional({
    description: '预约单号精确查询。',
    example: 'BK202603150001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingNo?: string;

  @ApiPropertyOptional({
    description: '关键字搜索，会匹配预约单号、老师名称、学生名称、科目名称。',
    example: '钢琴',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional({ description: '按老师档案 ID 筛选。', example: 'cmc123teacher001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  teacherProfileId?: string;

  @ApiPropertyOptional({ description: '按学生档案 ID 筛选。', example: 'cmc123student001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentProfileId?: string;

  @ApiPropertyOptional({ description: '按家长档案 ID 筛选。', example: 'cmc123guardian001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  guardianProfileId?: string;

  @ApiPropertyOptional({ description: '按科目 ID 筛选。', example: 'cmc123subject001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subjectId?: string;

  @ApiPropertyOptional({
    description: '按预约状态筛选。',
    enum: BookingStatus,
    example: BookingStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: '按支付状态筛选。',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: '按试听单筛选。', example: true })
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
  isTrial?: boolean;

  @ApiPropertyOptional({
    description: '按开始时间下界筛选。',
    example: '2026-03-20T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startAtFrom?: string;

  @ApiPropertyOptional({
    description: '按开始时间上界筛选。',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  startAtTo?: string;

  @ApiPropertyOptional({ description: '页码。', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: '每页数量，最大 100。', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
