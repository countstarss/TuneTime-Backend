import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BookingCompletionStatus,
  BookingCancellationReason,
  BookingExceptionCaseStatus,
  BookingExceptionStatus,
  BookingExceptionType,
  BookingStatus,
  PaymentIntentStatus,
  PaymentStatus,
  PlatformRole,
  ResponsibilityType,
  SettlementReadiness,
  TeacherVerificationStatus,
  UserStatus,
} from '@prisma/client';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';
import { BookingsService } from './bookings.service';
import { ManualRepairAction } from './dto/manual-repair-booking.dto';

describe('BookingsService', () => {
  const bookingEntity = {
    id: 'booking_1',
    bookingNo: 'BK20260315ABCDE1',
    teacherProfileId: 'teacher_1',
    studentProfileId: 'student_1',
    guardianProfileId: 'guardian_1',
    subjectId: 'subject_1',
    serviceAddressId: 'addr_1',
    startAt: new Date('2026-03-20T09:00:00.000Z'),
    endAt: new Date('2026-03-20T10:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    status: BookingStatus.PENDING_ACCEPTANCE,
    cancellationReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    isTrial: true,
    teacherAcceptedAt: null,
    guardianConfirmedAt: null,
    hourlyRate: { toString: () => '99' },
    durationMinutes: 60,
    subtotalAmount: { toString: () => '99' },
    discountAmount: { toString: () => '10' },
    platformFeeAmount: { toString: () => '8' },
    travelFeeAmount: { toString: () => '15' },
    totalAmount: { toString: () => '112' },
    currency: 'CNY',
    paymentStatus: PaymentStatus.UNPAID,
    paymentDueAt: new Date('2026-03-19T12:00:00.000Z'),
    planSummary: '试听课先评估基础',
    notes: '需要节拍器',
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-15T00:00:00.000Z'),
    teacherProfile: {
      id: 'teacher_1',
      userId: 'user_teacher_1',
      displayName: '李老师',
      verificationStatus: TeacherVerificationStatus.APPROVED,
      onboardingCompletedAt: new Date('2026-03-18T00:00:00.000Z'),
      user: {
        realNameVerifiedAt: new Date('2026-03-18T00:00:00.000Z'),
      },
      baseHourlyRate: { toString: () => '180' },
    },
    studentProfile: {
      id: 'student_1',
      userId: null,
      displayName: '小宇',
      gradeLevel: 'PRIMARY',
      onboardingCompletedAt: null,
      user: null,
    },
    guardianProfile: {
      id: 'guardian_1',
      userId: 'user_guardian_1',
      displayName: '王女士',
      phone: '13800138000',
      onboardingCompletedAt: new Date('2026-03-18T00:00:00.000Z'),
      user: {
        realNameVerifiedAt: new Date('2026-03-18T00:00:00.000Z'),
      },
    },
    subject: {
      id: 'subject_1',
      code: 'PIANO',
      name: '钢琴',
    },
    paymentIntent: null,
    rescheduleRequests: [],
    serviceAddress: {
      id: 'addr_1',
      userId: 'user_guardian_1',
      label: '家里',
      contactName: '王女士',
      contactPhone: '13800138000',
      country: 'CN',
      province: '天津市',
      city: '天津市',
      district: '南开区',
      street: '黄河道 100 号',
      building: '3 号楼',
    },
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
    },
    studentProfile: {
      findUnique: jest.fn(),
    },
    guardianProfile: {
      findUnique: jest.fn(),
    },
    subject: {
      findUnique: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
    teacherSubject: {
      findFirst: jest.fn(),
    },
    studentGuardian: {
      findFirst: jest.fn(),
    },
    bookingHold: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bookingExceptionCase: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  };

  const teacherAvailabilityService = {
    hasSellableWindow: jest.fn(),
  };

  const bookingPaymentProjector = {
    ensurePaymentIntentForBookingTx: jest.fn(),
    resetPaymentIntentForRetryTx: jest.fn(),
    applyPaymentStateTx: jest.fn(),
  };

  const paymentsService = {
    cancelPendingBookingPayment: jest.fn(),
  };

  const teacherUser = {
    userId: 'user_teacher_1',
    activeRole: PlatformRole.TEACHER,
    roles: [PlatformRole.TEACHER],
    status: UserStatus.ACTIVE,
    tokenPayload: {},
  };

  const guardianUser = {
    userId: 'user_guardian_1',
    activeRole: PlatformRole.GUARDIAN,
    roles: [PlatformRole.GUARDIAN],
    status: UserStatus.ACTIVE,
    tokenPayload: {},
  };

  let service: BookingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEV_MVP_RELAXATIONS_ENABLED;
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.guardianProfile.findUnique.mockResolvedValue(
      bookingEntity.guardianProfile,
    );
    prisma.bookingHold.updateMany.mockResolvedValue({ count: 0 });
    prisma.bookingHold.findFirst.mockResolvedValue(null);
    prisma.bookingHold.update.mockResolvedValue(undefined);
    bookingPaymentProjector.ensurePaymentIntentForBookingTx.mockResolvedValue({
      id: 'payment_intent_1',
      bookingId: 'booking_1',
      status: PaymentIntentStatus.REQUIRES_PAYMENT,
    });
    bookingPaymentProjector.resetPaymentIntentForRetryTx.mockResolvedValue(
      undefined,
    );
    bookingPaymentProjector.applyPaymentStateTx.mockResolvedValue(undefined);
    paymentsService.cancelPendingBookingPayment.mockResolvedValue(undefined);
    service = new BookingsService(
      prisma as never,
      teacherAvailabilityService as never,
      bookingPaymentProjector as never,
      paymentsService as never,
    );
  });

  it('should create booking and calculate pricing from trial rate', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(
      bookingEntity.teacherProfile,
    );
    prisma.studentProfile.findUnique.mockResolvedValue(
      bookingEntity.studentProfile,
    );
    prisma.guardianProfile.findUnique.mockResolvedValue(
      bookingEntity.guardianProfile,
    );
    prisma.subject.findUnique.mockResolvedValue(bookingEntity.subject);
    prisma.address.findUnique.mockResolvedValue(bookingEntity.serviceAddress);
    prisma.teacherSubject.findFirst.mockResolvedValue({
      id: 'teacher_subject_1',
      hourlyRate: { toString: () => '180' },
      trialRate: { toString: () => '99' },
    });
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        onboarding_completed_at: new Date('2026-03-18T00:00:00.000Z'),
      },
    ]);
    prisma.studentGuardian.findFirst.mockResolvedValue({
      id: 'student_guardian_1',
    });
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue(bookingEntity);

    const result = await service.create({
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      guardianProfileId: 'guardian_1',
      subjectId: 'subject_1',
      serviceAddressId: 'addr_1',
      startAt: '2026-03-20T09:00:00.000Z',
      endAt: '2026-03-20T10:00:00.000Z',
      isTrial: true,
      discountAmount: 10,
      platformFeeAmount: 8,
      travelFeeAmount: 15,
      paymentDueAt: '2026-03-19T12:00:00.000Z',
      planSummary: '试听课先评估基础',
      notes: '需要节拍器',
    });

    expect(prisma.booking.create).toHaveBeenCalled();
    expect(result.hourlyRate).toBe(99);
    expect(result.totalAmount).toBe(112);
  });

  it('should return paginated booking list', async () => {
    prisma.booking.findMany.mockResolvedValue([bookingEntity]);
    prisma.booking.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({
      teacherProfileId: 'teacher_1',
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].subject.code).toBe('PIANO');
  });

  it('should allow create hold during dev MVP even when guardian has not completed real-name verification', async () => {
    process.env.DEV_MVP_RELAXATIONS_ENABLED = 'true';
    service = new BookingsService(
      prisma as never,
      teacherAvailabilityService as never,
      bookingPaymentProjector as never,
      paymentsService as never,
    );

    prisma.teacherProfile.findUnique.mockResolvedValue(
      bookingEntity.teacherProfile,
    );
    prisma.studentProfile.findUnique.mockResolvedValue(
      bookingEntity.studentProfile,
    );
    prisma.guardianProfile.findUnique.mockResolvedValue({
      ...bookingEntity.guardianProfile,
      user: {
        realNameVerifiedAt: null,
      },
    });
    prisma.subject.findUnique.mockResolvedValue(bookingEntity.subject);
    prisma.address.findUnique.mockResolvedValue(bookingEntity.serviceAddress);
    prisma.teacherSubject.findFirst.mockResolvedValue({
      id: 'teacher_subject_1',
      hourlyRate: { toString: () => '180' },
      trialRate: { toString: () => '99' },
    });
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        onboarding_completed_at: new Date('2026-03-18T00:00:00.000Z'),
      },
    ]);
    prisma.studentGuardian.findFirst.mockResolvedValue({
      id: 'student_guardian_1',
    });
    prisma.booking.findFirst.mockResolvedValue(null);
    teacherAvailabilityService.hasSellableWindow.mockResolvedValue(true);
    prisma.bookingHold.create.mockResolvedValue({
      id: 'hold_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      guardianProfileId: 'guardian_1',
      subjectId: 'subject_1',
      serviceAddressId: 'addr_1',
      startAt: new Date('2026-03-20T09:00:00.000Z'),
      endAt: new Date('2026-03-20T10:00:00.000Z'),
      status: 'ACTIVE',
      expiresAt: new Date('2026-03-20T08:05:00.000Z'),
      timezone: 'Asia/Shanghai',
    });

    const result = await service.createHold(guardianUser, {
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      subjectId: 'subject_1',
      serviceAddressId: 'addr_1',
      startAt: '2026-03-20T09:00:00.000Z',
      endAt: '2026-03-20T10:00:00.000Z',
      notes: '门口需要刷卡',
    });

    expect(result.id).toBe('hold_1');
    expect(prisma.bookingHold.create).toHaveBeenCalled();
    expect(teacherAvailabilityService.hasSellableWindow).toHaveBeenCalledWith(
      'teacher_1',
      new Date('2026-03-20T09:00:00.000Z'),
      new Date('2026-03-20T10:00:00.000Z'),
    );
  });

  it('should create booking from hold during dev MVP even when guardian has not completed real-name verification', async () => {
    process.env.DEV_MVP_RELAXATIONS_ENABLED = 'true';
    service = new BookingsService(
      prisma as never,
      teacherAvailabilityService as never,
      bookingPaymentProjector as never,
      paymentsService as never,
    );

    prisma.teacherProfile.findUnique.mockResolvedValue(
      bookingEntity.teacherProfile,
    );
    prisma.studentProfile.findUnique.mockResolvedValue(
      bookingEntity.studentProfile,
    );
    prisma.guardianProfile.findUnique.mockResolvedValue({
      ...bookingEntity.guardianProfile,
      user: {
        realNameVerifiedAt: null,
      },
    });
    prisma.subject.findUnique.mockResolvedValue(bookingEntity.subject);
    prisma.address.findUnique.mockResolvedValue(bookingEntity.serviceAddress);
    prisma.teacherSubject.findFirst.mockResolvedValue({
      id: 'teacher_subject_1',
      hourlyRate: { toString: () => '180' },
      trialRate: { toString: () => '99' },
    });
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        onboarding_completed_at: new Date('2026-03-18T00:00:00.000Z'),
      },
    ]);
    prisma.studentGuardian.findFirst.mockResolvedValue({
      id: 'student_guardian_1',
    });
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.bookingHold.findUnique.mockResolvedValue({
      id: 'hold_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      guardianProfileId: 'guardian_1',
      subjectId: 'subject_1',
      serviceAddressId: 'addr_1',
      startAt: new Date('2026-03-20T09:00:00.000Z'),
      endAt: new Date('2026-03-20T10:00:00.000Z'),
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      expiresAt: new Date('2099-03-20T08:05:00.000Z'),
      createdByUserId: 'user_guardian_1',
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        bookingHold: prisma.bookingHold,
        booking: {
          create: jest.fn().mockResolvedValue({
            ...bookingEntity,
            isTrial: false,
            planSummary: '首节课先做启蒙评估',
            notes: '门口有门禁，请提前联系。',
          }),
        },
      }),
    );

    const result = await service.createFromHold(guardianUser, {
      holdId: 'hold_1',
      isTrial: false,
      planSummary: '首节课先做启蒙评估',
      notes: '门口有门禁，请提前联系。',
    });

    expect(prisma.bookingHold.update).toHaveBeenCalledWith({
      where: { id: 'hold_1' },
      data: { status: 'CONSUMED' },
    });
    expect(result.status).toBe(BookingStatus.PENDING_ACCEPTANCE);
    expect(result.planSummary).toBe('首节课先做启蒙评估');
  });

  it('should reject create hold without guardian real-name verification when dev MVP relaxations are disabled', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(
      bookingEntity.teacherProfile,
    );
    prisma.studentProfile.findUnique.mockResolvedValue(
      bookingEntity.studentProfile,
    );
    prisma.guardianProfile.findUnique.mockResolvedValue({
      ...bookingEntity.guardianProfile,
      user: {
        realNameVerifiedAt: null,
      },
    });
    prisma.subject.findUnique.mockResolvedValue(bookingEntity.subject);
    prisma.address.findUnique.mockResolvedValue(bookingEntity.serviceAddress);
    prisma.teacherSubject.findFirst.mockResolvedValue({
      id: 'teacher_subject_1',
      hourlyRate: { toString: () => '180' },
      trialRate: { toString: () => '99' },
    });
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        onboarding_completed_at: new Date('2026-03-18T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.createHold(guardianUser, {
        teacherProfileId: 'teacher_1',
        studentProfileId: 'student_1',
        subjectId: 'subject_1',
        serviceAddressId: 'addr_1',
        startAt: '2026-03-20T09:00:00.000Z',
        endAt: '2026-03-20T10:00:00.000Z',
      }),
    ).rejects.toThrow('当前家长尚未完成实名认证，不能创建预约');
  });

  it('should move booking to pending payment after acceptance', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(bookingEntity)
      .mockResolvedValueOnce({
        ...bookingEntity,
        status: BookingStatus.PENDING_PAYMENT,
        teacherAcceptedAt: new Date('2026-03-18T09:00:00.000Z'),
        paymentIntent: {
          id: 'payment_intent_1',
          status: PaymentIntentStatus.REQUIRES_PAYMENT,
          amount: { toString: () => '112' },
          currency: 'CNY',
          expiresAt: new Date('2026-03-18T09:30:00.000Z'),
          providerPrepayId: null,
          lastNotifiedAt: null,
          capturedAt: null,
          updatedAt: new Date('2026-03-18T09:00:00.000Z'),
        },
      });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        booking: {
          update: jest.fn().mockResolvedValue(undefined),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...bookingEntity,
            status: BookingStatus.PENDING_PAYMENT,
            teacherAcceptedAt: new Date('2026-03-18T09:00:00.000Z'),
            paymentIntent: {
              id: 'payment_intent_1',
              status: PaymentIntentStatus.REQUIRES_PAYMENT,
              amount: { toString: () => '112' },
              currency: 'CNY',
              expiresAt: new Date('2026-03-18T09:30:00.000Z'),
              providerPrepayId: null,
              lastNotifiedAt: null,
              capturedAt: null,
              updatedAt: new Date('2026-03-18T09:00:00.000Z'),
            },
          }),
        },
      }),
    );

    const result = await service.accept(teacherUser, 'booking_1', {
      acceptedAt: '2026-03-18T09:00:00.000Z',
      planSummary: '首节课先做基础评估',
    });

    expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
  });

  it('should mark booking confirmed when payment succeeded', async () => {
    prisma.booking.findUnique.mockResolvedValue(bookingEntity);

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        booking: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...bookingEntity,
            status: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            paymentIntent: {
              id: 'payment_intent_1',
              status: PaymentIntentStatus.SUCCEEDED,
              amount: { toString: () => '112' },
              currency: 'CNY',
              expiresAt: new Date('2026-03-19T12:00:00.000Z'),
              providerPrepayId: 'prepay_1',
              lastNotifiedAt: new Date('2026-03-18T09:10:00.000Z'),
              capturedAt: new Date('2026-03-18T09:10:00.000Z'),
              updatedAt: new Date('2026-03-18T09:10:00.000Z'),
            },
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
      }),
    );

    const result = await service.updatePayment(guardianUser, 'booking_1', {
      paymentStatus: PaymentStatus.PAID,
    });

    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('should cancel booking with reason and operator', async () => {
    prisma.booking.findUnique.mockResolvedValue(bookingEntity);
    prisma.user.findUnique.mockResolvedValue({ id: 'user_guardian_1' });
    prisma.booking.update.mockResolvedValue({
      ...bookingEntity,
      status: BookingStatus.CANCELLED,
      cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
      cancelledByUserId: 'user_guardian_1',
      cancelledAt: new Date('2026-03-18T10:30:00.000Z'),
    });

    const result = await service.cancel(
      'booking_1',
      {
        cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
        cancelledByUserId: 'user_guardian_1',
        cancelledAt: '2026-03-18T10:30:00.000Z',
      },
      guardianUser,
    );

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(result.cancelledByUserId).toBe('user_guardian_1');
  });

  it('should cancel pending payment booking through payments service', async () => {
    const cancelledAt = new Date('2026-03-18T10:30:00.000Z');
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        ...bookingEntity,
        status: BookingStatus.PENDING_PAYMENT,
        paymentIntent: {
          id: 'payment_intent_1',
          status: PaymentIntentStatus.REQUIRES_PAYMENT,
          amount: { toString: () => '112' },
          currency: 'CNY',
          expiresAt: bookingEntity.paymentDueAt,
          providerPrepayId: 'prepay_1',
          lastNotifiedAt: null,
          capturedAt: null,
          updatedAt: new Date('2026-03-18T10:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({
        ...bookingEntity,
        status: BookingStatus.CANCELLED,
        cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
        cancelledByUserId: 'user_guardian_1',
        cancelledAt,
        statusRemark: '家长取消',
        paymentIntent: {
          id: 'payment_intent_1',
          status: PaymentIntentStatus.CANCELLED,
          amount: { toString: () => '112' },
          currency: 'CNY',
          expiresAt: bookingEntity.paymentDueAt,
          providerPrepayId: 'prepay_1',
          lastNotifiedAt: null,
          capturedAt: null,
          updatedAt: new Date('2026-03-18T10:31:00.000Z'),
        },
      });
    prisma.user.findUnique.mockResolvedValue({ id: 'user_guardian_1' });

    const result = await service.cancel(
      'booking_1',
      {
        cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
        cancelledByUserId: 'user_guardian_1',
        cancelledAt: cancelledAt.toISOString(),
        remark: '家长取消',
      },
      guardianUser,
    );

    expect(paymentsService.cancelPendingBookingPayment).toHaveBeenCalledWith({
      paymentIntentId: 'payment_intent_1',
      paymentDueAt: bookingEntity.paymentDueAt,
      cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
      cancelledAt,
      cancelledByUserId: 'user_guardian_1',
      remark: '家长取消',
    });
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.CANCELLED);
  });

  it('should reject direct cancellation for paid booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...bookingEntity,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
    });

    await expect(
      service.cancel(
        'booking_1',
        {
          cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
        },
        guardianUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject reschedule requests in the past', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...bookingEntity,
      status: BookingStatus.CONFIRMED,
      rescheduleRequests: [],
    });

    await expect(
      service.createRescheduleRequest(guardianUser, 'booking_1', {
        proposedStartAt: '2020-03-18T10:30:00.000Z',
        proposedEndAt: '2020-03-18T11:30:00.000Z',
        reason: '时间冲突',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject deleting booking when constrained by foreign keys', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...bookingEntity,
      status: BookingStatus.CANCELLED,
    });
    prisma.booking.delete.mockRejectedValue(createKnownRequestError('P2003'));

    await expect(service.remove('booking_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw not found for unknown booking number', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(service.findByBookingNo('BK404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should clear blocking flags after manual check-out resolves the last exception', async () => {
    const bookingWithException = {
      ...bookingEntity,
      status: BookingStatus.IN_PROGRESS,
      completionStatus: BookingCompletionStatus.DISPUTED,
      exceptionStatus: BookingExceptionStatus.BLOCKING,
      settlementReadiness: SettlementReadiness.BLOCKED,
      exceptionCases: [
        {
          id: 'case_1',
          exceptionType: BookingExceptionType.OVERDUE_NOT_FINISHED,
          status: BookingExceptionCaseStatus.OPEN,
          responsibilityType: ResponsibilityType.UNKNOWN,
          summary: '已过下课时间，老师仍未签退',
          resolution: null,
          createdByUserId: 'user_guardian_1',
          resolvedByUserId: null,
          createdAt: new Date('2026-03-20T10:30:00.000Z'),
          updatedAt: new Date('2026-03-20T10:30:00.000Z'),
        },
      ],
    };

    prisma.booking.findUnique
      .mockResolvedValueOnce(bookingWithException)
      .mockResolvedValueOnce({
        ...bookingWithException,
        status: BookingStatus.COMPLETED,
        completionStatus: BookingCompletionStatus.PENDING_TEACHER_RECORD,
        exceptionStatus: BookingExceptionStatus.NONE,
        settlementReadiness: SettlementReadiness.NOT_READY,
      });
    prisma.adminAuditLog.create.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        lesson: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'lesson_1',
            startedAt: new Date('2026-03-20T09:00:00.000Z'),
            checkInAt: new Date('2026-03-20T09:00:00.000Z'),
          }),
          update: jest.fn().mockResolvedValue(undefined),
        },
        booking: {
          update: jest.fn().mockResolvedValue(undefined),
        },
        bookingExceptionCase: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          count: jest.fn().mockResolvedValue(0),
        },
      }),
    );

    const result = await service.manualRepair(
      {
        userId: 'admin_1',
        activeRole: PlatformRole.ADMIN,
        roles: [PlatformRole.ADMIN],
        status: UserStatus.ACTIVE,
        tokenPayload: {},
      },
      'booking_1',
      {
        action: ManualRepairAction.CHECK_OUT,
        note: '后台补录签退',
        exceptionType: BookingExceptionType.OVERDUE_NOT_FINISHED,
        checkOutAt: '2026-03-20T10:05:00.000Z',
      },
    );

    expect(result.status).toBe(BookingStatus.COMPLETED);
    expect(result.exceptionStatus).toBe(BookingExceptionStatus.NONE);
    expect(result.settlementReadiness).toBe(SettlementReadiness.NOT_READY);
    expect(result.completionStatus).toBe(
      BookingCompletionStatus.PENDING_TEACHER_RECORD,
    );
  });
});
