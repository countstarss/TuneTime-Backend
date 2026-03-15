import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  @IsString()
  @Length(8, 36)
  teacherProfileId!: string;

  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  @IsString()
  @Length(8, 36)
  studentProfileId!: string;

  @ApiPropertyOptional({
    description: '家长档案 ID。家长代预约时建议传入。',
    example: 'cmc123guardian001',
  })
  @IsOptional()
  @IsString()
  @Length(8, 36)
  guardianProfileId?: string;

  @ApiProperty({ description: '科目 ID。', example: 'cmc123subject001' })
  @IsString()
  @Length(8, 36)
  subjectId!: string;

  @ApiProperty({ description: '上门服务地址 ID。', example: 'cmc123addr001' })
  @IsString()
  @Length(8, 36)
  serviceAddressId!: string;

  @ApiProperty({
    description: '预约开始时间，ISO 8601 格式。',
    example: '2026-03-20T09:00:00.000Z',
  })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    description: '预约结束时间，ISO 8601 格式。',
    example: '2026-03-20T10:00:00.000Z',
  })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({
    description: '时区。',
    example: 'Asia/Shanghai',
    default: 'Asia/Shanghai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: '是否试听单。试听单会优先使用老师科目配置中的试听价。',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;

  @ApiPropertyOptional({
    description: '优惠金额。会参与总价计算。',
    example: 20,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    description: '平台服务费。会参与总价计算。',
    example: 8,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  platformFeeAmount?: number;

  @ApiPropertyOptional({
    description: '路费。会参与总价计算。',
    example: 15,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  travelFeeAmount?: number;

  @ApiPropertyOptional({
    description: '支付截止时间，ISO 8601 格式。',
    example: '2026-03-19T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  paymentDueAt?: string;

  @ApiPropertyOptional({
    description: '课前计划摘要。',
    example: '试听课重点了解孩子基础与兴趣点。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  planSummary?: string;

  @ApiPropertyOptional({
    description: '预约备注。',
    example: '需要自备节拍器。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
