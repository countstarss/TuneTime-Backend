import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Booking,
  BookingCancellationReason,
  BookingHoldStatus,
  BookingStatus,
  PaymentStatus,
  PlatformRole,
  Prisma,
  RescheduleRequestStatus,
  TeacherVerificationStatus,
} from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherAvailabilityService } from '../teacher-availability/teacher-availability.service';
import { AcceptBookingDto } from './dto/accept-booking.dto';
import { BookingHoldResponseDto } from './dto/booking-hold-response.dto';
import {
  BookingListResponseDto,
  BookingResponseDto,
  BookingRescheduleRequestDto,
  DeleteBookingResponseDto,
} from './dto/booking-response.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingFromHoldDto } from './dto/create-booking-from-hold.dto';
import { CreateBookingHoldDto } from './dto/create-booking-hold.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateRescheduleRequestDto } from './dto/create-reschedule-request.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListMyBookingsQueryDto } from './dto/list-my-bookings-query.dto';
import {
  BookingTeacherResponseAction,
  RespondBookingDto,
} from './dto/respond-booking.dto';
import {
  RescheduleResponseAction,
  RespondRescheduleRequestDto,
} from './dto/respond-reschedule-request.dto';
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
  rescheduleRequests: Array<{
    id: string;
    initiatorRole: PlatformRole;
    initiatorUserId: string;
    proposedStartAt: Date;
    proposedEndAt: Date;
    reason: string | null;
    status: RescheduleRequestStatus;
    respondedAt: Date | null;
    respondedByUserId: string | null;
    createdAt: Date;
  }>;
};

