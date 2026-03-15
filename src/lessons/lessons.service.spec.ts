import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  LessonAttendanceStatus,
} from '@prisma/client';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';
import { LessonsService } from './lessons.service';

describe('LessonsService', () => {
  const lessonEntity = {
    id: 'lesson_1',
    bookingId: 'booking_1',
    teacherProfileId: 'teacher_1',
    studentProfileId: 'student_1',
    attendanceStatus: LessonAttendanceStatus.SCHEDULED,
    checkInAt: null,
    checkInLatitude: null,
    checkInLongitude: null,
    checkInAddress: null,
    startedAt: null,
    endedAt: null,
    checkOutAt: null,
    checkOutLatitude: null,
    checkOutLongitude: null,
    checkOutAddress: null,
    teacherSummary: null,
    homework: null,
    outcomeVideoUrl: null,
    feedbackSubmittedAt: null,
    guardianFeedback: null,
    createdAt: new Date('2026-03-20T08:00:00.000Z'),
    updatedAt: new Date('2026-03-20T08:00:00.000Z'),
    booking: {
      id: 'booking_1',
      bookingNo: 'BK20260315ABCDE1',
      status: BookingStatus.CONFIRMED,
      startAt: new Date('2026-03-20T09:00:00.000Z'),
      endAt: new Date('2026-03-20T10:00:00.000Z'),
    },
    teacherProfile: {
      id: 'teacher_1',
      userId: 'user_teacher_1',
      displayName: '李老师',
    },
    studentProfile: {
      id: 'student_1',
      userId: null,
      displayName: '小宇',
      gradeLevel: 'PRIMARY',
    },
  };

  const prisma = {
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lesson: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: LessonsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LessonsService(prisma as never);
  });

  it('should create lesson from booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      status: BookingStatus.CONFIRMED,
    });
    prisma.lesson.create.mockResolvedValue(lessonEntity);

    const result = await service.create({ bookingId: 'booking_1' });

    expect(prisma.lesson.create).toHaveBeenCalled();
    expect(result.booking.bookingNo).toBe('BK20260315ABCDE1');
  });

  it('should throw conflict when booking already has lesson', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      status: BookingStatus.CONFIRMED,
    });
    prisma.lesson.create.mockRejectedValue(createKnownRequestError('P2002'));

    await expect(service.create({ bookingId: 'booking_1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should return paginated lesson list', async () => {
    prisma.lesson.findMany.mockResolvedValue([lessonEntity]);
    prisma.lesson.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({ page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0].teacher.displayName).toBe('李老师');
  });

  it('should check in lesson and move booking to in progress', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonEntity);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        lesson: {
          update: jest.fn().mockResolvedValue({
            ...lessonEntity,
            attendanceStatus: LessonAttendanceStatus.ONGOING,
            checkInAt: new Date('2026-03-20T08:58:00.000Z'),
            startedAt: new Date('2026-03-20T09:00:00.000Z'),
          }),
        },
        booking: {
          update: jest.fn().mockResolvedValue({ id: 'booking_1' }),
        },
      } as never),
    );

    const result = await service.checkIn('lesson_1', {
      checkInAt: '2026-03-20T08:58:00.000Z',
      startedAt: '2026-03-20T09:00:00.000Z',
    });

    expect(result.attendanceStatus).toBe(LessonAttendanceStatus.ONGOING);
  });

  it('should check out lesson and move booking to completed', async () => {
    prisma.lesson.findUnique.mockResolvedValue({
      ...lessonEntity,
      attendanceStatus: LessonAttendanceStatus.ONGOING,
      checkInAt: new Date('2026-03-20T08:58:00.000Z'),
      startedAt: new Date('2026-03-20T09:00:00.000Z'),
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        lesson: {
          update: jest.fn().mockResolvedValue({
            ...lessonEntity,
            attendanceStatus: LessonAttendanceStatus.COMPLETED,
            checkInAt: new Date('2026-03-20T08:58:00.000Z'),
            startedAt: new Date('2026-03-20T09:00:00.000Z'),
            checkOutAt: new Date('2026-03-20T10:05:00.000Z'),
            endedAt: new Date('2026-03-20T10:00:00.000Z'),
          }),
        },
        booking: {
          update: jest.fn().mockResolvedValue({ id: 'booking_1' }),
        },
      } as never),
    );

    const result = await service.checkOut('lesson_1', {
      checkOutAt: '2026-03-20T10:05:00.000Z',
      endedAt: '2026-03-20T10:00:00.000Z',
    });

    expect(result.attendanceStatus).toBe(LessonAttendanceStatus.COMPLETED);
  });

  it('should submit lesson feedback', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonEntity);
    prisma.lesson.update.mockResolvedValue({
      ...lessonEntity,
      teacherSummary: '完成右手五指练习',
      homework: '练习《小星星》前 8 小节',
      outcomeVideoUrl: 'https://example.com/outcome-video.mp4',
      feedbackSubmittedAt: new Date('2026-03-20T12:30:00.000Z'),
    });

    const result = await service.submitFeedback('lesson_1', {
      teacherSummary: '完成右手五指练习',
      homework: '练习《小星星》前 8 小节',
      outcomeVideoUrl: 'https://example.com/outcome-video.mp4',
      feedbackSubmittedAt: '2026-03-20T12:30:00.000Z',
    });

    expect(result.teacherSummary).toBe('完成右手五指练习');
  });

  it('should reject deleting completed lesson', async () => {
    prisma.lesson.findUnique.mockResolvedValue({
      ...lessonEntity,
      attendanceStatus: LessonAttendanceStatus.COMPLETED,
    });

    await expect(service.remove('lesson_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw not found for unknown booking lesson', async () => {
    prisma.lesson.findUnique.mockResolvedValue(null);

    await expect(service.findByBookingId('booking_x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
