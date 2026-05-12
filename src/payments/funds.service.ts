import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingExceptionCaseStatus,
  BookingExceptionStatus,
  BookingStatus,
  Currency,
  LedgerStatus,
  PaymentIntentStatus,
  PaymentRefundStatus,
  PaymentStatus,
  PayoutStatus,
  PlatformRole,
  Prisma,
  ReconciliationDifferenceType,
  ReconciliationRunStatus,
  ReconciliationRunType,
  SettlementReadiness,
  TransactionDirection,
  TransactionReferenceType,
  WalletStatus,
  WalletTransactionType,
} from '@prisma/client';
import { WECHAT_MINIAPP_PROVIDER } from '../auth/auth.constants';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BookingPaymentProjector } from './booking-payment-projector.service';
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
import {
  WECHAT_PAY_PROVIDER,
  WECHAT_PAY_REFUND_PROVIDER,
  WECHAT_PAY_TRANSFER_PROVIDER,
} from './payments.constants';
import {
  WechatPayClient,
  WechatRefundNotificationResult,
  WechatRefundResult,
  WechatTransferNotificationResult,
  WechatTransferResult,
} from './wechat-pay.client';

const ACTIVE_REFUND_STATUSES = [
  PaymentRefundStatus.PENDING,
  PaymentRefundStatus.PROCESSING,
  PaymentRefundStatus.SUCCEEDED,
] as readonly PaymentRefundStatus[];

const OPEN_EXCEPTION_STATUSES = [
  BookingExceptionCaseStatus.OPEN,
  BookingExceptionCaseStatus.WAITING_TEACHER,
  BookingExceptionCaseStatus.WAITING_GUARDIAN,
  BookingExceptionCaseStatus.WAITING_ADMIN,
] as readonly BookingExceptionCaseStatus[];

