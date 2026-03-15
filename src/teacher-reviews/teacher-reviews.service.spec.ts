import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
} from '@prisma/client';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';
import { TeacherReviewsService } from './teacher-reviews.service';

describe('TeacherReviewsService', () => {
  const reviewEntity = {
    id: 'review_1',
    bookingId: 'booking_1',
    teacherProfileId: 'teacher_1',
    studentProfileId: 'student_1',
    guardianProfileId: 'guardian_1',
    rating: 5,
    lessonQualityRating: 5,
    teacherPerformanceRating: 4,
    comment: '老师很有耐心',
    improvementNotes: '可以增加节奏训练',
    tags: ['耐心', '专业'],
    createdAt: new Date('2026-03-20T12:30:00.000Z'),
    updatedAt: new Date('2026-03-20T12:35:00.000Z'),
    booking: {
      id: 'booking_1',
      bookingNo: 'BK20260315ABCDE1',
      status: BookingStatus.COMPLETED,
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
    },
    guardianProfile: {
      id: 'guardian_1',
      userId: 'user_guardian_1',
      displayName: '王女士',
    },
  };

  const prisma = {
    booking: {
      findUnique: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    teacherReview: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: TeacherReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeacherReviewsService(prisma as never);
  });

  it('should create teacher review and sync rating stats', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      guardianProfileId: 'guardian_1',
      status: BookingStatus.COMPLETED,
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        teacherReview: {
          create: jest.fn().mockResolvedValue(reviewEntity),
          aggregate: jest.fn().mockResolvedValue({
            _avg: {
              rating: 5,
              lessonQualityRating: 5,
              teacherPerformanceRating: 4,
            },
            _count: { _all: 1 },
          }),
        },
        teacherProfile: {
          update: jest.fn().mockResolvedValue({ id: 'teacher_1' }),
        },
      } as never),
    );

    const result = await service.create({
      bookingId: 'booking_1',
      rating: 5,
      lessonQualityRating: 5,
      teacherPerformanceRating: 4,
      comment: '老师很有耐心',
      improvementNotes: '可以增加节奏训练',
      tags: ['耐心', '专业'],
    });

    expect(result.rating).toBe(5);
    expect(result.tags).toEqual(['耐心', '专业']);
  });

  it('should throw conflict when booking already has review', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      guardianProfileId: 'guardian_1',
      status: BookingStatus.COMPLETED,
    });
    prisma.$transaction.mockRejectedValue(createKnownRequestError('P2002'));

    await expect(
      service.create({ bookingId: 'booking_1', rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return paginated review list', async () => {
    prisma.teacherReview.findMany.mockResolvedValue([reviewEntity]);
    prisma.teacherReview.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({ page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0].teacher.displayName).toBe('李老师');
  });

  it('should return teacher review summary', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue({
      id: 'teacher_1',
      displayName: '李老师',
      ratingAvg: { toString: () => '4.75' },
      ratingCount: 8,
    });
    prisma.teacherReview.aggregate.mockResolvedValue({
      _avg: {
        lessonQualityRating: 4.9,
        teacherPerformanceRating: 4.6,
      },
    });

    const result = await service.getTeacherSummary('teacher_1');

    expect(result.ratingAvg).toBe(4.75);
    expect(result.ratingCount).toBe(8);
  });

  it('should update review and resync stats', async () => {
    prisma.teacherReview.findUnique.mockResolvedValue(reviewEntity);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        teacherReview: {
          update: jest.fn().mockResolvedValue({
            ...reviewEntity,
            rating: 4,
            comment: '老师沟通清晰',
            tags: ['沟通好'],
            aggregate: undefined,
          }),
          aggregate: jest.fn().mockResolvedValue({
            _avg: {
              rating: 4.5,
              lessonQualityRating: 4.6,
              teacherPerformanceRating: 4.4,
            },
            _count: { _all: 2 },
          }),
        },
        teacherProfile: {
          update: jest.fn().mockResolvedValue({ id: 'teacher_1' }),
        },
      } as never),
    );

    const result = await service.update('review_1', {
      rating: 4,
      comment: '老师沟通清晰',
      tags: ['沟通好'],
    });

    expect(result.rating).toBe(4);
    expect(result.tags).toEqual(['沟通好']);
  });

  it('should delete review and resync stats', async () => {
    prisma.teacherReview.findUnique.mockResolvedValue(reviewEntity);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        teacherReview: {
          delete: jest.fn().mockResolvedValue({ id: 'review_1' }),
          aggregate: jest.fn().mockResolvedValue({
            _avg: {
              rating: 0,
              lessonQualityRating: null,
              teacherPerformanceRating: null,
            },
            _count: { _all: 0 },
          }),
        },
        teacherProfile: {
          update: jest.fn().mockResolvedValue({ id: 'teacher_1' }),
        },
      } as never),
    );

    const result = await service.remove('review_1');

    expect(result.success).toBe(true);
  });

  it('should throw not found for unknown booking review', async () => {
    prisma.teacherReview.findUnique.mockResolvedValue(null);

    await expect(service.findByBookingId('booking_x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should reject creating review before booking completion', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      teacherProfileId: 'teacher_1',
      studentProfileId: 'student_1',
      guardianProfileId: 'guardian_1',
      status: BookingStatus.CONFIRMED,
    });

    await expect(
      service.create({ bookingId: 'booking_1', rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
