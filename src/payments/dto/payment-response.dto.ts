import { ApiProperty } from '@nestjs/swagger';

export class MiniappPaymentParamsDto {
  @ApiProperty({ description: '微信小程序 AppID。', example: 'wx1234567890' })
  appId!: string;

  @ApiProperty({
    description: '时间戳字符串。',
    example: '1712460000',
  })
  timeStamp!: string;

  @ApiProperty({
    description: '随机串。',
    example: '4c7f1e24d3b94c05a0a9f27534b7f4df',
  })
  nonceStr!: string;

  @ApiProperty({
    description: '小程序支付 package 字段。',
    example: 'prepay_id=wx201410272009395522657a690389285100',
  })
  package!: string;

  @ApiProperty({ description: '签名类型。', example: 'RSA' })
  signType!: string;

  @ApiProperty({
    description: '小程序支付签名。',
    example: 'MEUCIQDB...',
  })
  paySign!: string;
}

export class PrepareBookingPaymentResponseDto {
  @ApiProperty({
    description: '支付意图 ID。',
    example: 'cme123payment001',
  })
  paymentIntentId!: string;

  @ApiProperty({
    description: '支付意图状态。',
    example: 'REQUIRES_PAYMENT',
  })
  intentStatus!: string;

  @ApiProperty({
    description: '支付截止时间。',
    example: '2026-04-07T12:30:00.000Z',
    nullable: true,
    required: false,
  })
  expiresAt!: Date | null;

  @ApiProperty({
    description: '是否已经等待渠道通知。',
    example: false,
  })
  awaitingProviderNotification!: boolean;

  @ApiProperty({
    description: '用于 `wx.requestPayment` 的参数。',
    type: MiniappPaymentParamsDto,
  })
  paymentParams!: MiniappPaymentParamsDto;
}

export class PaymentNotificationAckDto {
  @ApiProperty({ description: '处理结果码。', example: 'SUCCESS' })
  code!: string;

  @ApiProperty({ description: '处理结果说明。', example: 'OK' })
  message!: string;
}

export class PaymentReconcileResponseDto {
  @ApiProperty({ description: '预约 ID。', example: 'booking_1' })
  bookingId!: string;

  @ApiProperty({
    description: '支付意图 ID。',
    example: 'payment_intent_1',
  })
  paymentIntentId!: string;

  @ApiProperty({
    description: '支付意图状态。',
    example: 'SUCCEEDED',
  })
  intentStatus!: string;

  @ApiProperty({
    description: '预约业务状态。',
    example: 'CONFIRMED',
  })
  bookingStatus!: string;

  @ApiProperty({
    description: '预约支付状态。',
    example: 'PAID',
  })
  paymentStatus!: string;
}
