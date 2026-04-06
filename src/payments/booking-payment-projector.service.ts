import { Injectable } from '@nestjs/common';
import {
  BookingCancellationReason,
  BookingStatus,
  Currency,
  PaymentIntentStatus,
  PaymentStatus,
  Prisma,
  SettlementReadiness,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WECHAT_PAY_PROVIDER } from './payments.constants';

type TxClient = Prisma.TransactionClient;

type PaymentProjectionRecord = {
  id: string;
  bookingId: string;
  payerUserId: string;
  amount: Prisma.Decimal;
  currency: Currency;
  status: PaymentIntentStatus;
  provider: string | null;
  providerPaymentId: string | null;
  expiresAt: Date | null;
  providerPrepayId: string | null;
  prepayExpiresAt: Date | null;
  providerMetadata: Prisma.JsonValue | null;
  lastNotifiedAt: Date | null;
  capturedAt: Date | null;
  failedReason: string | null;
  booking: {
    id: string;
    teacherProfileId: string;
    studentProfileId: string;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    settlementReadiness: SettlementReadiness;
  };
};

type ApplyPaymentStateInput = {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  providerPaymentId?: string | null;
  providerPrepayId?: string | null;
  prepayExpiresAt?: Date | null;
  providerMetadata?: Prisma.InputJsonValue;
  failedReason?: string | null;
  lastNotifiedAt?: Date | null;
  capturedAt?: Date | null;
  expiresAt?: Date | null;
  provider?: string | null;
  bookingCancellationReason?: BookingCancellationReason | null;
  bookingCancelledAt?: Date | null;
  bookingCancelledByUserId?: string | null;
  bookingStatusRemark?: string | null;
};

@Injectable()
export class BookingPaymentProjector {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePaymentIntentForBookingTx(
    tx: TxClient,
    input: {
      bookingId: string;
      payerUserId: string;
      amount: Prisma.Decimal | number | string;
      currency: Currency;
      expiresAt: Date | null;
    },
  ) {
    return tx.paymentIntent.upsert({
      where: { bookingId: input.bookingId },
      create: {
        bookingId: input.bookingId,
        payerUserId: input.payerUserId,
        amount: input.amount,
        currency: input.currency,
        status: PaymentIntentStatus.REQUIRES_PAYMENT,
        provider: WECHAT_PAY_PROVIDER,
        expiresAt: input.expiresAt,
      },
      update: {
        payerUserId: input.payerUserId,
        amount: input.amount,
        currency: input.currency,
        provider: WECHAT_PAY_PROVIDER,
        expiresAt: input.expiresAt,
      },
    });
  }

