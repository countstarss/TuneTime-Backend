import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
  Prisma,
  TeacherVerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptBookingDto } from './dto/accept-booking.dto';
import {
  BookingListResponseDto,
  BookingResponseDto,
  DeleteBookingResponseDto,
} from './dto/booking-response.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingPaymentDto } from './dto/update-booking-payment.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

type BookingWithRelations = Booking & {
  teacherProfile: {
    id: string;
    userId: string;
    displayName: string;
    verificationStatus: TeacherVerificationStatus;
  };
  studentProfile: {
    id: string;
    userId: string | null;
    displayName: string;
    gradeLevel: string | null;
  };
  guardianProfile: {
    id: string;
    userId: string;
    displayName: string;
    phone: string | null;
  } | null;
  subject: {
    id: string;
    code: string;
    name: string;
  };
  serviceAddress: {
    id: string;
    userId: string;
    label: string | null;
    contactName: string;
    contactPhone: string;
    country: string;
    province: string;
    city: string;
    district: string;
    street: string;
    building: string | null;
  };
};

type BookingContext = {
  teacherProfile: {
    id: string;
    userId: string;
    displayName: string;
    verificationStatus: TeacherVerificationStatus;
    baseHourlyRate: Prisma.Decimal;
  };
  studentProfile: {
    id: string;
    userId: string | null;
    displayName: string;
    gradeLevel: string | null;
  };
  guardianProfile: {
    id: string;
    userId: string;
    displayName: string;
    phone: string | null;
  } | null;
  subject: {
    id: string;
    code: string;
    name: string;
  };
  serviceAddress: {
    id: string;
    userId: string;
    label: string | null;
    contactName: string;
    contactPhone: string;
    country: string;
    province: string;
    city: string;
    district: string;
    street: string;
    building: string | null;
  };
  teacherSubject: {
    id: string;
    hourlyRate: Prisma.Decimal;
    trialRate: Prisma.Decimal | null;
  } | null;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly activeConflictStatuses: BookingStatus[] = [
    BookingStatus.PENDING_ACCEPTANCE,
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
  ];

  private toNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return Number(value);
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  private hasStatus(
    status: BookingStatus,
    candidates: BookingStatus[],
  ): boolean {
    return candidates.includes(status);
  }

  private parseDate(value: string | Date, fieldName: string): Date {
    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} 不是有效的日期时间`);
    }

    return parsed;
  }

  private buildBookingNo(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BK${datePart}${randomPart}`;
  }

  private getBookingInclude() {
    return {
      teacherProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          verificationStatus: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          gradeLevel: true,
        },
      },
      guardianProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          phone: true,
        },
      },
      subject: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      serviceAddress: {
        select: {
          id: true,
          userId: true,
          label: true,
          contactName: true,
          contactPhone: true,
          country: true,
          province: true,
          city: true,
          district: true,
          street: true,
          building: true,
        },
      },
    } satisfies Prisma.BookingInclude;
  }

  private toResponse(booking: BookingWithRelations): BookingResponseDto {
    return {
      id: booking.id,
      bookingNo: booking.bookingNo,
      teacherProfileId: booking.teacherProfileId,
      studentProfileId: booking.studentProfileId,
      guardianProfileId: booking.guardianProfileId,
      subjectId: booking.subjectId,
      serviceAddressId: booking.serviceAddressId,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.timezone,
      status: booking.status,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt,
      cancelledByUserId: booking.cancelledByUserId,
      isTrial: booking.isTrial,
      teacherAcceptedAt: booking.teacherAcceptedAt,
      guardianConfirmedAt: booking.guardianConfirmedAt,
      hourlyRate: this.toNumber(booking.hourlyRate) ?? 0,
      durationMinutes: booking.durationMinutes,
      subtotalAmount: this.toNumber(booking.subtotalAmount) ?? 0,
      discountAmount: this.toNumber(booking.discountAmount) ?? 0,
      platformFeeAmount: this.toNumber(booking.platformFeeAmount) ?? 0,
      travelFeeAmount: this.toNumber(booking.travelFeeAmount) ?? 0,
      totalAmount: this.toNumber(booking.totalAmount) ?? 0,
      currency: booking.currency,
      paymentStatus: booking.paymentStatus,
      paymentDueAt: booking.paymentDueAt,
      planSummary: booking.planSummary,
      notes: booking.notes,
      teacher: {
        id: booking.teacherProfile.id,
        userId: booking.teacherProfile.userId,
        displayName: booking.teacherProfile.displayName,
        verificationStatus: booking.teacherProfile.verificationStatus,
      },
      student: {
        id: booking.studentProfile.id,
        userId: booking.studentProfile.userId,
        displayName: booking.studentProfile.displayName,
        gradeLevel: booking.studentProfile.gradeLevel,
      },
      guardian: {
        id: booking.guardianProfile?.id ?? null,
        userId: booking.guardianProfile?.userId ?? null,
        displayName: booking.guardianProfile?.displayName ?? null,
        phone: booking.guardianProfile?.phone ?? null,
      },
      subject: {
        id: booking.subject.id,
        code: booking.subject.code,
        name: booking.subject.name,
      },
      serviceAddress: {
        id: booking.serviceAddress.id,
        userId: booking.serviceAddress.userId,
        label: booking.serviceAddress.label,
        contactName: booking.serviceAddress.contactName,
        contactPhone: booking.serviceAddress.contactPhone,
        country: booking.serviceAddress.country,
        province: booking.serviceAddress.province,
        city: booking.serviceAddress.city,
        district: booking.serviceAddress.district,
        street: booking.serviceAddress.street,
        building: booking.serviceAddress.building,
      },
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  private async findBookingOrThrow(id: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: this.getBookingInclude(),
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约：${id}`);
    }

    return booking;
  }

  private async findBookingByNoOrThrow(
    bookingNo: string,
  ): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingNo },
      include: this.getBookingInclude(),
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约单号：${bookingNo}`);
    }

    return booking;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`未找到关联用户：${userId}`);
    }
  }

  private async loadBookingContext(params: {
    teacherProfileId: string;
    studentProfileId: string;
    guardianProfileId?: string | null;
    subjectId: string;
    serviceAddressId: string;
  }): Promise<BookingContext> {
    const [
      teacherProfile,
      studentProfile,
      guardianProfile,
      subject,
      serviceAddress,
      teacherSubject,
    ] = await Promise.all([
      this.prisma.teacherProfile.findUnique({
        where: { id: params.teacherProfileId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          verificationStatus: true,
          baseHourlyRate: true,
        },
      }),
      this.prisma.studentProfile.findUnique({
        where: { id: params.studentProfileId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          gradeLevel: true,
        },
      }),
      params.guardianProfileId
        ? this.prisma.guardianProfile.findUnique({
            where: { id: params.guardianProfileId },
            select: {
              id: true,
              userId: true,
              displayName: true,
              phone: true,
            },
          })
        : Promise.resolve(null),
      this.prisma.subject.findUnique({
        where: { id: params.subjectId },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      this.prisma.address.findUnique({
        where: { id: params.serviceAddressId },
        select: {
          id: true,
          userId: true,
          label: true,
          contactName: true,
          contactPhone: true,
          country: true,
          province: true,
          city: true,
          district: true,
          street: true,
          building: true,
        },
      }),
      this.prisma.teacherSubject.findFirst({
        where: {
          teacherProfileId: params.teacherProfileId,
          subjectId: params.subjectId,
          isActive: true,
        },
        select: {
          id: true,
          hourlyRate: true,
          trialRate: true,
        },
      }),
    ]);

    if (!teacherProfile) {
      throw new NotFoundException(`未找到老师档案：${params.teacherProfileId}`);
    }

    if (
      teacherProfile.verificationStatus !== TeacherVerificationStatus.APPROVED
    ) {
      throw new BadRequestException('当前老师尚未审核通过，不能创建预约');
    }

    if (!studentProfile) {
      throw new NotFoundException(`未找到学生档案：${params.studentProfileId}`);
    }

    if (params.guardianProfileId && !guardianProfile) {
      throw new NotFoundException(
        `未找到家长档案：${params.guardianProfileId}`,
      );
    }

    if (!subject) {
      throw new NotFoundException(`未找到科目：${params.subjectId}`);
    }

    if (!serviceAddress) {
      throw new NotFoundException(`未找到服务地址：${params.serviceAddressId}`);
    }

    if (!teacherSubject) {
      throw new BadRequestException('当前老师未开通该科目，无法预约');
    }

    if (guardianProfile) {
      const studentGuardian = await this.prisma.studentGuardian.findFirst({
        where: {
          studentProfileId: params.studentProfileId,
          guardianProfileId: guardianProfile.id,
          canBook: true,
        },
        select: { id: true },
      });

      if (!studentGuardian) {
        throw new BadRequestException('该家长无权为当前学生创建预约');
      }

      if (serviceAddress.userId !== guardianProfile.userId) {
        throw new BadRequestException(
          '服务地址不属于当前家长账号，无法用于本次预约',
        );
      }
    }

    return {
      teacherProfile,
      studentProfile,
      guardianProfile,
      subject,
      serviceAddress,
      teacherSubject,
    };
  }

  private calculateAmounts(params: {
    hourlyRate: number;
    durationMinutes: number;
    discountAmount: number;
    platformFeeAmount: number;
    travelFeeAmount: number;
  }) {
    const subtotalAmount = this.roundCurrency(
      (params.hourlyRate * params.durationMinutes) / 60,
    );
    const totalAmount = this.roundCurrency(
      subtotalAmount -
        params.discountAmount +
        params.platformFeeAmount +
        params.travelFeeAmount,
    );

    if (totalAmount < 0) {
      throw new BadRequestException('计算后的总金额不能小于 0');
    }

    return {
      subtotalAmount,
      totalAmount,
    };
  }

  private async ensureNoScheduleConflict(params: {
    teacherProfileId: string;
    studentProfileId: string;
    startAt: Date;
    endAt: Date;
    excludeBookingId?: string;
  }) {
    const overlapWhere = {
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      status: { in: this.activeConflictStatuses },
      ...(params.excludeBookingId
        ? { id: { not: params.excludeBookingId } }
        : {}),
    } satisfies Prisma.BookingWhereInput;

    const [teacherConflict, studentConflict] = await Promise.all([
      this.prisma.booking.findFirst({
        where: {
          ...overlapWhere,
          teacherProfileId: params.teacherProfileId,
        },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: {
          ...overlapWhere,
          studentProfileId: params.studentProfileId,
        },
        select: { id: true },
      }),
    ]);

    if (teacherConflict) {
      throw new BadRequestException('老师在该时间段已有其他预约');
    }

    if (studentConflict) {
      throw new BadRequestException('学生在该时间段已有其他预约');
    }
  }

  private pickHourlyRate(context: BookingContext, isTrial: boolean): number {
    if (isTrial) {
      return (
        this.toNumber(
          context.teacherSubject?.trialRate ??
            context.teacherSubject?.hourlyRate,
        ) ??
        this.toNumber(context.teacherProfile.baseHourlyRate) ??
        0
      );
    }

    return (
      this.toNumber(context.teacherSubject?.hourlyRate) ??
      this.toNumber(context.teacherProfile.baseHourlyRate) ??
      0
    );
  }

  async create(dto: CreateBookingDto): Promise<BookingResponseDto> {
    const startAt = this.parseDate(dto.startAt, 'startAt');
    const endAt = this.parseDate(dto.endAt, 'endAt');

    if (endAt <= startAt) {
      throw new BadRequestException('预约结束时间必须晚于开始时间');
    }

    const durationMinutes = Math.ceil(
      (endAt.getTime() - startAt.getTime()) / 60000,
    );
    const context = await this.loadBookingContext({
      teacherProfileId: dto.teacherProfileId,
      studentProfileId: dto.studentProfileId,
      guardianProfileId: dto.guardianProfileId,
      subjectId: dto.subjectId,
      serviceAddressId: dto.serviceAddressId,
    });

    await this.ensureNoScheduleConflict({
      teacherProfileId: dto.teacherProfileId,
      studentProfileId: dto.studentProfileId,
      startAt,
      endAt,
    });

    const hourlyRate = this.pickHourlyRate(context, dto.isTrial ?? false);
    const discountAmount = dto.discountAmount ?? 0;
    const platformFeeAmount = dto.platformFeeAmount ?? 0;
    const travelFeeAmount = dto.travelFeeAmount ?? 0;
    const { subtotalAmount, totalAmount } = this.calculateAmounts({
      hourlyRate,
      durationMinutes,
      discountAmount,
      platformFeeAmount,
      travelFeeAmount,
    });

    const booking = await this.prisma.booking.create({
      data: {
        bookingNo: this.buildBookingNo(),
        teacherProfileId: dto.teacherProfileId,
        studentProfileId: dto.studentProfileId,
        guardianProfileId: dto.guardianProfileId ?? null,
        subjectId: dto.subjectId,
        serviceAddressId: dto.serviceAddressId,
        startAt,
        endAt,
        timezone: dto.timezone?.trim() || 'Asia/Shanghai',
        isTrial: dto.isTrial ?? false,
        hourlyRate,
        durationMinutes,
        subtotalAmount,
        discountAmount,
        platformFeeAmount,
        travelFeeAmount,
        totalAmount,
        paymentDueAt: dto.paymentDueAt
          ? this.parseDate(dto.paymentDueAt, 'paymentDueAt')
          : null,
        planSummary: dto.planSummary?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async findAll(query: ListBookingsQueryDto): Promise<BookingListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const keyword = query.keyword?.trim();

    const where: Prisma.BookingWhereInput = {
      ...(query.bookingNo ? { bookingNo: query.bookingNo.trim() } : {}),
      ...(query.teacherProfileId
        ? { teacherProfileId: query.teacherProfileId.trim() }
        : {}),
      ...(query.studentProfileId
        ? { studentProfileId: query.studentProfileId.trim() }
        : {}),
      ...(query.guardianProfileId
        ? { guardianProfileId: query.guardianProfileId.trim() }
        : {}),
      ...(query.subjectId ? { subjectId: query.subjectId.trim() } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(typeof query.isTrial === 'boolean' ? { isTrial: query.isTrial } : {}),
      ...(query.startAtFrom || query.startAtTo
        ? {
            startAt: {
              ...(query.startAtFrom
                ? { gte: this.parseDate(query.startAtFrom, 'startAtFrom') }
                : {}),
              ...(query.startAtTo
                ? { lte: this.parseDate(query.startAtTo, 'startAtTo') }
                : {}),
            },
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              {
                bookingNo: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                teacherProfile: {
                  displayName: {
                    contains: keyword,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              {
                studentProfile: {
                  displayName: {
                    contains: keyword,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              {
                subject: {
                  name: {
                    contains: keyword,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: this.getBookingInclude(),
        orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findByBookingNo(bookingNo: string): Promise<BookingResponseDto> {
    const booking = await this.findBookingByNoOrThrow(bookingNo);
    return this.toResponse(booking);
  }

  async findOne(id: string): Promise<BookingResponseDto> {
    const booking = await this.findBookingOrThrow(id);
    return this.toResponse(booking);
  }

  async update(id: string, dto: UpdateBookingDto): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (
      this.hasStatus(current.status, [
        BookingStatus.CANCELLED,
        BookingStatus.COMPLETED,
        BookingStatus.REFUNDED,
      ])
    ) {
      throw new BadRequestException('当前预约状态不允许再修改基础信息');
    }

    const teacherProfileId =
      dto.teacherProfileId?.trim() || current.teacherProfileId;
    const studentProfileId =
      dto.studentProfileId?.trim() || current.studentProfileId;
    const guardianProfileId =
      dto.guardianProfileId?.trim() || current.guardianProfileId;
    const subjectId = dto.subjectId?.trim() || current.subjectId;
    const serviceAddressId =
      dto.serviceAddressId?.trim() || current.serviceAddressId;
    const startAt = dto.startAt
      ? this.parseDate(dto.startAt, 'startAt')
      : current.startAt;
    const endAt = dto.endAt
      ? this.parseDate(dto.endAt, 'endAt')
      : current.endAt;

    if (endAt <= startAt) {
      throw new BadRequestException('预约结束时间必须晚于开始时间');
    }

    const durationMinutes = Math.ceil(
      (endAt.getTime() - startAt.getTime()) / 60000,
    );
    const context = await this.loadBookingContext({
      teacherProfileId,
      studentProfileId,
      guardianProfileId,
      subjectId,
      serviceAddressId,
    });

    await this.ensureNoScheduleConflict({
      teacherProfileId,
      studentProfileId,
      startAt,
      endAt,
      excludeBookingId: id,
    });

    const isTrial = dto.isTrial ?? current.isTrial;
    const hourlyRate = this.pickHourlyRate(context, isTrial);
    const discountAmount =
      dto.discountAmount ?? this.toNumber(current.discountAmount) ?? 0;
    const platformFeeAmount =
      dto.platformFeeAmount ?? this.toNumber(current.platformFeeAmount) ?? 0;
    const travelFeeAmount =
      dto.travelFeeAmount ?? this.toNumber(current.travelFeeAmount) ?? 0;
    const { subtotalAmount, totalAmount } = this.calculateAmounts({
      hourlyRate,
      durationMinutes,
      discountAmount,
      platformFeeAmount,
      travelFeeAmount,
    });

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        teacherProfileId,
        studentProfileId,
        guardianProfileId,
        subjectId,
        serviceAddressId,
        startAt,
        endAt,
        timezone:
          dto.timezone !== undefined ? dto.timezone.trim() : current.timezone,
        isTrial,
        hourlyRate,
        durationMinutes,
        subtotalAmount,
        discountAmount,
        platformFeeAmount,
        travelFeeAmount,
        totalAmount,
        paymentDueAt:
          dto.paymentDueAt !== undefined
            ? dto.paymentDueAt
              ? this.parseDate(dto.paymentDueAt, 'paymentDueAt')
              : null
            : current.paymentDueAt,
        planSummary:
          dto.planSummary !== undefined
            ? dto.planSummary?.trim() || null
            : current.planSummary,
        notes:
          dto.notes !== undefined ? dto.notes?.trim() || null : current.notes,
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async accept(id: string, dto: AcceptBookingDto): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (current.status !== BookingStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('只有待接单状态的预约才可以接单');
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.PENDING_PAYMENT,
        teacherAcceptedAt: dto.acceptedAt
          ? this.parseDate(dto.acceptedAt, 'acceptedAt')
          : new Date(),
        ...(dto.planSummary !== undefined
          ? { planSummary: dto.planSummary.trim() || null }
          : {}),
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async guardianConfirm(
    id: string,
    dto: ConfirmBookingDto,
  ): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (
      this.hasStatus(current.status, [
        BookingStatus.CANCELLED,
        BookingStatus.REFUNDED,
        BookingStatus.EXPIRED,
      ])
    ) {
      throw new BadRequestException('当前预约状态不允许家长确认');
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        guardianConfirmedAt: dto.guardianConfirmedAt
          ? this.parseDate(dto.guardianConfirmedAt, 'guardianConfirmedAt')
          : new Date(),
        ...(dto.planSummary !== undefined
          ? { planSummary: dto.planSummary.trim() || null }
          : {}),
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async updatePayment(
    id: string,
    dto: UpdateBookingPaymentDto,
  ): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (
      current.status === BookingStatus.CANCELLED &&
      dto.paymentStatus === PaymentStatus.PAID
    ) {
      throw new BadRequestException('已取消预约不能标记为支付成功');
    }

    if (
      current.status === BookingStatus.PENDING_ACCEPTANCE &&
      dto.paymentStatus === PaymentStatus.PAID
    ) {
      throw new BadRequestException('预约尚未接单，不能直接标记为支付成功');
    }

    let nextStatus = current.status;
    if (
      dto.paymentStatus === PaymentStatus.PAID &&
      current.status === BookingStatus.PENDING_PAYMENT
    ) {
      nextStatus = BookingStatus.CONFIRMED;
    }
    if (dto.paymentStatus === PaymentStatus.REFUNDED) {
      nextStatus = BookingStatus.REFUNDED;
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: dto.paymentStatus,
        status: nextStatus,
        ...(dto.paymentDueAt !== undefined
          ? {
              paymentDueAt: dto.paymentDueAt
                ? this.parseDate(dto.paymentDueAt, 'paymentDueAt')
                : null,
            }
          : {}),
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async cancel(id: string, dto: CancelBookingDto): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (
      this.hasStatus(current.status, [
        BookingStatus.CANCELLED,
        BookingStatus.COMPLETED,
        BookingStatus.REFUNDED,
      ])
    ) {
      throw new BadRequestException('当前预约状态不允许取消');
    }

    if (dto.cancelledByUserId) {
      await this.ensureUserExists(dto.cancelledByUserId);
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: dto.cancellationReason,
        cancelledByUserId: dto.cancelledByUserId ?? null,
        cancelledAt: dto.cancelledAt
          ? this.parseDate(dto.cancelledAt, 'cancelledAt')
          : new Date(),
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async remove(id: string): Promise<DeleteBookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (
      !this.hasStatus(current.status, [
        BookingStatus.PENDING_ACCEPTANCE,
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
      ])
    ) {
      throw new BadRequestException('当前预约状态不允许删除');
    }

    try {
      await this.prisma.booking.delete({ where: { id } });
      return {
        success: true,
        message: '预约已删除',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('预约已有关联数据，无法直接删除');
      }

      throw error;
    }
  }
}
