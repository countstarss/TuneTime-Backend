import {
  BookingStatus,
  TeacherVerificationStatus,
  Weekday,
} from '@prisma/client';
import { TeacherAvailabilityService } from './teacher-availability.service';

describe('TeacherAvailabilityService', () => {
  const prisma = {
    teacherProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    teacherAvailabilityRule: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    teacherAvailabilityBlock: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: TeacherAvailabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeacherAvailabilityService(prisma as any);
  });

  it('should generate monday windows from weekly rules', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue({
      id: 'teacher_1',
      timezone: 'Asia/Shanghai',
    });
    prisma.teacherAvailabilityRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        weekday: Weekday.MONDAY,
        startMinute: 19 * 60,
        endMinute: 21 * 60,
        slotDurationMinutes: 60,
        bufferMinutes: 0,
        effectiveFrom: null,
        effectiveTo: null,
        isActive: true,
      },
    ]);
    prisma.teacherAvailabilityBlock.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const result = await service.getTeacherAvailabilityWindows('teacher_1', {
      from: '2026-03-23T00:00:00.000Z',
      to: '2026-03-24T00:00:00.000Z',
    });

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]?.startAt.toISOString()).toBe(
      '2026-03-23T11:00:00.000Z',
    );
    expect(result.windows[1]?.startAt.toISOString()).toBe(
      '2026-03-23T12:00:00.000Z',
    );
  });

  it('should hide blocked or booked windows', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue({
      id: 'teacher_1',
      timezone: 'Asia/Shanghai',
    });
    prisma.teacherAvailabilityRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        weekday: Weekday.WEDNESDAY,
        startMinute: 19 * 60,
        endMinute: 21 * 60,
        slotDurationMinutes: 60,
        bufferMinutes: 0,
        effectiveFrom: null,
        effectiveTo: null,
        isActive: true,
      },
    ]);
    prisma.teacherAvailabilityBlock.findMany.mockResolvedValue([
      {
        id: 'block_1',
        startAt: new Date('2026-03-25T11:00:00.000Z'),
        endAt: new Date('2026-03-25T12:00:00.000Z'),
        reason: '请假',
      },
    ]);
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'booking_1',
        startAt: new Date('2026-03-25T12:00:00.000Z'),
        endAt: new Date('2026-03-25T13:00:00.000Z'),
        status: BookingStatus.CONFIRMED,
      },
    ]);

    const result = await service.getTeacherAvailabilityWindows('teacher_1', {
      from: '2026-03-25T00:00:00.000Z',
      to: '2026-03-26T00:00:00.000Z',
    });

    expect(result.windows).toHaveLength(0);
  });

  it('should search approved teachers with matching windows', async () => {
    prisma.teacherProfile.findMany.mockResolvedValue([
      {
        id: 'teacher_1',
        userId: 'user_teacher_1',
        displayName: '李老师',
        bio: '钢琴启蒙',
        employmentType: 'PART_TIME',
        verificationStatus: TeacherVerificationStatus.APPROVED,
        baseHourlyRate: { toString: () => '200' },
        ratingAvg: { toString: () => '4.8' },
        ratingCount: 12,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-21T00:00:00.000Z'),
        subjects: [
          {
            experienceYears: 5,
            isActive: true,
            subject: {
              id: 'subject_1',
              code: 'PIANO',
              name: '钢琴',
            },
          },
        ],
        credentials: [{ name: '教师资格证' }],
        serviceAreas: [{ district: '南开区' }],
      },
    ]);
    prisma.teacherProfile.findUnique.mockResolvedValue({
      id: 'teacher_1',
      timezone: 'Asia/Shanghai',
    });
    prisma.teacherAvailabilityRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        weekday: Weekday.TUESDAY,
        startMinute: 10 * 60,
        endMinute: 11 * 60,
        slotDurationMinutes: 60,
        bufferMinutes: 0,
        effectiveFrom: new Date('2026-03-24T00:00:00.000Z'),
        effectiveTo: new Date('2026-03-24T00:00:00.000Z'),
        isActive: true,
      },
    ]);
    prisma.teacherAvailabilityBlock.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const result = await service.searchTeachersByAvailability({
      startAt: '2026-03-24T02:00:00.000Z',
      subject: '钢琴',
      durationMinutes: 60,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.displayName).toBe('李老师');
    expect(result.items[0]?.matchingWindows).toHaveLength(1);
  });
});