  async resetPaymentIntentForRetryTx(
    tx: TxClient,
    paymentIntentId: string,
    input: {
      expiresAt: Date | null;
      providerMetadata?: Prisma.InputJsonValue;
    },
  ) {
    return tx.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        status: PaymentIntentStatus.REQUIRES_PAYMENT,
        failedReason: null,
        expiresAt: input.expiresAt,
        providerMetadata: input.providerMetadata,
      },
    });
  }

  async applyPaymentStateTx(tx: TxClient, input: ApplyPaymentStateInput) {
    const current = await this.loadPaymentProjectionRecordTx(
      tx,
      input.paymentIntentId,
    );

    const nextStatus = this.resolveNextStatus(current.status, input.status);
    const updatedIntent = await tx.paymentIntent.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        provider:
          input.provider === undefined ? current.provider : input.provider,
        providerPaymentId:
          input.providerPaymentId === undefined
            ? current.providerPaymentId
            : input.providerPaymentId,
        providerPrepayId:
          input.providerPrepayId === undefined
            ? current.providerPrepayId
            : input.providerPrepayId,
        prepayExpiresAt:
          input.prepayExpiresAt === undefined
            ? current.prepayExpiresAt
            : input.prepayExpiresAt,
        providerMetadata:
          input.providerMetadata === undefined
            ? current.providerMetadata
            : input.providerMetadata,
        failedReason:
          input.failedReason === undefined
            ? current.failedReason
            : input.failedReason,
        lastNotifiedAt:
          input.lastNotifiedAt === undefined
            ? current.lastNotifiedAt
            : input.lastNotifiedAt,
        capturedAt:
          input.capturedAt === undefined
            ? current.capturedAt
            : input.capturedAt,
        expiresAt:
          input.expiresAt === undefined ? current.expiresAt : input.expiresAt,
      },
      include: {
        booking: {
          select: {
            id: true,
            teacherProfileId: true,
            studentProfileId: true,
            status: true,
            paymentStatus: true,
            settlementReadiness: true,
          },
        },
      },
    });

    const bookingUpdate = this.buildBookingProjectionUpdate(
      updatedIntent.status,
      input,
    );
    await tx.booking.update({
      where: { id: updatedIntent.bookingId },
      data: bookingUpdate,
    });

    if (updatedIntent.status === PaymentIntentStatus.SUCCEEDED) {
      await tx.lesson.upsert({
        where: { bookingId: updatedIntent.bookingId },
        update: {},
        create: {
          bookingId: updatedIntent.bookingId,
          teacherProfileId: updatedIntent.booking.teacherProfileId,
          studentProfileId: updatedIntent.booking.studentProfileId,
        },
      });
    }
  }

  private async loadPaymentProjectionRecordTx(
    tx: TxClient,
    paymentIntentId: string,
  ): Promise<PaymentProjectionRecord> {
    return tx.paymentIntent.findUniqueOrThrow({
      where: { id: paymentIntentId },
      include: {
        booking: {
          select: {
            id: true,
            teacherProfileId: true,
            studentProfileId: true,
            status: true,
            paymentStatus: true,
            settlementReadiness: true,
          },
        },
      },
    });
  }

  private resolveNextStatus(
    current: PaymentIntentStatus,
    requested: PaymentIntentStatus,
  ): PaymentIntentStatus {
    if (current === PaymentIntentStatus.REFUNDED) {
      return PaymentIntentStatus.REFUNDED;
    }

    if (current === PaymentIntentStatus.SUCCEEDED) {
      if (requested === PaymentIntentStatus.REFUNDED) {
        return requested;
      }
      return PaymentIntentStatus.SUCCEEDED;
    }

    if (current === PaymentIntentStatus.CANCELLED) {
      if (requested === PaymentIntentStatus.SUCCEEDED) {
        return requested;
      }
      return current;
    }

    return requested;
  }

  private buildBookingProjectionUpdate(
    status: PaymentIntentStatus,
    input: ApplyPaymentStateInput,
  ): Prisma.BookingUpdateInput {
    switch (status) {
      case PaymentIntentStatus.SUCCEEDED:
        return {
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          cancellationReason: null,
          cancelledAt: null,
          cancelledByUser: { disconnect: true },
          settlementReadiness: SettlementReadiness.NOT_READY,
          statusRemark: null,
        };
      case PaymentIntentStatus.REFUNDED:
        return {
          status: BookingStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED,
          settlementReadiness: SettlementReadiness.BLOCKED,
          statusRemark: '支付已退款',
        };
      case PaymentIntentStatus.FAILED:
        return {
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.FAILED,
          statusRemark:
            input.failedReason?.trim() || '支付失败，请重新尝试支付',
        };
      case PaymentIntentStatus.CANCELLED:
        if (input.bookingCancellationReason) {
          return {
            status: BookingStatus.CANCELLED,
            paymentStatus: PaymentStatus.UNPAID,
            cancellationReason: input.bookingCancellationReason,
            cancelledAt: input.bookingCancelledAt ?? new Date(),
            cancelledByUser: input.bookingCancelledByUserId
              ? { connect: { id: input.bookingCancelledByUserId } }
              : { disconnect: true },
            settlementReadiness: SettlementReadiness.BLOCKED,
            statusRemark: input.bookingStatusRemark ?? null,
          };
        }
        return {
          status: BookingStatus.EXPIRED,
          paymentStatus: PaymentStatus.UNPAID,
          cancellationReason: BookingCancellationReason.SYSTEM_TIMEOUT,
          settlementReadiness: SettlementReadiness.BLOCKED,
          statusRemark: '支付超时，系统已自动关闭',
        };
      case PaymentIntentStatus.PROCESSING:
        return {
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.UNPAID,
          statusRemark: '支付处理中，等待渠道确认',
        };
      case PaymentIntentStatus.REQUIRES_PAYMENT:
      default:
        return {
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.UNPAID,
          settlementReadiness: SettlementReadiness.NOT_READY,
          statusRemark: null,
        };
    }
  }
}
