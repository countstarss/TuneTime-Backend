import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { TeacherWorkbenchService } from './teacher-workbench.service';

describe('TeacherWorkbenchService', () => {
  const prisma = {
    teacherProfile: {
      findUnique: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const currentUser = {
    userId: 'teacher_user_001',
    roles: [],
    activeRole: null,
    status: 'ACTIVE' as any,
    tokenPayload: {},
  };

  let service: TeacherWorkbenchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeacherWorkbenchService(prisma as any);
  });

  it('should list teacher pending bookings and summary', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher_001' });
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'booking_001',
        bookingNo: 'BK001',
        status: BookingStatus.PENDING_ACCEPTANCE,
        paymentStatus: PaymentStatus.UNPAID,
        startAt: new Date('2026-03-24T11:00:00.000Z'),
        endAt: new Date('2026-03-24T12:00:00.000Z'),
        timezone: 'Asia/Shanghai',
        durationMinutes: 60,
        totalAmount: 200,
        isTrial: true,
        notes: '试听课',
        planSummary: '先做评估',
        teacherAcceptedAt: null,
        guardianConfirmedAt: null,
        createdAt: new Date('2026-03-21T09:00:00.000Z'),
        updatedAt: new Date('2026-03-21T09:00:00.000Z'),
        studentProfile: {
          id: 'student_001',
          displayName: '小宇',
          gradeLevel: 'PRIMARY',
        },
        guardianProfile: {
          id: 'guardian_001',
          displayName: '王女士',
          phone: '13800138000',
        },
        subject: {
          name: '钢琴',
        },
        serviceAddress: {
          label: '家里',
          contactName: '王女士',
          contactPhone: '13800138000',
          province: '天津市',
          city: '天津市',
          district: '南开区',
          street: '黄河道 100 号',
          building: '1 栋 1201',
        },
      },
    ]);
    prisma.booking.count.mockResolvedValue(1);
    prisma.booking.groupBy.mockResolvedValue([
      { status: BookingStatus.PENDING_ACCEPTANCE, _count: { _all: 1 } },
    ]);

    const result = await service.listPendingBookings(currentUser, {
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.summary.pendingAcceptance).toBe(1);
    expect(result.items[0]?.student.displayName).toBe('小宇');
    expect(result.items[0]?.serviceAddressSummary).toContain('黄河道 100 号');
  });

  it('should reject detail lookup for another teacher booking', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher_001' });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_001',
      teacherProfileId: 'teacher_999',
      status: BookingStatus.PENDING_ACCEPTANCE,
    });

    await expect(
      service.findPendingBookingDetail(currentUser, 'booking_001'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should reject missing teacher profile', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.listPendingBookings(currentUser, { page: 1, pageSize: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
