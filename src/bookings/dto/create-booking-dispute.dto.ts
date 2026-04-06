import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingExceptionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BookingDisputeEvidenceDto {
  @ApiProperty({
    description: '证据链接。',
    example: 'https://example.com/evidence.jpg',
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  url!: string;

  @ApiPropertyOptional({
    description: '证据备注。',
    example: '到场照片',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreateBookingDisputeDto {
  @ApiProperty({
    description: '争议类型。',
    enum: BookingExceptionType,
    example: BookingExceptionType.ARRIVAL_DISPUTE,
  })
  @IsEnum(BookingExceptionType)
  exceptionType!: BookingExceptionType;

  @ApiProperty({
    description: '争议摘要。',
    example: '家长反馈老师未到场。',
  })
  @IsString()
  @MaxLength(500)
  summary!: string;

  @ApiPropertyOptional({
    description: '争议详情。',
    example: '家长表示在预约时间内未见到老师上门。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  @ApiPropertyOptional({
    description: '争议证据列表。',
    type: BookingDisputeEvidenceDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BookingDisputeEvidenceDto)
  evidenceItems?: BookingDisputeEvidenceDto[];
}
