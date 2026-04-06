import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BookingCompletionStatus,
  BookingExceptionType,
  BookingStatus,
  PaymentStatus,
  ResponsibilityType,
  SettlementReadiness,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ManualRepairAction {
  PAYMENT_STATUS = 'PAYMENT_STATUS',
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  RESPONSIBILITY = 'RESPONSIBILITY',
  CLOSE_EXCEPTION = 'CLOSE_EXCEPTION',
  COMPLETION_STATUS = 'COMPLETION_STATUS',
}

export class ManualRepairBookingDto {
  @ApiProperty({
    description: '人工修复动作。',
    enum: ManualRepairAction,
    example: ManualRepairAction.CHECK_OUT,
  })
  @IsEnum(ManualRepairAction)
  action!: ManualRepairAction;

  @ApiProperty({
    description: '修复原因。',
    example: '老师已完课但忘记签退，客服代为补录。',
  })
  @IsString()
  @MaxLength(1000)
  note!: string;

  @ApiPropertyOptional({
    description: '修复后的支付状态。',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description: '修复后的预约状态。',
    enum: BookingStatus,
    example: BookingStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @ApiPropertyOptional({
    description: '补签到时间。',
    example: '2026-04-04T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional({
    description: '补签退时间。',
    example: '2026-04-04T11:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @ApiPropertyOptional({
    description: '签到地址。',
    example: '天津市南开区黄河道 100 号',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: '纬度。', example: 39.1267 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: '经度。', example: 117.2059 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: '目标异常类型。',
    enum: BookingExceptionType,
    example: BookingExceptionType.OVERDUE_NOT_FINISHED,
  })
  @IsOptional()
  @IsEnum(BookingExceptionType)
  exceptionType?: BookingExceptionType;

  @ApiPropertyOptional({
    description: '修复后的责任方。',
    enum: ResponsibilityType,
    example: ResponsibilityType.TEACHER,
  })
  @IsOptional()
  @IsEnum(ResponsibilityType)
  responsibilityType?: ResponsibilityType;

  @ApiPropertyOptional({
    description: '修复后的完课确认状态。',
    enum: BookingCompletionStatus,
    example: BookingCompletionStatus.GUARDIAN_CONFIRMED,
  })
  @IsOptional()
  @IsEnum(BookingCompletionStatus)
  completionStatus?: BookingCompletionStatus;

  @ApiPropertyOptional({
    description: '修复后的结算资格状态。',
    enum: SettlementReadiness,
    example: SettlementReadiness.READY,
  })
  @IsOptional()
  @IsEnum(SettlementReadiness)
  settlementReadiness?: SettlementReadiness;
}
