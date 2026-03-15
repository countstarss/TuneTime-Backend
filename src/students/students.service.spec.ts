import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { GradeLevel, GuardianRelation } from '@prisma/client';
import { StudentsService } from './students.service';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';

describe('StudentsService', () => {
  const studentEntity = {
    id: 'student_1',
    userId: null,
    displayName: '小王',
    gradeLevel: GradeLevel.PRIMARY,
    dateOfBirth: new Date('2017-09-01T00:00:00.000Z'),
    schoolName: '实验小学',
    learningGoals: '钢琴启蒙',
    specialNeeds: '需要家长陪同',
    timezone: 'Asia/Shanghai',
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-15T00:00:00.000Z'),
    guardians: [
      {
        studentProfileId: 'student_1',
        guardianProfileId: 'guardian_1',
        relation: GuardianRelation.MOTHER,
        isPrimary: true,
        canBook: true,
        canViewRecords: true,
        createdAt: new Date('2026-03-15T00:00:00.000Z'),
        updatedAt: new Date('2026-03-15T00:00:00.000Z'),
        guardianProfile: {
          id: 'guardian_1',
          displayName: '王女士',
          phone: '13800138000',
        },
      },
    ],
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    guardianProfile: {
      findUnique: jest.fn(),
    },
    studentProfile: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    studentGuardian: {
      updateMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: StudentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StudentsService(prisma as never);
  });

  it('should create student with guardian bindings', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'guardian_1' });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback({
          studentProfile: {
            create: jest.fn().mockResolvedValue({ id: 'student_1' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(studentEntity),
          },
          studentGuardian: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({}),
          },
        } as never),
    );

    const result = await service.create({
      displayName: '小王',
      gradeLevel: GradeLevel.PRIMARY,
      dateOfBirth: '2017-09-01',
      schoolName: '实验小学',
      learningGoals: '钢琴启蒙',
      specialNeeds: '需要家长陪同',
      guardians: [
        {
          guardianProfileId: 'guardian_1',
          relation: GuardianRelation.MOTHER,
          isPrimary: true,
        },
      ],
    });

    expect(result.displayName).toBe('小王');
    expect(result.guardians).toHaveLength(1);
  });

  it('should return paginated students', async () => {
    prisma.studentProfile.findMany.mockResolvedValue([studentEntity]);
    prisma.studentProfile.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({
      keyword: '钢琴',
      gradeLevel: GradeLevel.PRIMARY,
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].displayName).toBe('小王');
  });

  it('should throw conflict when updating to duplicated userId', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue(studentEntity);
    prisma.user.findUnique.mockResolvedValue({ id: 'user_2' });
    prisma.studentProfile.update.mockRejectedValue(
      createKnownRequestError('P2002'),
    );

    await expect(
      service.update('student_1', {
        userId: 'user_2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should upsert guardian binding and return updated student', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue(studentEntity);
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'guardian_1' });
    prisma.studentGuardian.updateMany.mockResolvedValue({ count: 1 });
    prisma.studentGuardian.upsert.mockResolvedValue({});
    prisma.studentProfile.findUnique
      .mockResolvedValueOnce(studentEntity)
      .mockResolvedValueOnce(studentEntity);

    const result = await service.upsertGuardian('student_1', {
      guardianProfileId: 'guardian_1',
      relation: GuardianRelation.MOTHER,
      isPrimary: true,
    });

    expect(prisma.studentGuardian.upsert).toHaveBeenCalled();
    expect(result.id).toBe('student_1');
  });

  it('should throw not found when removing unknown guardian binding', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue(studentEntity);
    prisma.studentGuardian.findUnique.mockResolvedValue(null);

    await expect(
      service.removeGuardian('student_1', 'guardian_x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw bad request when deleting related student', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue(studentEntity);
    prisma.studentProfile.delete.mockRejectedValue(
      createKnownRequestError('P2003'),
    );

    await expect(service.remove('student_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
