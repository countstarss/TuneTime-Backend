import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingCancellationReason,
  BookingStatus,
  PaymentStatus,
  TeacherVerificationStatus,
} from '@prisma/client';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';
import { BookingsService } from './bookings.service';

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
      baseHourlyRate: { toString: () => '180' },
    },
    studentProfile: {
      id: 'student_1',
      userId: null,
      displayName: '小宇',
      gradeLevel: 'PRIMARY',
    },
    guardianProfile: {
      id: 'guardian_1',
      userId: 'user_guardian_1',
      displayName: '王女士',
      phone: '13800138000',
    },
    subject: {
      id: 'subject_1',
      code: 'PIANO',
      name: '钢琴',
    },
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
    booking: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: BookingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsService(prisma as never);
  });

  it('should create booking and calculate pricing from trial rate', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(bookingEntity.teacherProfile);
    prisma.studentProfile.findUnique.mockResolvedValue(bookingEntity.studentProfile);
    prisma.guardianProfile.findUnique.mockResolvedValue(bookingEntity.guardianProfile);
    prisma.subject.findUnique.mockResolvedValue(bookingEntity.subject);
    prisma.address.findUnique.mockResolvedValue(bookingEntity.serviceAddress);
    prisma.teacherSubject.findFirst.mockResolvedValue({
      id: 'teacher_subject_1',
      hourlyRate: { toString: () => '180' },
      trialRate: { toString: () => '99' },
    });
    prisma.studentGuardian.findFirst.mockResolvedValue({ id: 'student_guardian_1' });
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

  it('should move booking to pending payment after acceptance', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(bookingEntity)
      .mockResolvedValueOnce({
        ...bookingEntity,
        status: BookingStatus.PENDING_PAYMENT,
        teacherAcceptedAt: new Date('2026-03-18T09:00:00.000Z'),
      });
    prisma.booking.update.mockResolvedValue({
      ...bookingEntity,
      status: BookingStatus.PENDING_PAYMENT,
      teacherAcceptedAt: new Date('2026-03-18T09:00:00.000Z'),
    });

    const result = await service.accept('booking_1', {
      acceptedAt: '2026-03-18T09:00:00.000Z',
      planSummary: '首节课先做基础评估',
    });

    expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
  });

  it('should mark booking confirmed when payment succeeded', async () => {
    prisma.booking.findUnique.mockResolvedValue(bookingEntity);
    prisma.booking.update.mockResolvedValue({
      ...bookingEntity,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
    });

    const result = await service.updatePayment('booking_1', {
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

    const result = await service.cancel('booking_1', {
      cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
      cancelledByUserId: 'user_guardian_1',
      cancelledAt: '2026-03-18T10:30:00.000Z',
    });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(result.cancelledByUserId).toBe('user_guardian_1');
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
});
