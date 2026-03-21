import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PlatformRole } from '@prisma/client';
import { IsIn, IsString } from 'class-validator';

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
