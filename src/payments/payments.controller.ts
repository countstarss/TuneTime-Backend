import {
  Controller,
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
  PaymentNotificationAckDto,
  PaymentReconcileResponseDto,
  PrepareBookingPaymentResponseDto,
} from './dto/payment-response.dto';
import { PaymentsService } from './payments.service';

@ApiTags('支付')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('bookings/:bookingId/prepare')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('payment')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '为预约准备微信支付参数',
    description:
      '校验预约归属和支付状态后，创建或复用支付意图并返回 `wx.requestPayment` 参数。',
  })
  @ApiParam({ name: 'bookingId', description: '预约 ID。' })
  @ApiOkResponse({ type: PrepareBookingPaymentResponseDto })
  prepareBookingPayment(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('bookingId') bookingId: string,
  ): Promise<PrepareBookingPaymentResponseDto> {
    return this.paymentsService.prepareBookingPayment(currentUser, bookingId);
  }

  @Post('bookings/:bookingId/reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('payment')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '主动查询支付状态并回写订单',
    description:
      '当前端已收到支付成功但订单状态尚未同步时，可主动查单并通过统一投影器刷新预约状态。',
  })
  @ApiParam({ name: 'bookingId', description: '预约 ID。' })
  @ApiOkResponse({ type: PaymentReconcileResponseDto })
  reconcileBookingPayment(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('bookingId') bookingId: string,
  ): Promise<PaymentReconcileResponseDto> {
    return this.paymentsService.reconcileBookingPayment(currentUser, bookingId);
  }

  @Post('wechat/notify')
  @RequireCapability('payment')
  @ApiOperation({
    summary: '接收微信支付回调通知',
    description: '验签、落事件日志并通过统一投影器推进预约支付状态。',
  })
  @ApiBody({ required: false })
  @ApiOkResponse({ type: PaymentNotificationAckDto })
  handleWechatNotification(
    @Req() request: Request & { rawBody?: Buffer },
  ): Promise<PaymentNotificationAckDto> {
    return this.paymentsService.handleWechatNotification({
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
      headers: request.headers,
    });
  }
}
