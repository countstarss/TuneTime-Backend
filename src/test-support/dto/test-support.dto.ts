import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PlatformRole } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TEST_SUPPORT_SCENARIO_VARIANTS } from '../test-support.constants';

export class QaAccountDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  password!: string;

  @ApiProperty({ enum: PlatformRole, isArray: true })
  roles!: PlatformRole[];

  @ApiProperty()
  notes!: string;
}

export class QaBookingDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  bookingNo!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  startAt!: string;

  @ApiProperty()
  endAt!: string;

  @ApiProperty()
  teacherDisplayName!: string;

  @ApiProperty()
  studentDisplayName!: string;

  @ApiProperty()
  guardianDisplayName!: string;
}

export class QaEventLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ required: false, nullable: true })
  bookingId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  payload?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: string;
}

export class QaScenarioResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({
    description: '当前固定测试场景。',
    example: TEST_SUPPORT_SCENARIO_VARIANTS.task0.key,
  })
  scenarioVariant!: string;

  @ApiProperty({
    description: '当前固定测试场景说明。',
    example: TEST_SUPPORT_SCENARIO_VARIANTS.task0.label,
  })
  scenarioLabel!: string;

  @ApiProperty({ type: QaAccountDto, isArray: true })
  accounts!: QaAccountDto[];

  @ApiProperty({ type: QaBookingDto, isArray: true })
  bookings!: QaBookingDto[];

  @ApiProperty({ type: QaEventLogDto, isArray: true })
  events!: QaEventLogDto[];
}

export class QaScenarioResetResponseDto extends QaScenarioResponseDto {
  @ApiProperty()
  resetAt!: string;
}

export class ResetQaScenarioRequestDto {
  @ApiProperty({
    description: '固定测试场景。',
    enum: Object.values(TEST_SUPPORT_SCENARIO_VARIANTS).map((item) => item.key),
    required: false,
    example: TEST_SUPPORT_SCENARIO_VARIANTS.task1Pending.key,
  })
  @IsOptional()
  @IsIn(Object.values(TEST_SUPPORT_SCENARIO_VARIANTS).map((item) => item.key))
  variant?: string;
}

export class MockPaymentRequestDto {
  @ApiProperty({
    description: '待模拟支付的预约 ID。',
    example: 'qa_booking_pending_payment',
  })
  @IsString()
  bookingId!: string;

  @ApiProperty({
    description: '模拟结果。',
    enum: ['success', 'failed'],
    example: 'success',
  })
  @IsIn(['success', 'failed'])
  outcome!: 'success' | 'failed';
}
