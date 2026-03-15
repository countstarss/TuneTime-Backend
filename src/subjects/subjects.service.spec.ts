import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';

describe('SubjectsService', () => {
  const subjectEntity = {
    id: 'subject_1',
    code: 'PIANO',
    name: '钢琴',
    description: '基础钢琴课程',
    isActive: true,
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-15T00:00:00.000Z'),
  };

  const prisma = {
    subject: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: SubjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubjectsService(prisma as never);
  });

  it('should create subject and normalize code', async () => {
    prisma.subject.create.mockResolvedValue(subjectEntity);

    const result = await service.create({
      code: 'piano',
      name: ' 钢琴 ',
      description: ' 基础钢琴课程 ',
      isActive: true,
    });

    expect(prisma.subject.create).toHaveBeenCalledWith({
      data: {
        code: 'PIANO',
        name: '钢琴',
        description: '基础钢琴课程',
        isActive: true,
      },
    });
    expect(result.code).toBe('PIANO');
  });

  it('should throw conflict when subject code already exists', async () => {
    prisma.subject.create.mockRejectedValue(createKnownRequestError('P2002'));

    await expect(
      service.create({
        code: 'PIANO',
        name: '钢琴',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return paginated subjects', async () => {
    prisma.subject.findMany.mockResolvedValue([subjectEntity]);
    prisma.subject.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({
      keyword: '钢琴',
      isActive: true,
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].name).toBe('钢琴');
  });

  it('should throw not found when querying unknown code', async () => {
    prisma.subject.findUnique.mockResolvedValue(null);

    await expect(service.findByCode('guitar')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should throw bad request when deleting referenced subject', async () => {
    prisma.subject.findUnique.mockResolvedValue(subjectEntity);
    prisma.subject.delete.mockRejectedValue(createKnownRequestError('P2003'));

    await expect(service.remove('subject_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
