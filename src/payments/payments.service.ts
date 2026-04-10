import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Account,
  BookingCancellationReason,
  BookingStatus,
  PaymentIntentStatus,
  PaymentStatus,
  PlatformRole,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { WECHAT_MINIAPP_PROVIDER } from '../auth/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { BookingPaymentProjector } from './booking-payment-projector.service';
import {
  PaymentNotificationAckDto,
  PaymentReconcileResponseDto,
  PrepareBookingPaymentResponseDto,
} from './dto/payment-response.dto';
import { WECHAT_PAY_PROVIDER } from './payments.constants';
import {
  WechatCloseOrderResult,
  WechatOrderQueryResult,
  WechatPayClient,
  WechatPayNotificationResult,
  WechatPaymentAmount,
} from './wechat-pay.client';

type PaymentIntentProviderSnapshot = {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  booking: {
    id: string;
    totalAmount: Prisma.Decimal;
    currency: string;
  };
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingPaymentProjector: BookingPaymentProjector,
    private readonly wechatPayClient: WechatPayClient,
  ) {}

  async prepareBookingPayment(
    currentUser: AuthenticatedUserContext,
    bookingId: string,
  ): Promise<PrepareBookingPaymentResponseDto> {
    const booking = await this.loadGuardianBookingForPayment(
      currentUser,
      bookingId,
    );
    this.assertBookingReadyForPayment(booking);

    const miniappAccount = await this.resolveMiniappAccount(currentUser.userId);
    const paymentIntent = await this.prisma.$transaction(async (tx) => {
      const ensured = await this.bookingPaymentProjector.ensurePaymentIntentForBookingTx(
        tx,
        {
          bookingId: booking.id,
          payerUserId: currentUser.userId,
          amount: booking.totalAmount,
          currency: booking.currency,
          expiresAt: booking.paymentDueAt,
        },
      );

      if (ensured.status === PaymentIntentStatus.FAILED) {
        await this.bookingPaymentProjector.resetPaymentIntentForRetryTx(
          tx,
          ensured.id,
          {
            expiresAt: booking.paymentDueAt,
          },
        );
      }

      return tx.paymentIntent.findUniqueOrThrow({
        where: { id: ensured.id },
      });
    });

    const reusablePaymentParams =
      this.buildReusablePaymentParamsIfAvailable(paymentIntent);
    if (reusablePaymentParams) {
      return {
        paymentIntentId: paymentIntent.id,
        intentStatus: paymentIntent.status,
        expiresAt: paymentIntent.expiresAt ?? booking.paymentDueAt,
        awaitingProviderNotification: false,
        paymentParams: reusablePaymentParams,
      };
    }

    const prepared = await this.wechatPayClient.prepareJsapiPayment({
      paymentIntentId: paymentIntent.id,
      description: this.buildPaymentDescription(booking.subject.name, booking.bookingNo),
      amountCents: this.toCents(booking.totalAmount),
      payerOpenId: miniappAccount.openId!,
      timeExpire: booking.paymentDueAt,
    });

    const updatedIntent = await this.prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        provider: WECHAT_PAY_PROVIDER,
        status: PaymentIntentStatus.REQUIRES_PAYMENT,
        providerPrepayId: prepared.providerPrepayId,
        prepayExpiresAt: prepared.prepayExpiresAt,
        providerMetadata: {
          lastPreparedAt: new Date().toISOString(),
          payerOpenId: miniappAccount.openId,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return {
      paymentIntentId: updatedIntent.id,
      intentStatus: updatedIntent.status,
      expiresAt: updatedIntent.expiresAt ?? booking.paymentDueAt,
      awaitingProviderNotification: false,
      paymentParams: prepared.paymentParams,
    };
  }

  async reconcileBookingPayment(
    currentUser: AuthenticatedUserContext,
    bookingId: string,
  ): Promise<PaymentReconcileResponseDto> {
    const booking = await this.loadGuardianBookingForPayment(
      currentUser,
      bookingId,
    );
    if (!booking.paymentIntent) {
      throw new BadRequestException('当前预约尚未生成支付意图');
    }

    await this.syncPaymentIntentFromProvider({
      paymentIntentId: booking.paymentIntent.id,
      paymentDueAt: booking.paymentDueAt,
    });

    const refreshed = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentIntent: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return {
      bookingId: refreshed.id,
      paymentIntentId: refreshed.paymentIntent?.id ?? booking.paymentIntent.id,
      intentStatus:
        refreshed.paymentIntent?.status ?? booking.paymentIntent.status,
      bookingStatus: refreshed.status,
      paymentStatus: refreshed.paymentStatus,
    };
  }

  async handleWechatNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<PaymentNotificationAckDto> {
    const notification = this.wechatPayClient.parsePaymentNotification(input);
    const headersDigest = this.wechatPayClient.computeHeadersDigest(
      input.headers,
      input.rawBody,
    );

    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: notification.paymentIntentId },
      select: {
        id: true,
        amount: true,
        currency: true,
        booking: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
    });

    let rejectedReason: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        const providerEvent = await tx.paymentProviderEvent.create({
          data: {
            provider: WECHAT_PAY_PROVIDER,
            eventId: notification.eventId,
            paymentIntentId: paymentIntent?.id ?? null,
            headersDigest,
            payload: notification.rawEnvelope as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        if (!paymentIntent) {
          await tx.paymentProviderEvent.update({
            where: { id: providerEvent.id },
            data: {
              processedAt: new Date(),
              processResult: 'PAYMENT_INTENT_NOT_FOUND',
            },
          });
          return;
        }

        rejectedReason = this.getWechatPaymentMismatchReason(
          notification,
          paymentIntent,
        );
        if (rejectedReason) {
          await tx.paymentProviderEvent.update({
            where: { id: providerEvent.id },
            data: {
              processedAt: new Date(),
              processResult: `REJECTED:${rejectedReason}`,
            },
          });
          return;
        }

        await this.bookingPaymentProjector.applyPaymentStateTx(tx, {
          paymentIntentId: paymentIntent.id,
          status: this.mapTradeStateToIntentStatus(notification.tradeState),
          providerPaymentId: notification.transactionId,
          providerMetadata: notification.resource as Prisma.InputJsonValue,
          failedReason:
            notification.tradeStateDesc ??
            this.buildTradeStateFailureReason(notification.tradeState),
          lastNotifiedAt: new Date(),
          capturedAt: notification.successTime,
        });

        await tx.paymentProviderEvent.update({
          where: { id: providerEvent.id },
          data: {
            processedAt: new Date(),
            processResult: `APPLIED:${notification.tradeState}`,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return {
          code: 'SUCCESS',
          message: 'Duplicate notification ignored',
        };
      }
      throw error;
    }

    if (rejectedReason) {
      throw new BadRequestException(rejectedReason);
    }

    return {
      code: 'SUCCESS',
      message: 'OK',
    };
  }

  async cancelPendingBookingPayment(input: {
    paymentIntentId: string;
    paymentDueAt: Date | null;
    cancellationReason: BookingCancellationReason;
    cancelledAt: Date;
    cancelledByUserId: string | null;
    remark?: string | null;
  }) {
    const closeResult = await this.tryCloseOrder(input.paymentIntentId);

    if (closeResult.status === 'ALREADY_PAID') {
      await this.syncPaymentIntentFromProvider({
        paymentIntentId: input.paymentIntentId,
        paymentDueAt: input.paymentDueAt,
      });
      throw new BadRequestException('支付已完成，当前预约不能直接取消，请走退款流程');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.bookingPaymentProjector.applyPaymentStateTx(tx, {
        paymentIntentId: input.paymentIntentId,
        status: PaymentIntentStatus.CANCELLED,
        failedReason: '预约已取消，支付单已关闭',
        expiresAt: input.paymentDueAt,
        bookingCancellationReason: input.cancellationReason,
        bookingCancelledAt: input.cancelledAt,
        bookingCancelledByUserId: input.cancelledByUserId,
        bookingStatusRemark: input.remark ?? null,
      });
    });
  }

  async expirePendingPayments() {
    const candidates = await this.prisma.paymentIntent.findMany({
      where: {
        booking: {
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: {
            in: [PaymentStatus.UNPAID, PaymentStatus.FAILED],
          },
          paymentDueAt: { lte: new Date() },
        },
        status: {
          in: [
            PaymentIntentStatus.REQUIRES_PAYMENT,
            PaymentIntentStatus.PROCESSING,
            PaymentIntentStatus.FAILED,
          ],
        },
      },
      select: {
        id: true,
        booking: {
          select: {
            paymentDueAt: true,
          },
        },
      },
    });

    for (const candidate of candidates) {
      const closeResult = await this.tryCloseOrder(candidate.id);
      if (closeResult.status === 'ALREADY_PAID') {
        await this.syncPaymentIntentFromProvider({
          paymentIntentId: candidate.id,
          paymentDueAt: candidate.booking.paymentDueAt,
        });
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await this.bookingPaymentProjector.applyPaymentStateTx(tx, {
          paymentIntentId: candidate.id,
          status: PaymentIntentStatus.CANCELLED,
          failedReason: '支付超时，系统已自动关闭',
          expiresAt: candidate.booking.paymentDueAt,
        });
      });
    }
  }

  private async loadGuardianBookingForPayment(
    currentUser: AuthenticatedUserContext,
    bookingId: string,
  ) {
    if (currentUser.activeRole !== PlatformRole.GUARDIAN) {
      throw new ForbiddenException('只有家长可以发起支付');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingNo: true,
        status: true,
        paymentStatus: true,
        paymentDueAt: true,
        totalAmount: true,
        currency: true,
        guardianProfile: {
          select: {
            userId: true,
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
        paymentIntent: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约：${bookingId}`);
    }

    if (booking.guardianProfile?.userId !== currentUser.userId) {
      throw new ForbiddenException('当前家长无权为该预约发起支付');
    }

    return booking;
  }

  private async syncPaymentIntentFromProvider(input: {
    paymentIntentId: string;
    paymentDueAt: Date | null;
  }) {
    const paymentIntent = await this.loadPaymentIntentForProviderValidation(
      input.paymentIntentId,
    );
    const queryResult = await this.wechatPayClient.queryOrder(
      input.paymentIntentId,
    );
    const mismatchReason = this.getWechatPaymentMismatchReason(
      queryResult,
      paymentIntent,
    );
    if (mismatchReason) {
      throw new BadRequestException(mismatchReason);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.bookingPaymentProjector.applyPaymentStateTx(tx, {
        paymentIntentId: input.paymentIntentId,
        status: this.mapTradeStateToIntentStatus(
          queryResult.tradeState,
          input.paymentDueAt,
        ),
        providerPaymentId: queryResult.transactionId,
        providerMetadata: queryResult.raw as Prisma.InputJsonValue,
        failedReason:
          queryResult.tradeStateDesc ??
          this.buildTradeStateFailureReason(queryResult.tradeState),
        capturedAt: queryResult.successTime,
      });
    });

    return queryResult;
  }

  private assertBookingReadyForPayment(booking: {
    status: BookingStatus;
    paymentDueAt: Date | null;
    paymentIntent?: {
      status: PaymentIntentStatus;
    } | null;
  }) {
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException('当前预约状态不允许支付');
    }

    if (booking.paymentIntent?.status === PaymentIntentStatus.PROCESSING) {
      throw new BadRequestException('支付处理中，请稍后查询支付结果');
    }

    if (booking.paymentDueAt && booking.paymentDueAt.getTime() <= Date.now()) {
      throw new BadRequestException('当前预约已超过支付截止时间');
    }
  }

  private async resolveMiniappAccount(userId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        provider: WECHAT_MINIAPP_PROVIDER,
      },
    });

    if (!account?.openId) {
      throw new BadRequestException(
        '当前账号尚未绑定微信小程序身份，无法发起微信支付',
      );
    }

    return account;
  }

  private buildPaymentDescription(subjectName: string, bookingNo: string) {
    return `TuneTime ${subjectName} ${bookingNo}`.slice(0, 127);
  }

  private toCents(amount: Prisma.Decimal | { toString(): string }) {
    const normalized = amount.toString().trim();
    const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      throw new BadRequestException('支付金额格式非法');
    }

    const cents =
      Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new BadRequestException('支付金额必须大于 0');
    }

    return cents;
  }

  private mapTradeStateToIntentStatus(
    tradeState: string,
    paymentDueAt?: Date | null,
  ): PaymentIntentStatus {
    switch (tradeState) {
      case 'SUCCESS':
        return PaymentIntentStatus.SUCCEEDED;
      case 'REFUND':
        return PaymentIntentStatus.REFUNDED;
      case 'USERPAYING':
        return PaymentIntentStatus.PROCESSING;
      case 'NOTPAY':
        return PaymentIntentStatus.REQUIRES_PAYMENT;
      case 'CLOSED':
        return paymentDueAt && paymentDueAt.getTime() <= Date.now()
          ? PaymentIntentStatus.CANCELLED
          : PaymentIntentStatus.FAILED;
      case 'PAYERROR':
      case 'REVOKED':
      default:
        return PaymentIntentStatus.FAILED;
    }
  }

  private buildTradeStateFailureReason(tradeState: string) {
    switch (tradeState) {
      case 'NOTPAY':
        return '支付尚未完成';
      case 'USERPAYING':
        return '支付处理中，等待用户完成支付';
      case 'CLOSED':
        return '支付单已关闭';
      case 'PAYERROR':
        return '支付失败，请重新尝试';
      case 'REVOKED':
        return '支付已撤销';
      default:
        return '支付状态待确认';
    }
  }

  private async tryCloseOrder(
    paymentIntentId: string,
  ): Promise<WechatCloseOrderResult> {
    return this.wechatPayClient.closeOrder(paymentIntentId);
  }

  private buildReusablePaymentParamsIfAvailable(paymentIntent: {
    status: PaymentIntentStatus;
    providerPrepayId: string | null;
    prepayExpiresAt: Date | null;
  }) {
    if (
      paymentIntent.status !== PaymentIntentStatus.REQUIRES_PAYMENT ||
      !paymentIntent.providerPrepayId ||
      !paymentIntent.prepayExpiresAt
    ) {
      return null;
    }

    const reuseBufferMs = 60_000;
    if (paymentIntent.prepayExpiresAt.getTime() <= Date.now() + reuseBufferMs) {
      return null;
    }

    return this.wechatPayClient.buildMiniappPaymentParams(
      paymentIntent.providerPrepayId,
    );
  }

  private loadPaymentIntentForProviderValidation(paymentIntentId: string) {
    return this.prisma.paymentIntent.findUniqueOrThrow({
      where: { id: paymentIntentId },
      select: {
        id: true,
        amount: true,
        currency: true,
        booking: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
    });
  }

  private getWechatPaymentMismatchReason(
    payment:
      | WechatPayNotificationResult
      | WechatOrderQueryResult,
    paymentIntent: PaymentIntentProviderSnapshot,
  ) {
    const merchantIdentity = this.wechatPayClient.getMerchantIdentity();
    if (payment.paymentIntentId !== paymentIntent.id) {
      return '微信支付订单号与本地支付意图不一致';
    }

    if (payment.appId !== merchantIdentity.appId) {
      return '微信支付 AppID 与本地配置不一致';
    }

    if (payment.mchId !== merchantIdentity.mchId) {
      return '微信支付商户号与本地配置不一致';
    }

    const currencyMismatch = this.getWechatCurrencyMismatchReason(
      payment.amount,
      paymentIntent,
    );
    if (currencyMismatch) {
      return currencyMismatch;
    }

    if (payment.tradeState === 'SUCCESS') {
      const amountCents = this.getWechatAmountCents(payment.amount);
      if (amountCents == null) {
        return '微信支付成功结果缺少订单金额';
      }

      const expectedCents = this.toCents(paymentIntent.amount);
      if (amountCents !== expectedCents) {
        return '微信支付成功金额与本地订单金额不一致';
      }
    }

    return null;
  }

  private getWechatCurrencyMismatchReason(
    amount: WechatPaymentAmount | null,
    paymentIntent: PaymentIntentProviderSnapshot,
  ) {
    const currency = amount?.currency ?? amount?.payer_currency;
    if (currency && currency !== paymentIntent.currency) {
      return '微信支付币种与本地支付意图不一致';
    }

    if (paymentIntent.currency !== paymentIntent.booking.currency) {
      return '本地支付意图币种与预约订单币种不一致';
    }

    return null;
  }

  private getWechatAmountCents(amount: WechatPaymentAmount | null) {
    if (typeof amount?.total === 'number' && Number.isInteger(amount.total)) {
      return amount.total;
    }

    if (
      typeof amount?.payer_total === 'number' &&
      Number.isInteger(amount.payer_total)
    ) {
      return amount.payer_total;
    }

    return null;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
