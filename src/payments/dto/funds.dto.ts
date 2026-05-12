import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentRefundStatus,
  PayoutStatus,
  ReconciliationRunType,
} from '@prisma/client';

export class CreateRefundDto {
  @ApiPropertyOptional({
    description: '退款原因，会透传给微信退款申请。',
    example: '家长取消课程',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reason?: string;
}

export class CreatePayoutDto {
  @ApiProperty({ description: '提现金额，单位元。', example: 120 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class RejectPayoutDto {
  @ApiProperty({ description: '拒绝提现原因。', example: '提现资料需补充' })
  @IsString()
  @MaxLength(200)
  reason!: string;
}

export class CreateWechatReconciliationRunDto {
  @ApiProperty({
    description: '账单日期，格式 YYYY-MM-DD。',
    example: '2026-04-09',
  })
  @IsDateString()
  billDate!: string;

  @ApiProperty({
    description: '对账类型。',
    enum: ReconciliationRunType,
    example: ReconciliationRunType.WECHAT_TRADE_BILL,
  })
  @IsEnum(ReconciliationRunType)
  runType!: ReconciliationRunType;
}

export class RefundResponseDto {
  @ApiProperty({ description: '退款单 ID。' })
  id!: string;

  @ApiProperty({ description: '预约 ID。' })
  bookingId!: string;

  @ApiProperty({ description: '支付意图 ID。' })
  paymentIntentId!: string;

  @ApiProperty({ description: '商户退款单号。' })
  outRefundNo!: string;

  @ApiPropertyOptional({ description: '微信退款单号。' })
  providerRefundId!: string | null;

  @ApiProperty({ description: '退款金额，单位元。' })
  amount!: number;

  @ApiProperty({ description: '退款状态。', enum: PaymentRefundStatus })
  status!: string;

  @ApiPropertyOptional({ description: '失败原因。' })
  failureReason!: string | null;
}

export class WalletTransactionResponseDto {
  @ApiProperty({ description: '钱包流水 ID。' })
  id!: string;

  @ApiProperty({ description: '流水类型。' })
  type!: string;

  @ApiProperty({ description: '流水状态。' })
  status!: string;

  @ApiProperty({ description: '资金方向。' })
  direction!: string;

  @ApiProperty({ description: '金额，单位元。' })
  amount!: number;

  @ApiPropertyOptional({ description: '流水后可用余额。' })
  balanceAfter!: number | null;

  @ApiProperty({ description: '发生时间。' })
  occurredAt!: Date;
}

export class WalletSummaryResponseDto {
  @ApiProperty({ description: '钱包 ID。' })
  walletId!: string;

  @ApiProperty({ description: '可用余额，单位元。' })
  availableBalance!: number;

  @ApiProperty({ description: '冻结余额，单位元。' })
  lockedBalance!: number;

  @ApiProperty({ description: '钱包状态。' })
  status!: string;
}

export class PayoutResponseDto {
  @ApiProperty({ description: '提现单 ID。' })
  id!: string;

  @ApiProperty({ description: '提现金额，单位元。' })
  amount!: number;

  @ApiProperty({ description: '提现状态。', enum: PayoutStatus })
  status!: string;

  @ApiPropertyOptional({ description: '商户转账单号。' })
  outBillNo!: string | null;

  @ApiPropertyOptional({ description: '微信转账单号。' })
  transferBillNo!: string | null;

  @ApiPropertyOptional({ description: '微信转账状态。' })
  transferState!: string | null;

  @ApiPropertyOptional({ description: '老师端确认收款 package 信息。' })
  packageInfo!: string | null;

  @ApiPropertyOptional({ description: '失败原因。' })
  failureReason!: string | null;
}

export class ReconciliationRunResponseDto {
  @ApiProperty({ description: '对账任务 ID。' })
  id!: string;

  @ApiProperty({ description: '对账类型。', enum: ReconciliationRunType })
  runType!: string;

  @ApiProperty({ description: '账单日期。' })
  billDate!: Date;

  @ApiProperty({ description: '任务状态。' })
  status!: string;

  @ApiProperty({ description: '差异数量。' })
  differenceCount!: number;

  @ApiPropertyOptional({ description: '失败原因。' })
  failureReason!: string | null;
}
