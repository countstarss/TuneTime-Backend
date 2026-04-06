import {
  BookingCancellationReason,
  BookingCompletionStatus,
  BookingExceptionCaseStatus,
  BookingExceptionStatus,
  BookingExceptionType,
  BookingStatus,
  PaymentStatus,
  ResponsibilityType,
  SettlementReadiness,
} from '@prisma/client';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingLifecycleAutomationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BookingLifecycleAutomationService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 60_000;
  private readonly pendingAcceptanceTtlMinutes = Number(
    process.env.BOOKING_PENDING_ACCEPTANCE_TTL_MINUTES ?? 720,
  );
  private readonly guardianAutoConfirmHours = Number(
    process.env.BOOKING_AUTO_CONFIRM_HOURS ?? 48,
  );

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.BOOKING_LIFECYCLE_AUTOMATION_ENABLED === 'false'
    ) {
      return;
    }

    this.timer = setInterval(() => {
      this.runSweep().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`订单生命周期巡检失败: ${message}`);
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runSweep() {
    await this.expirePendingAcceptance();
    await this.expirePendingPayment();
    await this.flagOverdueNotStarted();
    await this.flagOverdueNotFinished();
    await this.autoConfirmCompleted();
  }

  private async expirePendingAcceptance() {
    const cutoff = new Date(
      Date.now() - this.pendingAcceptanceTtlMinutes * 60 * 1000,
    );

    await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_ACCEPTANCE,
        createdAt: { lte: cutoff },
      },
      data: {
        status: BookingStatus.EXPIRED,
        cancellationReason: BookingCancellationReason.SYSTEM_TIMEOUT,
        statusRemark: '老师长时间未处理，系统已自动关闭',
        settlementReadiness: SettlementReadiness.BLOCKED,
      },
    });
  }

  private async expirePendingPayment() {
    await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.UNPAID,
        paymentDueAt: { lte: new Date() },
      },
      data: {
        status: BookingStatus.EXPIRED,
        cancellationReason: BookingCancellationReason.SYSTEM_TIMEOUT,
        statusRemark: '支付超时，系统已自动关闭',
        settlementReadiness: SettlementReadiness.BLOCKED,
      },
    });
  }

  private async flagOverdueNotStarted() {
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        startAt: { lt: new Date() },
        lesson: {
          is: {
            checkInAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    for (const booking of candidates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.bookingExceptionCase.upsert({
          where: {
            bookingId_exceptionType: {
              bookingId: booking.id,
              exceptionType: BookingExceptionType.OVERDUE_NOT_STARTED,
            },
          },
          create: {
            bookingId: booking.id,
            exceptionType: BookingExceptionType.OVERDUE_NOT_STARTED,
            status: BookingExceptionCaseStatus.OPEN,
            responsibilityType: ResponsibilityType.UNKNOWN,
            summary: '已过上课开始时间，老师仍未签到',
          },
          update: {
            status: BookingExceptionCaseStatus.OPEN,
            responsibilityType: ResponsibilityType.UNKNOWN,
            summary: '已过上课开始时间，老师仍未签到',
            resolution: null,
            resolvedByUserId: null,
          },
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            exceptionStatus: BookingExceptionStatus.BLOCKING,
            settlementReadiness: SettlementReadiness.BLOCKED,
          },
        });
      });
    }
  }

  private async flagOverdueNotFinished() {
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
        endAt: { lt: new Date() },
        lesson: {
          is: {
            checkOutAt: null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    for (const booking of candidates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.bookingExceptionCase.upsert({
          where: {
            bookingId_exceptionType: {
              bookingId: booking.id,
              exceptionType: BookingExceptionType.OVERDUE_NOT_FINISHED,
            },
          },
          create: {
            bookingId: booking.id,
            exceptionType: BookingExceptionType.OVERDUE_NOT_FINISHED,
            status: BookingExceptionCaseStatus.OPEN,
            responsibilityType: ResponsibilityType.UNKNOWN,
            summary: '已过下课时间，老师仍未签退',
          },
          update: {
            status: BookingExceptionCaseStatus.OPEN,
            responsibilityType: ResponsibilityType.UNKNOWN,
            summary: '已过下课时间，老师仍未签退',
            resolution: null,
            resolvedByUserId: null,
          },
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            exceptionStatus: BookingExceptionStatus.BLOCKING,
            settlementReadiness: SettlementReadiness.BLOCKED,
          },
        });
      });
    }
  }

  private async autoConfirmCompleted() {
    const cutoff = new Date(
      Date.now() - this.guardianAutoConfirmHours * 60 * 60 * 1000,
    );

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        completionStatus: BookingCompletionStatus.PENDING_GUARDIAN_CONFIRM,
        lesson: {
          is: {
            feedbackSubmittedAt: { lte: cutoff },
          },
        },
        exceptionCases: {
          none: {
            status: {
              in: [
                BookingExceptionCaseStatus.OPEN,
                BookingExceptionCaseStatus.WAITING_TEACHER,
                BookingExceptionCaseStatus.WAITING_GUARDIAN,
                BookingExceptionCaseStatus.WAITING_ADMIN,
              ],
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    for (const booking of candidates) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          completionStatus: BookingCompletionStatus.AUTO_CONFIRMED,
          completionConfirmedAt: new Date(),
          exceptionStatus: BookingExceptionStatus.NONE,
          settlementReadiness: SettlementReadiness.READY,
          statusRemark: '家长超时未处理，系统已自动确认完课',
        },
      });
    }
  }
}
