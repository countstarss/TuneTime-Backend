import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PlatformRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/supabase-auth.guard';
import { RequireCapability } from '../common/require-capability.decorator';
import {
  CreatePayoutDto,
  CreateRefundDto,
  CreateWechatReconciliationRunDto,
  PayoutResponseDto,
  ReconciliationRunResponseDto,
  RefundResponseDto,
  RejectPayoutDto,
  WalletSummaryResponseDto,
  WalletTransactionResponseDto,
} from './dto/funds.dto';
import { PaymentNotificationAckDto } from './dto/payment-response.dto';
import { FundsService } from './funds.service';

@ApiTags('资金后台')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireCapability('payment')
@RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
export class AdminFundsController {
  constructor(private readonly fundsService: FundsService) {}

  @Post('payments/bookings/:bookingId/refunds')
  @ApiOperation({ summary: '为预约发起未结算全额退款' })
  @ApiParam({ name: 'bookingId', description: '预约 ID。' })
  @ApiBody({ type: CreateRefundDto })
  @ApiOkResponse({ type: RefundResponseDto })
  createBookingRefund(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateRefundDto,
  ): Promise<RefundResponseDto> {
    return this.fundsService.createFullRefund(currentUser, bookingId, dto);
  }

  @Post('payments/refunds/:id/reconcile')
  @ApiOperation({ summary: '主动查询并同步退款单状态' })
  @ApiParam({ name: 'id', description: '退款单 ID。' })
  @ApiOkResponse({ type: RefundResponseDto })
  reconcileRefund(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
  ): Promise<RefundResponseDto> {
    return this.fundsService.reconcileRefund(currentUser, id);
  }

  @Post('settlements/bookings/:bookingId/settle')
  @ApiOperation({ summary: '将可结算预约入账到老师钱包' })
  @ApiParam({ name: 'bookingId', description: '预约 ID。' })
  @ApiOkResponse({ type: WalletTransactionResponseDto })
  settleBooking(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('bookingId') bookingId: string,
  ): Promise<WalletTransactionResponseDto> {
    return this.fundsService.settleBooking(currentUser, bookingId);
  }

  @Post('payouts/:id/approve')
  @ApiOperation({ summary: '审核通过提现并发起微信商家转账' })
  @ApiParam({ name: 'id', description: '提现单 ID。' })
  @ApiOkResponse({ type: PayoutResponseDto })
  approvePayout(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
  ): Promise<PayoutResponseDto> {
    return this.fundsService.approvePayout(currentUser, id);
  }

  @Post('payouts/:id/reject')
  @ApiOperation({ summary: '拒绝提现申请' })
  @ApiParam({ name: 'id', description: '提现单 ID。' })
  @ApiBody({ type: RejectPayoutDto })
  @ApiOkResponse({ type: PayoutResponseDto })
  rejectPayout(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: RejectPayoutDto,
  ): Promise<PayoutResponseDto> {
    return this.fundsService.rejectPayout(currentUser, id, dto);
  }

  @Post('payouts/:id/reconcile')
  @ApiOperation({ summary: '主动查询并同步微信商家转账状态' })
  @ApiParam({ name: 'id', description: '提现单 ID。' })
  @ApiOkResponse({ type: PayoutResponseDto })
  reconcilePayout(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
  ): Promise<PayoutResponseDto> {
    return this.fundsService.reconcilePayout(currentUser, id);
  }

  @Post('reconciliation/wechat/runs')
  @ApiOperation({ summary: '创建并执行微信支付交易/退款账单对账任务' })
  @ApiBody({ type: CreateWechatReconciliationRunDto })
  @ApiOkResponse({ type: ReconciliationRunResponseDto })
  createWechatReconciliationRun(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CreateWechatReconciliationRunDto,
  ): Promise<ReconciliationRunResponseDto> {
    return this.fundsService.createWechatReconciliationRun(currentUser, dto);
  }
}

@ApiTags('老师钱包')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireCapability('payment')
@RequireRoles(PlatformRole.TEACHER)
@ApiBearerAuth('bearer')
export class TeacherFundsController {
  constructor(private readonly fundsService: FundsService) {}

  @Get('wallet/me')
  @ApiOperation({ summary: '查看我的老师钱包' })
  @ApiOkResponse({ type: WalletSummaryResponseDto })
  getMyWallet(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<WalletSummaryResponseDto> {
    return this.fundsService.getMyWallet(currentUser);
  }

  @Get('wallet/me/transactions')
  @ApiOperation({ summary: '查看我的老师钱包流水' })
  @ApiOkResponse({ type: [WalletTransactionResponseDto] })
  listMyWalletTransactions(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<WalletTransactionResponseDto[]> {
    return this.fundsService.listMyWalletTransactions(currentUser);
  }

  @Post('payouts')
  @ApiOperation({ summary: '创建老师提现申请' })
  @ApiBody({ type: CreatePayoutDto })
  @ApiOkResponse({ type: PayoutResponseDto })
  createPayout(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CreatePayoutDto,
  ): Promise<PayoutResponseDto> {
    return this.fundsService.createPayout(currentUser, dto);
  }

  @Get('payouts/me')
  @ApiOperation({ summary: '查看我的提现申请' })
  @ApiOkResponse({ type: [PayoutResponseDto] })
  listMyPayouts(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<PayoutResponseDto[]> {
    return this.fundsService.listMyPayouts(currentUser);
  }
}

@ApiTags('微信支付回调')
@Controller('payments/wechat')
@RequireCapability('payment')
export class WechatFundsNotifyController {
  constructor(private readonly fundsService: FundsService) {}

  @Post('refund-notify')
  @ApiOperation({ summary: '接收微信退款结果通知' })
  @ApiBody({ required: false })
  @ApiOkResponse({ type: PaymentNotificationAckDto })
  handleRefundNotification(
    @Req() request: Request & { rawBody?: Buffer },
  ): Promise<PaymentNotificationAckDto> {
    return this.fundsService.handleWechatRefundNotification({
      rawBody:
        request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
      headers: request.headers,
    });
  }

  @Post('transfer-notify')
  @ApiOperation({ summary: '接收微信商家转账结果通知' })
  @ApiBody({ required: false })
  @ApiOkResponse({ type: PaymentNotificationAckDto })
  handleTransferNotification(
    @Req() request: Request & { rawBody?: Buffer },
  ): Promise<PaymentNotificationAckDto> {
    return this.fundsService.handleWechatTransferNotification({
      rawBody:
        request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
      headers: request.headers,
    });
  }
}
