import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  TeacherEmploymentType,
  TeacherVerificationStatus,
} from '@prisma/client';
import { TeachersService } from './teachers.service';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';

describe('TeachersService', () => {
  const teacherEntity = {
    id: 'teacher_1',
    userId: 'user_teacher_1',
    displayName: '李老师',
    bio: '10 年教学经验',
    employmentType: TeacherEmploymentType.PART_TIME,
    verificationStatus: TeacherVerificationStatus.PENDING,
    baseHourlyRate: { toString: () => '180' },
    serviceRadiusKm: 10,
    acceptTrial: true,
    maxTravelMinutes: 60,
    timezone: 'Asia/Shanghai',
    ratingAvg: { toString: () => '4.5' },
    ratingCount: 12,
    totalCompletedLessons: 50,
    agreementAcceptedAt: null,
    agreementVersion: null,
    interviewedAt: null,
    interviewNotes: null,
    onboardingCompletedAt: null,
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-15T00:00:00.000Z'),
    subjects: [
      {
        id: 'ts_1',
        subjectId: 'subject_1',
        hourlyRate: { toString: () => '180' },
        trialRate: null,
        experienceYears: 5,
        isActive: true,
        subject: {
          id: 'subject_1',
          code: 'PIANO',
          name: '钢琴',
        },
      },
    ],
    serviceAreas: [],
    availabilityRules: [],
    credentials: [],
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    subject: {
      count: jest.fn(),
    },
    teacherProfile: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: TeachersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeachersService(prisma as never);
  });

  it('should create teacher profile', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_teacher_1' });
    prisma.teacherProfile.create.mockResolvedValue(teacherEntity);

    const result = await service.create({
      userId: 'user_teacher_1',
      displayName: ' 李老师 ',
      employmentType: TeacherEmploymentType.PART_TIME,
      baseHourlyRate: 180,
    });

    expect(prisma.teacherProfile.create).toHaveBeenCalled();
    expect(result.displayName).toBe('李老师');
    expect(result.baseHourlyRate).toBe(180);
  });

  it('should throw conflict when teacher user already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_teacher_1' });
    prisma.teacherProfile.create.mockRejectedValue(
      createKnownRequestError('P2002'),
    );

    await expect(
      service.create({
        userId: 'user_teacher_1',
        displayName: '李老师',
        employmentType: TeacherEmploymentType.PART_TIME,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return paginated teacher list', async () => {
    prisma.teacherProfile.findMany.mockResolvedValue([teacherEntity]);
    prisma.teacherProfile.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({
      verificationStatus: TeacherVerificationStatus.PENDING,
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].subjects[0].subjectCode).toBe('PIANO');
  });

  it('should replace teacher subjects after validating subject ids', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(teacherEntity);
    prisma.subject.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return input({
          teacherSubject: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      }

      return Promise.all(input as Array<Promise<unknown>>);
    });
    prisma.teacherProfile.findUnique
      .mockResolvedValueOnce(teacherEntity)
      .mockResolvedValueOnce(teacherEntity);

    const result = await service.replaceSubjects('teacher_1', {
      items: [
        {
          subjectId: 'subject_1',
          hourlyRate: 180,
          experienceYears: 5,
        },
      ],
    });

    expect(result.subjects).toHaveLength(1);
  });

  it('should update verification status', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(teacherEntity);
    prisma.teacherProfile.update.mockResolvedValue({
      ...teacherEntity,
      verificationStatus: TeacherVerificationStatus.APPROVED,
    });

    const result = await service.updateVerification('teacher_1', {
      verificationStatus: TeacherVerificationStatus.APPROVED,
      interviewNotes: '通过',
    });

    expect(result.verificationStatus).toBe(TeacherVerificationStatus.APPROVED);
  });

  it('should throw bad request when deleting related teacher', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(teacherEntity);
    prisma.teacherProfile.delete.mockRejectedValue(
      createKnownRequestError('P2003'),
    );

    await expect(service.remove('teacher_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw not found when querying unknown teacher userId', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValue(null);

    await expect(service.findByUserId('user_x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
