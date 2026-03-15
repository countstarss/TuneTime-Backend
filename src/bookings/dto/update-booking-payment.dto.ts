import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdateBookingPaymentDto {
  @ApiProperty({
    description: '新的支付状态。',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;

  @ApiPropertyOptional({
    description: '支付截止时间。未传则沿用原值。',
    example: '2026-03-19T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  paymentDueAt?: string;
}
