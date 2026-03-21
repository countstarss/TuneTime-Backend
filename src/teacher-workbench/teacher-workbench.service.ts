import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListTeacherPendingBookingsQueryDto } from './dto/list-teacher-pending-bookings-query.dto';
import {
  TeacherWorkbenchBookingDetailDto,
  TeacherWorkbenchBookingListItemDto,
  TeacherWorkbenchPendingBookingListResponseDto,
} from './dto/teacher-workbench-response.dto';

type TeacherWorkbenchBookingRow = {
  id: string;
  bookingNo: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  cancellationReason: string | null;
  statusRemark: string | null;
  startAt: Date;
  endAt: Date;
  timezone: string;
  durationMinutes: number;
  totalAmount: Prisma.Decimal;
  isTrial: boolean;
  notes: string | null;
  planSummary: string | null;
  teacherAcceptedAt: Date | null;
  guardianConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  studentProfile: {
    id: string;
    displayName: string;
    gradeLevel: string | null;
  };
  guardianProfile: {
    id: string;
    displayName: string;
    phone: string | null;
  } | null;
  subject: {
    name: string;
  };
  serviceAddress: {
    label: string | null;
    contactName: string;
    contactPhone: string;
    province: string;
    city: string;
    district: string;
    street: string;
    building: string | null;
  };
};

@Injectable()
export class TeacherWorkbenchService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly pendingStatuses: BookingStatus[] = [
    BookingStatus.PENDING_ACCEPTANCE,
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
  ];

  private getBookingSelect() {
    return {
      id: true,
      bookingNo: true,
      status: true,
      paymentStatus: true,
      cancellationReason: true,
      statusRemark: true,
      startAt: true,
      endAt: true,
      timezone: true,
      durationMinutes: true,
      totalAmount: true,
      isTrial: true,
      notes: true,
      planSummary: true,
      teacherAcceptedAt: true,
      guardianConfirmedAt: true,
      createdAt: true,
      updatedAt: true,
      studentProfile: {
        select: {
          id: true,
          displayName: true,
          gradeLevel: true,
        },
      },
      guardianProfile: {
        select: {
          id: true,
          displayName: true,
          phone: true,
        },
      },
      subject: {
        select: {
          name: true,
        },
      },
      serviceAddress: {
        select: {
          label: true,
          contactName: true,
          contactPhone: true,
          province: true,
          city: true,
          district: true,
          street: true,
          building: true,
        },
      },
    } satisfies Prisma.BookingSelect;
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return Number(value);
  }

  private buildAddressSummary(booking: TeacherWorkbenchBookingRow): string {
    return [
      booking.serviceAddress.province,
      booking.serviceAddress.city,
      booking.serviceAddress.district,
      booking.serviceAddress.street,
      booking.serviceAddress.building,
    ]
      .filter((item): item is string => item != null && item.trim().length > 0)
      .join(' ');
  }

  private toListItem(
    booking: TeacherWorkbenchBookingRow,
  ): TeacherWorkbenchBookingListItemDto {
    return {
      id: booking.id,
      bookingNo: booking.bookingNo,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      startAt: booking.startAt,
      endAt: booking.endAt,
      subjectName: booking.subject.name,
      serviceAddressSummary: this.buildAddressSummary(booking),
      serviceAddressLabel: booking.serviceAddress.label,
      isTrial: booking.isTrial,
      notes: booking.notes,
      statusRemark: booking.statusRemark,
      planSummary: booking.planSummary,
      student: {
        id: booking.studentProfile.id,
        displayName: booking.studentProfile.displayName,
        gradeLevel: booking.studentProfile.gradeLevel,
      },
      guardian: {
        id: booking.guardianProfile?.id ?? null,
        displayName: booking.guardianProfile?.displayName ?? null,
        phone: booking.guardianProfile?.phone ?? null,
      },
    };
  }

  private toDetail(
    booking: TeacherWorkbenchBookingRow,
  ): TeacherWorkbenchBookingDetailDto {
    return {
      ...this.toListItem(booking),
      teacherAcceptedAt: booking.teacherAcceptedAt,
      guardianConfirmedAt: booking.guardianConfirmedAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      timezone: booking.timezone,
      durationMinutes: booking.durationMinutes,
      totalAmount: this.toNumber(booking.totalAmount),
      contactName: booking.serviceAddress.contactName,
      contactPhone: booking.serviceAddress.contactPhone,
      cancellationReason: booking.cancellationReason,
    };
  }

  private async resolveTeacherProfileId(userId: string): Promise<string> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!teacher) {
      throw new NotFoundException('当前账号未找到老师档案');
    }

    return teacher.id;
  }

  async listPendingBookings(
    currentUser: AuthenticatedUserContext,
    query: ListTeacherPendingBookingsQueryDto,
  ): Promise<TeacherWorkbenchPendingBookingListResponseDto> {
    const teacherProfileId = await this.resolveTeacherProfileId(
      currentUser.userId,
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where = {
      teacherProfileId,
      status: { in: this.pendingStatuses },
    } satisfies Prisma.BookingWhereInput;

    const [items, total, grouped] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        select: this.getBookingSelect(),
      }),
      this.prisma.booking.count({ where }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    const summaryMap = new Map(
      grouped.map((item) => [item.status, item._count._all]),
    );

    return {
      items: items.map((item) => this.toListItem(item)),
      summary: {
        pendingAcceptance:
          summaryMap.get(BookingStatus.PENDING_ACCEPTANCE) ?? 0,
        pendingPayment: summaryMap.get(BookingStatus.PENDING_PAYMENT) ?? 0,
        confirmed: summaryMap.get(BookingStatus.CONFIRMED) ?? 0,
      },
      page,
      pageSize,
      total,
      totalPages: total == 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findPendingBookingDetail(
    currentUser: AuthenticatedUserContext,
    bookingId: string,
  ): Promise<TeacherWorkbenchBookingDetailDto> {
    const teacherProfileId = await this.resolveTeacherProfileId(
      currentUser.userId,
    );
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        teacherProfileId: true,
        ...this.getBookingSelect(),
      },
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约：${bookingId}`);
    }

    if (booking.teacherProfileId !== teacherProfileId) {
      throw new ForbiddenException('不能查看其他老师的预约详情');
    }

    if (!this.pendingStatuses.includes(booking.status)) {
      throw new NotFoundException('当前预约不在老师待处理列表范围内');
    }

    const { teacherProfileId: _ignoredTeacherProfileId, ...detailBooking } =
      booking;

    return this.toDetail(detailBooking);
  }
}