type BookingContext = {
  teacherProfile: {
    id: string;
    userId: string;
    displayName: string;
    verificationStatus: TeacherVerificationStatus;
    onboardingCompletedAt: Date | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAvailabilityService: TeacherAvailabilityService,
  ) {}

  private readonly activeConflictStatuses: BookingStatus[] = [
    BookingStatus.PENDING_ACCEPTANCE,
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
  ];

  private readonly holdTtlMinutes = 5;
  private readonly explicitTimezonePattern = /(Z|[+-]\d{2}:\d{2})$/;

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

  private parseExternalDateTime(
    value: string | Date,
    fieldName: string,
    options?: {
      requireExplicitTimezone?: boolean;
      mustBeFuture?: boolean;
    },
  ): Date {
    if (
      options?.requireExplicitTimezone &&
      typeof value === 'string' &&
      !this.explicitTimezonePattern.test(value.trim())
    ) {
      throw new BadRequestException(
        `${fieldName} 必须显式包含时区偏移或 Z 标记`,
      );
    }

    const parsed = this.parseDate(value, fieldName);

    if (options?.mustBeFuture && parsed.getTime() <= Date.now()) {
      throw new BadRequestException(`${fieldName} 不能早于当前时间`);
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
      rescheduleRequests: {
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          initiatorRole: true,
          initiatorUserId: true,
          proposedStartAt: true,
          proposedEndAt: true,
          reason: true,
          status: true,
          respondedAt: true,
          respondedByUserId: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.BookingInclude;
  }

  private toRescheduleRequestDto(
    request: BookingWithRelations['rescheduleRequests'][number],
  ): BookingRescheduleRequestDto {
    return {
      id: request.id,
      initiatorRole: request.initiatorRole,
      initiatorUserId: request.initiatorUserId,
      proposedStartAt: request.proposedStartAt,
      proposedEndAt: request.proposedEndAt,
      reason: request.reason,
      status: request.status,
      respondedAt: request.respondedAt,
      respondedByUserId: request.respondedByUserId,
      createdAt: request.createdAt,
    };
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
      statusRemark: booking.statusRemark,
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
      rescheduleRequests: booking.rescheduleRequests.map((item) =>
        this.toRescheduleRequestDto(item),
      ),
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  private toHoldResponse(hold: {
    id: string;
    teacherProfileId: string;
    studentProfileId: string;
    guardianProfileId: string | null;
    subjectId: string;
    serviceAddressId: string;
    startAt: Date;
    endAt: Date;
    status: BookingHoldStatus;
    expiresAt: Date;
    timezone: string;
  }): BookingHoldResponseDto {
    return {
      id: hold.id,
      teacherProfileId: hold.teacherProfileId,
      studentProfileId: hold.studentProfileId,
      guardianProfileId: hold.guardianProfileId,
      subjectId: hold.subjectId,
      serviceAddressId: hold.serviceAddressId,
      startAt: hold.startAt,
      endAt: hold.endAt,
      status: hold.status,
      expiresAt: hold.expiresAt,
      timezone: hold.timezone,
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

  private async resolveGuardianProfileIdForCurrentUser(
    currentUser: AuthenticatedUserContext,
  ): Promise<string> {
    const guardianProfile = await this.prisma.guardianProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });

    if (!guardianProfile) {
      throw new NotFoundException('当前账号未找到家长档案');
    }

    return guardianProfile.id;
  }

  private async resolveTeacherProfileIdForCurrentUser(
    currentUser: AuthenticatedUserContext,
  ): Promise<string> {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });

    if (!teacherProfile) {
      throw new NotFoundException('当前账号未找到老师档案');
    }

    return teacherProfile.id;
  }

  private async assertGuardianCanAccessBooking(
    currentUser: AuthenticatedUserContext,
    booking: BookingWithRelations,
  ): Promise<string> {
    if (!booking.guardianProfileId || !booking.guardianProfile) {
      throw new ForbiddenException('当前家长无权访问该预约');
    }

    if (booking.guardianProfile.userId !== currentUser.userId) {
      throw new ForbiddenException('当前家长无权访问该预约');
    }

    return booking.guardianProfileId;
  }

  private async assertTeacherCanAccessBooking(
    currentUser: AuthenticatedUserContext,
    booking: BookingWithRelations,
  ): Promise<string> {
    if (booking.teacherProfile.userId !== currentUser.userId) {
      throw new ForbiddenException('当前老师无权访问该预约');
    }

    return booking.teacherProfileId;
  }

  private async expireStaleHolds() {
    await this.prisma.bookingHold.updateMany({
      where: {
        status: BookingHoldStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      data: {
        status: BookingHoldStatus.EXPIRED,
      },
    });
  }

  private async ensureNoHoldConflict(params: {
    teacherProfileId: string;
    studentProfileId: string;
    startAt: Date;
    endAt: Date;
    excludeHoldId?: string;
  }) {
    await this.expireStaleHolds();

    const overlapWhere: Prisma.BookingHoldWhereInput = {
      status: BookingHoldStatus.ACTIVE,
      expiresAt: { gt: new Date() },
      startAt: { lt: params.endAt },
      endAt: { gt: params.startAt },
      ...(params.excludeHoldId ? { id: { not: params.excludeHoldId } } : {}),
    };

    const [teacherConflict, studentConflict] = await Promise.all([
      this.prisma.bookingHold.findFirst({
        where: {
          ...overlapWhere,
          teacherProfileId: params.teacherProfileId,
        },
        select: { id: true },
      }),
      this.prisma.bookingHold.findFirst({
        where: {
          ...overlapWhere,
          studentProfileId: params.studentProfileId,
        },
        select: { id: true },
      }),
    ]);

    if (teacherConflict) {
      throw new BadRequestException('该时段已有其他家长占位，请刷新后重试');
    }

    if (studentConflict) {
      throw new BadRequestException('该学生在该时间段已有其他预约占位');
    }
  }

  private async loadBookingContext(params: {
    teacherProfileId: string;
    studentProfileId: string;
    guardianProfileId?: string | null;
    subjectId: string;
    serviceAddressId: string;
  }): Promise<BookingContext> {
    const prisma = this.prisma as any;
    const [
      teacherProfile,
      studentProfile,
      guardianProfile,
      subject,
      serviceAddress,
      teacherSubject,
    ] = await Promise.all([
      prisma.teacherProfile.findUnique({
        where: { id: params.teacherProfileId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          verificationStatus: true,
          onboardingCompletedAt: true,
          baseHourlyRate: true,
        },
      }),
      prisma.studentProfile.findUnique({
        where: { id: params.studentProfileId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          gradeLevel: true,
        },
      }),
      params.guardianProfileId
        ? prisma.guardianProfile.findUnique({
            where: { id: params.guardianProfileId },
            select: {
              id: true,
              userId: true,
              displayName: true,
              phone: true,
            },
          })
        : Promise.resolve(null),
      prisma.subject.findUnique({
        where: { id: params.subjectId },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      prisma.address.findUnique({
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
      prisma.teacherSubject.findFirst({
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

    const [teacherUserRowsRaw, studentRowsRaw, guardianRowsRaw] =
      await Promise.all([
        prisma.$queryRawUnsafe(
          'SELECT real_name_verified_at FROM users WHERE id = $1 LIMIT 1',
          teacherProfile.userId,
        ),
        studentProfile.userId
          ? prisma.$queryRawUnsafe(
              `SELECT sp.onboarding_completed_at, u.real_name_verified_at
               FROM student_profiles sp
               LEFT JOIN users u ON u.id = sp.user_id
               WHERE sp.id = $1
               LIMIT 1`,
              studentProfile.id,
            )
          : Promise.resolve([]),
        guardianProfile
          ? prisma.$queryRawUnsafe(
              `SELECT gp.onboarding_completed_at, u.real_name_verified_at
               FROM guardian_profiles gp
               LEFT JOIN users u ON u.id = gp.user_id
               WHERE gp.id = $1
               LIMIT 1`,
              guardianProfile.id,
            )
          : Promise.resolve([]),
      ]);

    const teacherUserRows =
      teacherUserRowsRaw as Array<{ real_name_verified_at: Date | null }>;
    const studentRows = studentRowsRaw as Array<{
      onboarding_completed_at: Date | null;
      real_name_verified_at: Date | null;
    }>;
    const guardianRows = guardianRowsRaw as Array<{
      onboarding_completed_at: Date | null;
      real_name_verified_at: Date | null;
    }>;

    const teacherRealNameVerifiedAt =
      teacherUserRows[0]?.real_name_verified_at ?? null;
    const studentOnboardingCompletedAt =
      studentRows[0]?.onboarding_completed_at ?? null;
    const studentRealNameVerifiedAt =
      studentRows[0]?.real_name_verified_at ?? null;
    const guardianOnboardingCompletedAt =
      guardianRows[0]?.onboarding_completed_at ?? null;
    const guardianRealNameVerifiedAt =
      guardianRows[0]?.real_name_verified_at ?? null;

    if (!teacherProfile.onboardingCompletedAt) {
      throw new BadRequestException('当前老师尚未完成入驻资料，不能创建预约');
    }

    if (!teacherRealNameVerifiedAt) {
      throw new BadRequestException('当前老师尚未完成实名认证，不能创建预约');
    }

    if (
      !guardianProfile &&
      studentProfile.userId &&
      (!studentOnboardingCompletedAt || !studentRealNameVerifiedAt)
    ) {
      throw new BadRequestException('当前学生尚未完成资料或实名认证，不能创建预约');
    }

    if (guardianProfile) {
      if (!guardianOnboardingCompletedAt) {
        throw new BadRequestException('当前家长尚未完成首登资料，不能创建预约');
      }

      if (!guardianRealNameVerifiedAt) {
        throw new BadRequestException('当前家长尚未完成实名认证，不能创建预约');
      }

      const studentGuardian = await prisma.studentGuardian.findFirst({
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

  async createHold(
    currentUser: AuthenticatedUserContext,
    dto: CreateBookingHoldDto,
  ): Promise<BookingHoldResponseDto> {
    const guardianProfileId =
      await this.resolveGuardianProfileIdForCurrentUser(currentUser);
    const startAt = this.parseDate(dto.startAt, 'startAt');
    const endAt = this.parseDate(dto.endAt, 'endAt');

    if (endAt <= startAt) {
      throw new BadRequestException('预约结束时间必须晚于开始时间');
    }

    await this.loadBookingContext({
      teacherProfileId: dto.teacherProfileId,
      studentProfileId: dto.studentProfileId,
      guardianProfileId,
      subjectId: dto.subjectId,
      serviceAddressId: dto.serviceAddressId,
    });

    const isSellable = await this.teacherAvailabilityService.hasSellableWindow(
      dto.teacherProfileId,
      startAt,
      endAt,
    );

    if (!isSellable) {
      throw new BadRequestException('该时段当前不可预约，请刷新后重试');
    }

    await this.ensureNoScheduleConflict({
      teacherProfileId: dto.teacherProfileId,
      studentProfileId: dto.studentProfileId,
      startAt,
      endAt,
    });
    await this.ensureNoHoldConflict({
      teacherProfileId: dto.teacherProfileId,
      studentProfileId: dto.studentProfileId,
      startAt,
      endAt,
    });

    const hold = await this.prisma.bookingHold.create({
      data: {
        teacherProfileId: dto.teacherProfileId,
        studentProfileId: dto.studentProfileId,
        guardianProfileId,
        subjectId: dto.subjectId,
        serviceAddressId: dto.serviceAddressId,
        startAt,
        endAt,
        timezone: dto.timezone?.trim() || 'Asia/Shanghai',
        status: BookingHoldStatus.ACTIVE,
        expiresAt: new Date(Date.now() + this.holdTtlMinutes * 60 * 1000),
        createdByUserId: currentUser.userId,
      },
      select: {
        id: true,
        teacherProfileId: true,
        studentProfileId: true,
        guardianProfileId: true,
        subjectId: true,
        serviceAddressId: true,
        startAt: true,
        endAt: true,
        status: true,
        expiresAt: true,
        timezone: true,
      },
    });

    return this.toHoldResponse(hold);
  }

  async createFromHold(
    currentUser: AuthenticatedUserContext,
    dto: CreateBookingFromHoldDto,
  ): Promise<BookingResponseDto> {
    await this.expireStaleHolds();

    const hold = await this.prisma.bookingHold.findUnique({
      where: { id: dto.holdId },
    });

    if (!hold) {
      throw new NotFoundException(`未找到占位记录：${dto.holdId}`);
    }

    if (hold.createdByUserId !== currentUser.userId) {
      throw new ForbiddenException('当前账号无权消费该占位记录');
    }

    if (hold.status !== BookingHoldStatus.ACTIVE || hold.expiresAt <= new Date()) {
      throw new BadRequestException('当前占位已失效，请重新选择时段');
    }

    const guardianProfileId =
      hold.guardianProfileId ??
      (await this.resolveGuardianProfileIdForCurrentUser(currentUser));
    const context = await this.loadBookingContext({
      teacherProfileId: hold.teacherProfileId,
      studentProfileId: hold.studentProfileId,
      guardianProfileId,
      subjectId: hold.subjectId,
      serviceAddressId: hold.serviceAddressId,
    });

    await this.ensureNoScheduleConflict({
      teacherProfileId: hold.teacherProfileId,
      studentProfileId: hold.studentProfileId,
      startAt: hold.startAt,
      endAt: hold.endAt,
    });
    await this.ensureNoHoldConflict({
      teacherProfileId: hold.teacherProfileId,
      studentProfileId: hold.studentProfileId,
      startAt: hold.startAt,
      endAt: hold.endAt,
      excludeHoldId: hold.id,
    });

    const durationMinutes = Math.ceil(
      (hold.endAt.getTime() - hold.startAt.getTime()) / 60000,
    );
    const isTrial = dto.isTrial ?? false;
    const hourlyRate = this.pickHourlyRate(context, isTrial);
    const { subtotalAmount, totalAmount } = this.calculateAmounts({
      hourlyRate,
      durationMinutes,
      discountAmount: 0,
      platformFeeAmount: 0,
      travelFeeAmount: 0,
    });

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.bookingHold.update({
        where: { id: hold.id },
        data: { status: BookingHoldStatus.CONSUMED },
      });

      return tx.booking.create({
        data: {
          bookingNo: this.buildBookingNo(),
          teacherProfileId: hold.teacherProfileId,
          studentProfileId: hold.studentProfileId,
          guardianProfileId,
          subjectId: hold.subjectId,
          serviceAddressId: hold.serviceAddressId,
          startAt: hold.startAt,
          endAt: hold.endAt,
          timezone: hold.timezone,
          status: BookingStatus.PENDING_ACCEPTANCE,
          paymentStatus: PaymentStatus.UNPAID,
          paymentDueAt: new Date(Date.now() + 30 * 60 * 1000),
          isTrial,
          hourlyRate,
          durationMinutes,
          subtotalAmount,
          discountAmount: 0,
          platformFeeAmount: 0,
          travelFeeAmount: 0,
          totalAmount,
          planSummary: dto.planSummary?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        include: this.getBookingInclude(),
      });
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

  async findMine(
    currentUser: AuthenticatedUserContext,
    query: ListMyBookingsQueryDto,
  ): Promise<BookingListResponseDto> {
    const guardianProfileId =
      await this.resolveGuardianProfileIdForCurrentUser(currentUser);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BookingWhereInput = {
      guardianProfileId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: this.parseDate(query.from, 'from') } : {}),
              ...(query.to ? { lte: this.parseDate(query.to, 'to') } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: this.getBookingInclude(),
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
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

  async findMineOne(
    currentUser: AuthenticatedUserContext,
    id: string,
  ): Promise<BookingResponseDto> {
    const booking = await this.findBookingOrThrow(id);
    await this.assertGuardianCanAccessBooking(currentUser, booking);
    return this.toResponse(booking);
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

  async respond(
    currentUser: AuthenticatedUserContext,
    id: string,
    dto: RespondBookingDto,
  ): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);
    await this.assertTeacherCanAccessBooking(currentUser, current);

    if (current.status !== BookingStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('只有待接单状态的预约才可以处理');
    }

    if (dto.action === BookingTeacherResponseAction.ACCEPT) {
      return this.accept(currentUser, id, {
        acceptedAt: dto.respondedAt,
        planSummary: dto.planSummary,
      });
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: BookingCancellationReason.TEACHER_REQUEST,
        cancelledByUserId: currentUser.userId,
        cancelledAt: dto.respondedAt
          ? this.parseDate(dto.respondedAt, 'respondedAt')
          : new Date(),
        statusRemark: dto.reason?.trim() || '老师拒绝了本次预约',
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async accept(
    currentUser: AuthenticatedUserContext,
    id: string,
    dto: AcceptBookingDto,
  ): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);
    await this.assertTeacherCanAccessBooking(currentUser, current);

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
        statusRemark: null,
        ...(dto.planSummary !== undefined
          ? { planSummary: dto.planSummary.trim() || null }
          : {}),
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async guardianConfirm(
    currentUser: AuthenticatedUserContext,
    id: string,
    dto: ConfirmBookingDto,
  ): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);
    await this.assertGuardianCanAccessBooking(currentUser, current);

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
    currentUser: AuthenticatedUserContext | undefined,
    id: string,
    dto: UpdateBookingPaymentDto,
  ): Promise<BookingResponseDto> {
    const current = await this.findBookingOrThrow(id);

    if (currentUser?.activeRole === PlatformRole.GUARDIAN) {
      await this.assertGuardianCanAccessBooking(currentUser, current);
    }

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

    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          paymentStatus: dto.paymentStatus,
          status: nextStatus,
          statusRemark:
            dto.paymentStatus === PaymentStatus.FAILED
              ? '支付失败，请重新尝试支付'
              : current.statusRemark,
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

      if (
        dto.paymentStatus === PaymentStatus.PAID &&
        nextStatus === BookingStatus.CONFIRMED
      ) {
        await tx.lesson.upsert({
          where: { bookingId: updated.id },
          update: {},
          create: {
            bookingId: updated.id,
            teacherProfileId: updated.teacherProfileId,
            studentProfileId: updated.studentProfileId,
          },
        });
      }

      return updated;
    });

    return this.toResponse(booking);
  }

  async cancel(
    id: string,
    dto: CancelBookingDto,
    currentUser: AuthenticatedUserContext,
  ): Promise<BookingResponseDto> {
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

    if (currentUser.activeRole === PlatformRole.GUARDIAN) {
      await this.assertGuardianCanAccessBooking(currentUser, current);
    }

    if (currentUser.activeRole === PlatformRole.TEACHER) {
      await this.assertTeacherCanAccessBooking(currentUser, current);
    }

    if (dto.cancelledByUserId) {
      await this.ensureUserExists(dto.cancelledByUserId);
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: dto.cancellationReason,
        cancelledByUserId: dto.cancelledByUserId ?? currentUser.userId,
        cancelledAt: dto.cancelledAt
          ? this.parseDate(dto.cancelledAt, 'cancelledAt')
          : new Date(),
        statusRemark: dto.remark?.trim() || null,
      },
      include: this.getBookingInclude(),
    });

    return this.toResponse(booking);
  }

  async createRescheduleRequest(
    currentUser: AuthenticatedUserContext,
    id: string,
    dto: CreateRescheduleRequestDto,
  ): Promise<BookingResponseDto> {
    const booking = await this.findBookingOrThrow(id);
    const proposedStartAt = this.parseExternalDateTime(
      dto.proposedStartAt,
      'proposedStartAt',
      {
        requireExplicitTimezone: true,
        mustBeFuture: true,
      },
    );
    const proposedEndAt = this.parseExternalDateTime(
      dto.proposedEndAt,
      'proposedEndAt',
      {
        requireExplicitTimezone: true,
        mustBeFuture: true,
      },
    );

    if (proposedEndAt <= proposedStartAt) {
      throw new BadRequestException('改约结束时间必须晚于开始时间');
    }

    if (
      booking.startAt.getTime() === proposedStartAt.getTime() &&
      booking.endAt.getTime() === proposedEndAt.getTime()
    ) {
      throw new BadRequestException('建议的新时段与当前预约时间一致');
    }

    if (
      !this.hasStatus(booking.status, [
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.CONFIRMED,
      ])
    ) {
      throw new BadRequestException('当前预约状态不允许发起改约');
    }

    if (currentUser.activeRole === PlatformRole.GUARDIAN) {
      await this.assertGuardianCanAccessBooking(currentUser, booking);
    } else if (currentUser.activeRole === PlatformRole.TEACHER) {
      await this.assertTeacherCanAccessBooking(currentUser, booking);
    } else {
      throw new ForbiddenException('当前角色不允许发起改约');
    }

    const hasPending = booking.rescheduleRequests.some(
      (item) => item.status === RescheduleRequestStatus.PENDING,
    );
    if (hasPending) {
      throw new BadRequestException('当前预约已有待处理的改约请求');
    }

    const isSellable = await this.teacherAvailabilityService.hasSellableWindow(
      booking.teacherProfileId,
      proposedStartAt,
      proposedEndAt,
    );
    if (!isSellable) {
      throw new BadRequestException('建议的新时段当前不可预约');
    }

    await this.ensureNoScheduleConflict({
      teacherProfileId: booking.teacherProfileId,
      studentProfileId: booking.studentProfileId,
      startAt: proposedStartAt,
      endAt: proposedEndAt,
      excludeBookingId: booking.id,
    });

    await this.prisma.rescheduleRequest.create({
      data: {
        bookingId: booking.id,
        initiatorRole: currentUser.activeRole ?? PlatformRole.GUARDIAN,
        initiatorUserId: currentUser.userId,
        proposedStartAt,
        proposedEndAt,
        reason: dto.reason?.trim() || null,
        status: RescheduleRequestStatus.PENDING,
      },
    });

    return this.findOne(id);
  }

  async respondRescheduleRequest(
    currentUser: AuthenticatedUserContext,
    id: string,
    requestId: string,
    dto: RespondRescheduleRequestDto,
  ): Promise<BookingResponseDto> {
    const booking = await this.findBookingOrThrow(id);
    const request = booking.rescheduleRequests.find((item) => item.id === requestId);

    if (!request) {
      throw new NotFoundException(`未找到改约请求：${requestId}`);
    }

    if (request.status !== RescheduleRequestStatus.PENDING) {
      throw new BadRequestException('当前改约请求已处理');
    }

    if (request.initiatorUserId === currentUser.userId) {
      throw new ForbiddenException('发起方不能响应自己的改约请求');
    }

    if (currentUser.activeRole === PlatformRole.GUARDIAN) {
      await this.assertGuardianCanAccessBooking(currentUser, booking);
    } else if (currentUser.activeRole === PlatformRole.TEACHER) {
      await this.assertTeacherCanAccessBooking(currentUser, booking);
    } else {
      throw new ForbiddenException('当前角色不允许响应改约');
    }

    if (dto.action === RescheduleResponseAction.REJECT) {
      await this.prisma.rescheduleRequest.update({
        where: { id: requestId },
        data: {
          status: RescheduleRequestStatus.REJECTED,
          respondedAt: new Date(),
          respondedByUserId: currentUser.userId,
          reason: dto.reason?.trim() || request.reason,
        },
      });

      return this.findOne(id);
    }

    const durationMinutes = Math.ceil(
      (request.proposedEndAt.getTime() - request.proposedStartAt.getTime()) /
        60000,
    );
    if (request.proposedStartAt.getTime() <= Date.now()) {
      throw new BadRequestException('建议的新时段已早于当前时间，请重新发起改约');
    }
    const isSellable = await this.teacherAvailabilityService.hasSellableWindow(
      booking.teacherProfileId,
      request.proposedStartAt,
      request.proposedEndAt,
    );
    if (!isSellable) {
      throw new BadRequestException('建议的新时段当前已不可预约');
    }

    await this.ensureNoScheduleConflict({
      teacherProfileId: booking.teacherProfileId,
      studentProfileId: booking.studentProfileId,
      startAt: request.proposedStartAt,
      endAt: request.proposedEndAt,
      excludeBookingId: booking.id,
    });

    const { subtotalAmount, totalAmount } = this.calculateAmounts({
      hourlyRate: this.toNumber(booking.hourlyRate) ?? 0,
      durationMinutes,
      discountAmount: this.toNumber(booking.discountAmount) ?? 0,
      platformFeeAmount: this.toNumber(booking.platformFeeAmount) ?? 0,
      travelFeeAmount: this.toNumber(booking.travelFeeAmount) ?? 0,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.rescheduleRequest.update({
        where: { id: requestId },
        data: {
          status: RescheduleRequestStatus.ACCEPTED,
          respondedAt: new Date(),
          respondedByUserId: currentUser.userId,
        },
      });

      await tx.rescheduleRequest.updateMany({
        where: {
          bookingId: booking.id,
          id: { not: requestId },
          status: RescheduleRequestStatus.PENDING,
        },
        data: {
          status: RescheduleRequestStatus.CANCELLED,
          respondedAt: new Date(),
          respondedByUserId: currentUser.userId,
        },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          startAt: request.proposedStartAt,
          endAt: request.proposedEndAt,
          durationMinutes,
          discountAmount: booking.discountAmount,
          platformFeeAmount: booking.platformFeeAmount,
          travelFeeAmount: booking.travelFeeAmount,
          subtotalAmount,
          totalAmount,
          statusRemark: dto.reason?.trim() || null,
        },
      });
    });

    return this.findOne(id);
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