@Injectable()
export class FundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingPaymentProjector: BookingPaymentProjector,
    private readonly wechatPayClient: WechatPayClient,
  ) {}

  async createFullRefund(
    currentUser: AuthenticatedUserContext,
    bookingId: string,
    dto: CreateRefundDto,
  ): Promise<RefundResponseDto> {
    this.assertAdminUser(currentUser);
    const booking = await this.loadBookingForRefund(bookingId);
    this.assertBookingRefundable(booking);

    const outRefundNo = this.buildOutRefundNo(booking.paymentIntent!.id);
    const refund = await this.prisma.paymentRefund.create({
      data: {
        bookingId: booking.id,
        paymentIntentId: booking.paymentIntent!.id,
        outRefundNo,
        amount: booking.paymentIntent!.amount,
        currency: booking.paymentIntent!.currency,
        status: PaymentRefundStatus.PROCESSING,
        reason: dto.reason?.trim() || null,
        requestedByUserId: currentUser.userId,
      },
    });

    try {
      const providerRefund = await this.wechatPayClient.createRefund({
        paymentIntentId: booking.paymentIntent!.id,
        outRefundNo,
        amountCents: this.toCents(refund.amount),
        totalCents: this.toCents(booking.paymentIntent!.amount),
        reason: refund.reason,
      });
      const refreshed = await this.applyRefundProviderResult(
        refund.id,
        providerRefund,
      );
      await this.createAdminAuditLog({
        actorUserId: currentUser.userId,
        action: 'PAYMENT_REFUND_REQUESTED',
        targetType: 'PAYMENT_REFUND',
        targetId: refund.id,
        payload: {
          bookingId,
          outRefundNo,
          providerStatus: providerRefund.status,
        },
      });
      return this.toRefundResponse(refreshed);
    } catch (error) {
      await this.prisma.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: PaymentRefundStatus.PROCESSING,
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async reconcileRefund(
    currentUser: AuthenticatedUserContext,
    refundId: string,
  ): Promise<RefundResponseDto> {
    this.assertAdminUser(currentUser);
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
    });
    if (!refund) {
      throw new NotFoundException(`未找到退款单：${refundId}`);
    }

    const providerRefund = await this.wechatPayClient.queryRefund(
      refund.outRefundNo,
    );
    const refreshed = await this.applyRefundProviderResult(
      refund.id,
      providerRefund,
    );
    await this.createAdminAuditLog({
      actorUserId: currentUser.userId,
      action: 'PAYMENT_REFUND_RECONCILED',
      targetType: 'PAYMENT_REFUND',
      targetId: refund.id,
      payload: {
        outRefundNo: refund.outRefundNo,
        providerStatus: providerRefund.status,
      },
    });
    return this.toRefundResponse(refreshed);
  }

  async handleWechatRefundNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }) {
    const notification = this.wechatPayClient.parseRefundNotification(input);
    const headersDigest = this.wechatPayClient.computeHeadersDigest(
      input.headers,
      input.rawBody,
    );
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { outRefundNo: notification.outRefundNo },
    });

    let rejectedReason: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        const event = await tx.paymentProviderEvent.create({
          data: {
            provider: WECHAT_PAY_REFUND_PROVIDER,
            eventId: notification.eventId,
            paymentIntentId: refund?.paymentIntentId ?? null,
            headersDigest,
            payload: notification.rawEnvelope as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        if (!refund) {
          await tx.paymentProviderEvent.update({
            where: { id: event.id },
            data: {
              processedAt: new Date(),
              processResult: 'REFUND_NOT_FOUND',
            },
          });
          return;
        }

        rejectedReason = this.getRefundMismatchReason(notification, refund);
        if (rejectedReason) {
          await tx.paymentProviderEvent.update({
            where: { id: event.id },
            data: {
              processedAt: new Date(),
              processResult: `REJECTED:${rejectedReason}`,
            },
          });
          return;
        }

        await this.applyRefundProviderResultTx(tx, refund.id, notification);
        await tx.paymentProviderEvent.update({
          where: { id: event.id },
          data: {
            processedAt: new Date(),
            processResult: `APPLIED:${notification.status}`,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return {
          code: 'SUCCESS',
          message: 'Duplicate refund notification ignored',
        };
      }
      throw error;
    }

    if (rejectedReason) {
      throw new BadRequestException(rejectedReason);
    }

    return { code: 'SUCCESS', message: 'OK' };
  }

  async settleBooking(
    currentUser: AuthenticatedUserContext,
    bookingId: string,
  ): Promise<WalletTransactionResponseDto> {
    this.assertAdminUser(currentUser);
    const transaction = await this.settleBookingTx(
      bookingId,
      currentUser.userId,
    );
    await this.createAdminAuditLog({
      actorUserId: currentUser.userId,
      action: 'BOOKING_SETTLED_TO_TEACHER_WALLET',
      targetType: 'BOOKING',
      targetId: bookingId,
      payload: { walletTransactionId: transaction.id },
    });
    return this.toWalletTransactionResponse(transaction);
  }

  async settleReadyBookings(limit = 50) {
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        settlementReadiness: SettlementReadiness.READY,
        exceptionStatus: BookingExceptionStatus.NONE,
        paymentIntent: { status: PaymentIntentStatus.SUCCEEDED },
        paymentRefunds: {
          none: { status: { in: [...ACTIVE_REFUND_STATUSES] } },
        },
        exceptionCases: {
          none: { status: { in: [...OPEN_EXCEPTION_STATUSES] } },
        },
        walletTransactions: {
          none: {
            type: WalletTransactionType.BOOKING_PAYMENT,
            status: LedgerStatus.SETTLED,
          },
        },
      },
      select: { id: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });

    for (const candidate of candidates) {
      await this.settleBookingTx(candidate.id, null);
    }
  }

  async getMyWallet(
    currentUser: AuthenticatedUserContext,
  ): Promise<WalletSummaryResponseDto> {
    this.assertTeacherUser(currentUser);
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerUserId: currentUser.userId },
    });
    if (!wallet) {
      return {
        walletId: '',
        availableBalance: 0,
        lockedBalance: 0,
        status: WalletStatus.ACTIVE,
      };
    }
    return this.toWalletSummaryResponse(wallet);
  }

  async listMyWalletTransactions(
    currentUser: AuthenticatedUserContext,
  ): Promise<WalletTransactionResponseDto[]> {
    this.assertTeacherUser(currentUser);
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerUserId: currentUser.userId },
      select: { id: true },
    });
    if (!wallet) {
      return [];
    }

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
    return transactions.map((item) => this.toWalletTransactionResponse(item));
  }

  async createPayout(
    currentUser: AuthenticatedUserContext,
    dto: CreatePayoutDto,
  ): Promise<PayoutResponseDto> {
    this.assertTeacherUser(currentUser);
    const teacherProfile = await this.loadCurrentTeacherProfile(currentUser);
    const amount = this.toDecimal(dto.amount);
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerUserId: currentUser.userId },
    });
    if (!wallet || wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('当前老师钱包不可提现');
    }
    if (new Prisma.Decimal(wallet.availableBalance).lt(amount)) {
      throw new BadRequestException('钱包可用余额不足');
    }

    const payoutAccount = await this.ensureWechatPayoutAccount(
      teacherProfile.id,
    );
    const payout = await this.prisma.payout.create({
      data: {
        teacherProfileId: teacherProfile.id,
        walletId: wallet.id,
        payoutAccountId: payoutAccount.id,
        amount,
        currency: wallet.currency,
        status: PayoutStatus.PENDING,
      },
    });
    return this.toPayoutResponse(payout);
  }

  async listMyPayouts(
    currentUser: AuthenticatedUserContext,
  ): Promise<PayoutResponseDto[]> {
    this.assertTeacherUser(currentUser);
    const teacherProfile = await this.loadCurrentTeacherProfile(currentUser);
    const payouts = await this.prisma.payout.findMany({
      where: { teacherProfileId: teacherProfile.id },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
    return payouts.map((item) => this.toPayoutResponse(item));
  }

  async approvePayout(
    currentUser: AuthenticatedUserContext,
    payoutId: string,
  ): Promise<PayoutResponseDto> {
    this.assertAdminUser(currentUser);
    if (process.env.WECHAT_PAY_TRANSFER_ENABLED !== 'true') {
      throw new ServiceUnavailableException('微信商家转账尚未启用');
    }
    if (
      !process.env.WECHAT_PAY_TRANSFER_SCENE_ID?.trim() ||
      !process.env.WECHAT_PAY_TRANSFER_NOTIFY_URL?.trim()
    ) {
      throw new ServiceUnavailableException('微信商家转账配置不完整');
    }

    const locked = await this.lockPayoutForTransfer(
      payoutId,
      currentUser.userId,
    );
    const transfer = await this.wechatPayClient.createTransfer({
      outBillNo: locked.outBillNo!,
      openId: this.unwrapWechatPayoutToken(locked.payoutAccount.accountToken),
      amountCents: this.toCents(locked.amount),
      remark: 'TuneTime课酬提现',
      userName: locked.teacherProfile.user.realNameVerifiedName,
    });

    const updated = await this.applyPayoutTransferResult(payoutId, transfer);
    await this.createAdminAuditLog({
      actorUserId: currentUser.userId,
      action: 'PAYOUT_APPROVED_AND_TRANSFERRED',
      targetType: 'PAYOUT',
      targetId: payoutId,
      payload: {
        outBillNo: locked.outBillNo,
        transferState: transfer.state,
      },
    });
    return this.toPayoutResponse(updated);
  }

  async rejectPayout(
    currentUser: AuthenticatedUserContext,
    payoutId: string,
    dto: RejectPayoutDto,
  ): Promise<PayoutResponseDto> {
    this.assertAdminUser(currentUser);
    const current = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: { status: true },
    });
    if (!current) {
      throw new NotFoundException(`未找到提现单：${payoutId}`);
    }
    if (current.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('只有待审核提现单可以拒绝');
    }
    const payout = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.CANCELLED,
        failureReason: dto.reason.trim(),
        processedAt: new Date(),
      },
    });
    await this.createAdminAuditLog({
      actorUserId: currentUser.userId,
      action: 'PAYOUT_REJECTED',
      targetType: 'PAYOUT',
      targetId: payoutId,
      payload: { reason: dto.reason.trim() },
    });
    return this.toPayoutResponse(payout);
  }

  async reconcilePayout(
    currentUser: AuthenticatedUserContext,
    payoutId: string,
  ): Promise<PayoutResponseDto> {
    this.assertAdminUser(currentUser);
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });
    if (!payout?.outBillNo) {
      throw new BadRequestException('提现单尚未发起微信转账');
    }

    const transfer = await this.wechatPayClient.queryTransferByOutBillNo(
      payout.outBillNo,
    );
    const updated = await this.applyPayoutTransferResult(payout.id, transfer);
    await this.createAdminAuditLog({
      actorUserId: currentUser.userId,
      action: 'PAYOUT_RECONCILED',
      targetType: 'PAYOUT',
      targetId: payoutId,
      payload: {
        outBillNo: payout.outBillNo,
        transferState: transfer.state,
      },
    });
    return this.toPayoutResponse(updated);
  }

  async handleWechatTransferNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }) {
    const notification = this.wechatPayClient.parseTransferNotification(input);
    const headersDigest = this.wechatPayClient.computeHeadersDigest(
      input.headers,
      input.rawBody,
    );
    const payout = await this.prisma.payout.findUnique({
      where: { outBillNo: notification.outBillNo },
    });
    let rejectedReason: string | null = null;

    try {
      await this.prisma.$transaction(async (tx) => {
        const event = await tx.paymentProviderEvent.create({
          data: {
            provider: WECHAT_PAY_TRANSFER_PROVIDER,
            eventId: notification.eventId,
            paymentIntentId: null,
            headersDigest,
            payload: notification.rawEnvelope as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        if (!payout) {
          await tx.paymentProviderEvent.update({
            where: { id: event.id },
            data: {
              processedAt: new Date(),
              processResult: 'PAYOUT_NOT_FOUND',
            },
          });
          return;
        }

        rejectedReason = this.getTransferMismatchReason(notification);
        if (rejectedReason) {
          await tx.paymentProviderEvent.update({
            where: { id: event.id },
            data: {
              processedAt: new Date(),
              processResult: `REJECTED:${rejectedReason}`,
            },
          });
          return;
        }

        await this.applyPayoutTransferResultTx(tx, payout.id, {
          outBillNo: notification.outBillNo,
          transferBillNo: notification.transferBillNo,
          state: notification.state,
          packageInfo: null,
          failReason: notification.failReason,
          raw: notification.resource,
        });
        await tx.paymentProviderEvent.update({
          where: { id: event.id },
          data: {
            processedAt: new Date(),
            processResult: `APPLIED:${notification.state}`,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return {
          code: 'SUCCESS',
          message: 'Duplicate transfer notification ignored',
        };
      }
      throw error;
    }

    if (rejectedReason) {
      throw new BadRequestException(rejectedReason);
    }

    return { code: 'SUCCESS', message: 'OK' };
  }

  async createWechatReconciliationRun(
    currentUser: AuthenticatedUserContext,
    dto: CreateWechatReconciliationRunDto,
  ): Promise<ReconciliationRunResponseDto> {
    this.assertAdminUser(currentUser);
    const billDate = this.parseBillDate(dto.billDate);
    const type =
      dto.runType === ReconciliationRunType.WECHAT_REFUND_BILL
        ? 'refund'
        : 'trade';
    const bill = await this.wechatPayClient.applyBill({
      billDate: dto.billDate,
      type,
    });
    const run = await this.prisma.reconciliationRun.upsert({
      where: {
        provider_runType_billDate: {
          provider: WECHAT_PAY_PROVIDER,
          runType: dto.runType,
          billDate,
        },
      },
      create: {
        provider: WECHAT_PAY_PROVIDER,
        runType: dto.runType,
        billDate,
        status: ReconciliationRunStatus.PROCESSING,
        hashType: bill.hashType,
        hashValue: bill.hashValue,
        downloadUrl: bill.downloadUrl,
        createdByUserId: currentUser.userId,
        startedAt: new Date(),
      },
      update: {
        status: ReconciliationRunStatus.PROCESSING,
        failureReason: null,
        hashType: bill.hashType,
        hashValue: bill.hashValue,
        downloadUrl: bill.downloadUrl,
        createdByUserId: currentUser.userId,
        startedAt: new Date(),
        completedAt: null,
      },
    });
    await this.prisma.reconciliationDifference.deleteMany({
      where: { runId: run.id },
    });

    try {
      const csv = await this.wechatPayClient.downloadBill({
        downloadUrl: bill.downloadUrl,
        hashType: bill.hashType,
        hashValue: bill.hashValue,
      });
      const rows = this.parseWechatBillCsv(csv);
      const differences =
        dto.runType === ReconciliationRunType.WECHAT_REFUND_BILL
          ? await this.buildRefundBillDifferences(rows)
          : await this.buildTradeBillDifferences(rows);

      if (differences.length) {
        await this.prisma.reconciliationDifference.createMany({
          data: differences.map((item) => ({
            ...item,
            runId: run.id,
          })),
        });
      }

      const refreshed = await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: ReconciliationRunStatus.SUCCEEDED,
          completedAt: new Date(),
          metadata: {
            rowCount: rows.length,
          },
        },
        include: { _count: { select: { differences: true } } },
      });
      return this.toReconciliationRunResponse(refreshed);
    } catch (error) {
      const refreshed = await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: ReconciliationRunStatus.FAILED,
          completedAt: new Date(),
          failureReason: error instanceof Error ? error.message : String(error),
        },
        include: { _count: { select: { differences: true } } },
      });
      return this.toReconciliationRunResponse(refreshed);
    }
  }

  private async applyRefundProviderResult(
    refundId: string,
    providerRefund: WechatRefundResult | WechatRefundNotificationResult,
  ) {
    return this.prisma.$transaction((tx) =>
      this.applyRefundProviderResultTx(tx, refundId, providerRefund),
    );
  }

  private async applyRefundProviderResultTx(
    tx: Prisma.TransactionClient,
    refundId: string,
    providerRefund: WechatRefundResult | WechatRefundNotificationResult,
  ) {
    const refund = await tx.paymentRefund.findUniqueOrThrow({
      where: { id: refundId },
      include: { paymentIntent: true, booking: true },
    });
    const mismatchReason = this.getRefundMismatchReason(providerRefund, refund);
    if (mismatchReason) {
      throw new BadRequestException(mismatchReason);
    }

    const status = this.mapRefundStatus(providerRefund.status);
    const updated = await tx.paymentRefund.update({
      where: { id: refund.id },
      data: {
        status,
        providerRefundId: providerRefund.providerRefundId,
        providerMetadata: ('raw' in providerRefund
          ? providerRefund.raw
          : providerRefund.resource) as Prisma.InputJsonValue,
        processedAt:
          status === PaymentRefundStatus.SUCCEEDED ||
          status === PaymentRefundStatus.FAILED ||
          status === PaymentRefundStatus.CANCELLED
            ? new Date()
            : null,
        failureReason:
          status === PaymentRefundStatus.FAILED
            ? '微信退款异常，请人工处理'
            : null,
      },
    });

    if (status === PaymentRefundStatus.SUCCEEDED) {
      await this.bookingPaymentProjector.applyPaymentStateTx(tx, {
        paymentIntentId: refund.paymentIntentId,
        status: PaymentIntentStatus.REFUNDED,
        providerPaymentId: refund.paymentIntent.providerPaymentId,
        providerMetadata: ('raw' in providerRefund
          ? providerRefund.raw
          : providerRefund.resource) as Prisma.InputJsonValue,
        failedReason: null,
        capturedAt: refund.paymentIntent.capturedAt,
      });
    }

    return updated;
  }

  private async settleBookingTx(bookingId: string, actorUserId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          teacherProfile: { select: { userId: true } },
          paymentIntent: true,
          paymentRefunds: true,
          exceptionCases: true,
          walletTransactions: {
            where: {
              type: WalletTransactionType.BOOKING_PAYMENT,
              status: LedgerStatus.SETTLED,
            },
          },
        },
      });
      if (!booking) {
        throw new NotFoundException(`未找到预约：${bookingId}`);
      }
      this.assertBookingSettleable(booking);

      const settlementAmount = new Prisma.Decimal(booking.totalAmount).minus(
        booking.platformFeeAmount,
      );
      if (settlementAmount.lte(0)) {
        throw new BadRequestException('老师可结算金额必须大于 0');
      }

      const wallet = await tx.wallet.upsert({
        where: { ownerUserId: booking.teacherProfile.userId },
        create: {
          ownerUserId: booking.teacherProfile.userId,
          currency: booking.currency,
          availableBalance: new Prisma.Decimal(0),
          lockedBalance: new Prisma.Decimal(0),
          status: WalletStatus.ACTIVE,
        },
        update: {},
      });

      let walletTransaction;
      try {
        walletTransaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.BOOKING_PAYMENT,
            status: LedgerStatus.SETTLED,
            direction: TransactionDirection.IN,
            amount: settlementAmount,
            balanceAfter: null,
            referenceType: TransactionReferenceType.BOOKING,
            referenceId: booking.id,
            bookingId: booking.id,
            paymentIntentId: booking.paymentIntent!.id,
            createdByUserId: actorUserId,
            metadata: {
              totalAmount: booking.totalAmount.toString(),
              platformFeeAmount: booking.platformFeeAmount.toString(),
            },
          },
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          return tx.walletTransaction.findFirstOrThrow({
            where: {
              walletId: wallet.id,
              bookingId: booking.id,
              type: WalletTransactionType.BOOKING_PAYMENT,
            },
          });
        }
        throw error;
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: settlementAmount },
        },
      });

      return tx.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: {
          balanceAfter: updatedWallet.availableBalance,
        },
      });
    });
  }

  private async lockPayoutForTransfer(payoutId: string, actorUserId: string) {
    const outBillNo = this.buildOutBillNo(payoutId);
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        include: {
          wallet: true,
          payoutAccount: true,
          teacherProfile: {
            include: {
              user: {
                select: {
                  realNameVerifiedName: true,
                },
              },
            },
          },
        },
      });
      if (!payout) {
        throw new NotFoundException(`未找到提现单：${payoutId}`);
      }
      if (payout.status !== PayoutStatus.PENDING) {
        throw new BadRequestException('只有待审核提现单可以审核通过');
      }
      if (!payout.wallet) {
        throw new BadRequestException('提现单缺少钱包');
      }
      if (
        this.toCents(payout.amount) >= 200_000 &&
        !payout.teacherProfile.user.realNameVerifiedName
      ) {
        throw new BadRequestException('大额微信商家转账需要老师实名姓名');
      }

      const updated = await tx.wallet.updateMany({
        where: {
          id: payout.wallet.id,
          availableBalance: { gte: payout.amount },
          status: WalletStatus.ACTIVE,
        },
        data: {
          availableBalance: { decrement: payout.amount },
          lockedBalance: { increment: payout.amount },
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('钱包可用余额不足或状态不可提现');
      }
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { id: payout.wallet.id },
      });
      await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.APPROVED,
          outBillNo,
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.WITHDRAW,
          status: LedgerStatus.PENDING,
          direction: TransactionDirection.OUT,
          amount: payout.amount,
          balanceAfter: wallet.availableBalance,
          referenceType: TransactionReferenceType.PAYOUT,
          referenceId: payout.id,
          payoutId: payout.id,
          createdByUserId: actorUserId,
          metadata: {
            outBillNo,
          },
        },
      });

      return {
        ...payout,
        outBillNo,
      };
    });
  }

  private async applyPayoutTransferResult(
    payoutId: string,
    transfer: WechatTransferResult,
  ) {
    return this.prisma.$transaction((tx) =>
      this.applyPayoutTransferResultTx(tx, payoutId, transfer),
    );
  }

  private async applyPayoutTransferResultTx(
    tx: Prisma.TransactionClient,
    payoutId: string,
    transfer: WechatTransferResult,
  ) {
    const payout = await tx.payout.findUniqueOrThrow({
      where: { id: payoutId },
      include: { wallet: true },
    });
    if (
      payout.status === PayoutStatus.PAID ||
      payout.status === PayoutStatus.FAILED ||
      payout.status === PayoutStatus.CANCELLED
    ) {
      return payout;
    }
    if (payout.outBillNo && transfer.outBillNo !== payout.outBillNo) {
      throw new BadRequestException('微信商家转账单号与本地提现单不一致');
    }

    const status = this.mapTransferState(transfer.state);
    const finalStatus =
      status === PayoutStatus.PAID ||
      status === PayoutStatus.FAILED ||
      status === PayoutStatus.CANCELLED;
    const updated = await tx.payout.update({
      where: { id: payout.id },
      data: {
        status,
        outBillNo: transfer.outBillNo,
        transferBillNo: transfer.transferBillNo,
        transactionId: transfer.transferBillNo,
        transferState: transfer.state,
        packageInfo: transfer.packageInfo,
        providerMetadata: transfer.raw as Prisma.InputJsonValue,
        failureReason:
          status === PayoutStatus.FAILED || status === PayoutStatus.CANCELLED
            ? (transfer.failReason ?? '微信商家转账失败或取消')
            : null,
        processedAt: finalStatus ? new Date() : null,
      },
    });

    if (finalStatus && payout.walletId) {
      if (status === PayoutStatus.PAID) {
        await tx.wallet.update({
          where: { id: payout.walletId },
          data: { lockedBalance: { decrement: payout.amount } },
        });
        await tx.walletTransaction.updateMany({
          where: { payoutId: payout.id, status: LedgerStatus.PENDING },
          data: { status: LedgerStatus.SETTLED },
        });
      } else {
        const wallet = await tx.wallet.update({
          where: { id: payout.walletId },
          data: {
            availableBalance: { increment: payout.amount },
            lockedBalance: { decrement: payout.amount },
          },
        });
        await tx.walletTransaction.updateMany({
          where: { payoutId: payout.id, status: LedgerStatus.PENDING },
          data: {
            status: LedgerStatus.REVERSED,
            balanceAfter: wallet.availableBalance,
          },
        });
      }
    }

    return updated;
  }

  private async loadBookingForRefund(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentIntent: true,
        paymentRefunds: true,
        walletTransactions: {
          where: {
            type: WalletTransactionType.BOOKING_PAYMENT,
            status: LedgerStatus.SETTLED,
          },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException(`未找到预约：${bookingId}`);
    }
    return booking;
  }

  private assertBookingRefundable(
    booking: Awaited<ReturnType<FundsService['loadBookingForRefund']>>,
  ) {
    if (!booking.paymentIntent) {
      throw new BadRequestException('当前预约尚未生成支付意图');
    }
    if (booking.paymentIntent.status !== PaymentIntentStatus.SUCCEEDED) {
      throw new BadRequestException('只有已支付订单可以退款');
    }
    if (booking.walletTransactions.length > 0) {
      throw new BadRequestException(
        '订单已结算入老师钱包，不能走未结算全额退款',
      );
    }
    if (
      booking.paymentRefunds.some((refund) =>
        ACTIVE_REFUND_STATUSES.includes(refund.status),
      )
    ) {
      throw new BadRequestException('当前预约已有退款处理中或已退款');
    }
  }

  private assertBookingSettleable(booking: any) {
    if (!booking) {
      throw new NotFoundException('未找到预约');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('只有已完成预约可以结算');
    }
    if (booking.settlementReadiness !== SettlementReadiness.READY) {
      throw new BadRequestException('当前预约未达到结算条件');
    }
    if (booking.exceptionStatus !== BookingExceptionStatus.NONE) {
      throw new BadRequestException('当前预约存在异常，不能结算');
    }
    if (
      !booking.paymentIntent ||
      booking.paymentIntent.status !== PaymentIntentStatus.SUCCEEDED
    ) {
      throw new BadRequestException('当前预约未完成支付，不能结算');
    }
    if (
      booking.paymentRefunds.some((refund) =>
        ACTIVE_REFUND_STATUSES.includes(refund.status),
      )
    ) {
      throw new BadRequestException('当前预约存在退款，不能结算');
    }
    if (
      booking.exceptionCases.some((item) =>
        OPEN_EXCEPTION_STATUSES.includes(item.status),
      )
    ) {
      throw new BadRequestException('当前预约存在未关闭异常工单，不能结算');
    }
    if (booking.walletTransactions.length > 0) {
      throw new BadRequestException('当前预约已经结算入账');
    }
  }

  private async loadCurrentTeacherProfile(
    currentUser: AuthenticatedUserContext,
  ) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: currentUser.userId },
      include: { user: true },
    });
    if (!teacherProfile) {
      throw new NotFoundException('当前老师资料不存在');
    }
    return teacherProfile;
  }

  private async ensureWechatPayoutAccount(teacherProfileId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
      select: { userId: true, displayName: true },
    });
    const account = await this.prisma.account.findFirst({
      where: {
        userId: teacherProfile.userId,
        provider: WECHAT_MINIAPP_PROVIDER,
        openId: { not: null },
      },
    });
    if (!account?.openId) {
      throw new BadRequestException(
        '老师账号尚未绑定微信小程序 openid，不能提现',
      );
    }

    const accountToken = `wechat:${account.openId}`;
    return this.prisma.teacherPayoutAccount.upsert({
      where: {
        teacherProfileId_accountToken: {
          teacherProfileId,
          accountToken,
        },
      },
      create: {
        teacherProfileId,
        accountType: 'WECHAT',
        accountName: teacherProfile.displayName,
        accountNoMasked: this.maskOpenId(account.openId),
        accountToken,
        isDefault: true,
        isVerified: true,
      },
      update: {
        accountName: teacherProfile.displayName,
        accountNoMasked: this.maskOpenId(account.openId),
        isDefault: true,
        isVerified: true,
      },
    });
  }

  private async buildTradeBillDifferences(rows: Record<string, string>[]) {
    const differences: Prisma.ReconciliationDifferenceCreateManyInput[] = [];
    for (const row of rows) {
      const outTradeNo =
        this.pick(row, ['商户订单号', 'out_trade_no'])?.trim() || null;
      if (!outTradeNo) {
        continue;
      }

      const paymentIntent = await this.prisma.paymentIntent.findUnique({
        where: { id: outTradeNo },
      });
      if (!paymentIntent) {
        differences.push(
          this.buildDifference(
            ReconciliationDifferenceType.MISSING_LOCAL,
            'PAYMENT_INTENT',
            outTradeNo,
            '微信交易账单存在本地不存在的支付单',
            null,
            row,
          ),
        );
        continue;
      }

      const providerAmount = this.parseYuanAmount(
        this.pick(row, ['订单金额(元)', '总金额', '订单金额']),
      );
      if (
        providerAmount &&
        !new Prisma.Decimal(paymentIntent.amount).equals(providerAmount)
      ) {
        differences.push(
          this.buildDifference(
            ReconciliationDifferenceType.AMOUNT_MISMATCH,
            'PAYMENT_INTENT',
            outTradeNo,
            '微信交易账单金额与本地支付金额不一致',
            {
              amount: paymentIntent.amount.toString(),
              status: paymentIntent.status,
            },
            row,
          ),
        );
      }
    }
    return differences;
  }

  private async buildRefundBillDifferences(rows: Record<string, string>[]) {
    const differences: Prisma.ReconciliationDifferenceCreateManyInput[] = [];
    for (const row of rows) {
      const outRefundNo =
        this.pick(row, ['商户退款单号', 'out_refund_no'])?.trim() || null;
      if (!outRefundNo) {
        continue;
      }
      const refund = await this.prisma.paymentRefund.findUnique({
        where: { outRefundNo },
      });
      if (!refund) {
        differences.push(
          this.buildDifference(
            ReconciliationDifferenceType.MISSING_LOCAL,
            'PAYMENT_REFUND',
            outRefundNo,
            '微信退款账单存在本地不存在的退款单',
            null,
            row,
          ),
        );
        continue;
      }

      const providerAmount = this.parseYuanAmount(
        this.pick(row, ['退款金额(元)', '申请退款金额(元)', '退款金额']),
      );
      if (
        providerAmount &&
        !new Prisma.Decimal(refund.amount).equals(providerAmount)
      ) {
        differences.push(
          this.buildDifference(
            ReconciliationDifferenceType.AMOUNT_MISMATCH,
            'PAYMENT_REFUND',
            outRefundNo,
            '微信退款账单金额与本地退款金额不一致',
            { amount: refund.amount.toString(), status: refund.status },
            row,
          ),
        );
      }
    }
    return differences;
  }

  private buildDifference(
    differenceType: ReconciliationDifferenceType,
    referenceType: string,
    referenceId: string,
    summary: string,
    localPayload: Prisma.InputJsonValue | null,
    providerPayload: Prisma.InputJsonValue | null,
  ): Prisma.ReconciliationDifferenceCreateManyInput {
    return {
      runId: '',
      differenceType,
      referenceType,
      referenceId,
      summary,
      localPayload,
      providerPayload,
    };
  }

  private parseWechatBillCsv(csv: string) {
    const lines = csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const headerIndex = lines.findIndex(
      (line) => line.includes('商户订单号') || line.includes('商户退款单号'),
    );
    if (headerIndex < 0) {
      return [];
    }
    const headers = this.parseCsvLine(lines[headerIndex]).map((item) =>
      this.cleanBillCell(item),
    );
    return lines
      .slice(headerIndex + 1)
      .filter((line) => !line.startsWith('总') && !line.includes('总笔数'))
      .map((line) => {
        const values = this.parseCsvLine(line).map((item) =>
          this.cleanBillCell(item),
        );
        return headers.reduce<Record<string, string>>((acc, header, index) => {
          acc[header] = values[index] ?? '';
          return acc;
        }, {});
      });
  }

  private parseCsvLine(line: string) {
    const values: string[] = [];
    let current = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === ',' && !quoted) {
        values.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current);
    return values;
  }

  private cleanBillCell(value: string) {
    return value.replace(/^`/, '').trim();
  }

  private parseYuanAmount(value?: string | null) {
    if (!value) {
      return null;
    }
    const normalized = value.replace(/[^\d.-]/g, '');
    if (!normalized) {
      return null;
    }
    return new Prisma.Decimal(normalized);
  }

  private pick(row: Record<string, string>, keys: string[]) {
    for (const key of keys) {
      if (row[key]) {
        return row[key];
      }
    }
    return null;
  }

  private getRefundMismatchReason(
    refundResult: WechatRefundResult | WechatRefundNotificationResult,
    refund: {
      outRefundNo: string;
      paymentIntentId: string;
      amount: Prisma.Decimal;
      currency: Currency;
    },
  ) {
    if (refundResult.outRefundNo !== refund.outRefundNo) {
      return '微信退款单号与本地退款单不一致';
    }
    if (
      refundResult.paymentIntentId &&
      refundResult.paymentIntentId !== refund.paymentIntentId
    ) {
      return '微信退款关联支付单与本地支付单不一致';
    }
    if ('mchId' in refundResult) {
      const merchantIdentity = this.wechatPayClient.getMerchantIdentity();
      if (refundResult.mchId !== merchantIdentity.mchId) {
        return '微信退款商户号与本地配置不一致';
      }
    }
    const amountCents = refundResult.amount?.refund;
    if (
      typeof amountCents === 'number' &&
      amountCents !== this.toCents(refund.amount)
    ) {
      return '微信退款金额与本地退款金额不一致';
    }
    if (
      refundResult.amount?.currency &&
      refundResult.amount.currency !== refund.currency
    ) {
      return '微信退款币种与本地退款单不一致';
    }
    return null;
  }

  private getTransferMismatchReason(
    notification: WechatTransferNotificationResult,
  ) {
    const merchantIdentity = this.wechatPayClient.getMerchantIdentity();
    if (notification.mchId && notification.mchId !== merchantIdentity.mchId) {
      return '微信商家转账商户号与本地配置不一致';
    }
    return null;
  }

  private mapRefundStatus(status: string): PaymentRefundStatus {
    switch (status) {
      case 'SUCCESS':
        return PaymentRefundStatus.SUCCEEDED;
      case 'PROCESSING':
        return PaymentRefundStatus.PROCESSING;
      case 'CLOSED':
        return PaymentRefundStatus.CANCELLED;
      case 'ABNORMAL':
        return PaymentRefundStatus.FAILED;
      default:
        return PaymentRefundStatus.PROCESSING;
    }
  }

  private mapTransferState(state: string): PayoutStatus {
    switch (state) {
      case 'SUCCESS':
        return PayoutStatus.PAID;
      case 'FAIL':
        return PayoutStatus.FAILED;
      case 'CANCELLED':
        return PayoutStatus.CANCELLED;
      case 'WAIT_USER_CONFIRM':
      case 'ACCEPTED':
      case 'PROCESSING':
      case 'TRANSFERING':
      case 'CANCELING':
      default:
        return PayoutStatus.PROCESSING;
    }
  }

  private toRefundResponse(refund: {
    id: string;
    bookingId: string;
    paymentIntentId: string;
    outRefundNo: string;
    providerRefundId: string | null;
    amount: Prisma.Decimal;
    status: PaymentRefundStatus;
    failureReason: string | null;
  }): RefundResponseDto {
    return {
      id: refund.id,
      bookingId: refund.bookingId,
      paymentIntentId: refund.paymentIntentId,
      outRefundNo: refund.outRefundNo,
      providerRefundId: refund.providerRefundId,
      amount: this.toNumber(refund.amount),
      status: refund.status,
      failureReason: refund.failureReason,
    };
  }

  private toWalletSummaryResponse(wallet: {
    id: string;
    availableBalance: Prisma.Decimal;
    lockedBalance: Prisma.Decimal;
    status: WalletStatus;
  }): WalletSummaryResponseDto {
    return {
      walletId: wallet.id,
      availableBalance: this.toNumber(wallet.availableBalance),
      lockedBalance: this.toNumber(wallet.lockedBalance),
      status: wallet.status,
    };
  }

  private toWalletTransactionResponse(transaction: {
    id: string;
    type: WalletTransactionType;
    status: LedgerStatus;
    direction: TransactionDirection;
    amount: Prisma.Decimal;
    balanceAfter: Prisma.Decimal | null;
    occurredAt: Date;
  }): WalletTransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      direction: transaction.direction,
      amount: this.toNumber(transaction.amount),
      balanceAfter: transaction.balanceAfter
        ? this.toNumber(transaction.balanceAfter)
        : null,
      occurredAt: transaction.occurredAt,
    };
  }

  private toPayoutResponse(payout: {
    id: string;
    amount: Prisma.Decimal;
    status: PayoutStatus;
    outBillNo: string | null;
    transferBillNo: string | null;
    transferState: string | null;
    packageInfo: string | null;
    failureReason: string | null;
  }): PayoutResponseDto {
    return {
      id: payout.id,
      amount: this.toNumber(payout.amount),
      status: payout.status,
      outBillNo: payout.outBillNo,
      transferBillNo: payout.transferBillNo,
      transferState: payout.transferState,
      packageInfo: payout.packageInfo,
      failureReason: payout.failureReason,
    };
  }

  private toReconciliationRunResponse(run: {
    id: string;
    runType: ReconciliationRunType;
    billDate: Date;
    status: ReconciliationRunStatus;
    failureReason: string | null;
    _count: { differences: number };
  }): ReconciliationRunResponseDto {
    return {
      id: run.id,
      runType: run.runType,
      billDate: run.billDate,
      status: run.status,
      differenceCount: run._count.differences,
      failureReason: run.failureReason,
    };
  }

  private async createAdminAuditLog(input: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    payload?: Prisma.InputJsonValue;
  }) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        payload: input.payload,
      },
    });
  }

  private assertAdminUser(currentUser: AuthenticatedUserContext) {
    if (
      currentUser.activeRole !== PlatformRole.ADMIN &&
      currentUser.activeRole !== PlatformRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('只有后台管理员可以执行该资金操作');
    }
  }

  private assertTeacherUser(currentUser: AuthenticatedUserContext) {
    if (currentUser.activeRole !== PlatformRole.TEACHER) {
      throw new ForbiddenException('只有老师可以访问钱包或提现');
    }
  }

  private toDecimal(amount: number) {
    const decimal = new Prisma.Decimal(amount.toFixed(2));
    if (decimal.lte(0)) {
      throw new BadRequestException('金额必须大于 0');
    }
    return decimal;
  }

  private toCents(amount: Prisma.Decimal | { toString(): string }) {
    const normalized = amount.toString().trim();
    const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      throw new BadRequestException('金额格式非法');
    }
    return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  }

  private toNumber(amount: Prisma.Decimal | { toString(): string }) {
    return Number(amount.toString());
  }

  private buildOutRefundNo(paymentIntentId: string) {
    return `RF${Date.now()}${paymentIntentId.replace(/[^0-9A-Za-z]/g, '').slice(-12)}`.slice(
      0,
      64,
    );
  }

  private buildOutBillNo(payoutId: string) {
    return `PO${Date.now()}${payoutId.replace(/[^0-9A-Za-z]/g, '').slice(-12)}`.slice(
      0,
      32,
    );
  }

  private unwrapWechatPayoutToken(accountToken: string) {
    if (!accountToken.startsWith('wechat:')) {
      throw new BadRequestException('提现账户不是微信账户');
    }
    return accountToken.slice('wechat:'.length);
  }

  private maskOpenId(openId: string) {
    if (openId.length <= 10) {
      return `${openId.slice(0, 2)}***`;
    }
    return `${openId.slice(0, 6)}***${openId.slice(-4)}`;
  }

  private parseBillDate(input: string) {
    const match = input.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!match) {
      throw new BadRequestException('账单日期必须是 YYYY-MM-DD');
    }
    return new Date(`${input}T00:00:00.000Z`);
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
