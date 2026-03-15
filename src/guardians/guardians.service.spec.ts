import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';

describe('GuardiansService', () => {
  const addressEntity = {
    id: 'addr_1',
    userId: 'user_1',
    label: '家里',
    province: '天津市',
    city: '天津市',
    district: '南开区',
    street: '黄河道 100 号',
  };

  const guardianEntity = {
    id: 'guardian_1',
    userId: 'user_1',
    displayName: '王女士',
    phone: '13800138000',
    emergencyContactName: '王先生',
    emergencyContactPhone: '13900139000',
    defaultServiceAddressId: 'addr_1',
    defaultServiceAddress: addressEntity,
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-15T00:00:00.000Z'),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
    guardianProfile: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    studentGuardian: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: GuardiansService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GuardiansService(prisma as never);
  });

  it('should create guardian with default address', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_1' });
    prisma.address.findUnique.mockResolvedValue(addressEntity);
    prisma.guardianProfile.create.mockResolvedValue(guardianEntity);

    const result = await service.create({
      userId: 'user_1',
      displayName: ' 王女士 ',
      phone: '13800138000',
      emergencyContactName: '王先生',
      emergencyContactPhone: '13900139000',
      defaultServiceAddressId: 'addr_1',
    });

    expect(prisma.guardianProfile.create).toHaveBeenCalled();
    expect(result.defaultServiceAddress?.id).toBe('addr_1');
  });

  it('should throw conflict when guardian profile already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_1' });
    prisma.address.findUnique.mockResolvedValue(addressEntity);
    prisma.guardianProfile.create.mockRejectedValue(
      createKnownRequestError('P2002'),
    );

    await expect(
      service.create({
        userId: 'user_1',
        displayName: '王女士',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should reject default address that belongs to another user', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue(guardianEntity);
    prisma.address.findUnique.mockResolvedValue({
      ...addressEntity,
      userId: 'user_2',
    });

    await expect(
      service.setDefaultAddress('guardian_1', { defaultServiceAddressId: 'addr_1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should list guardian students', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue(guardianEntity);
    prisma.studentGuardian.findMany.mockResolvedValue([
      {
        studentProfileId: 'student_1',
        guardianProfileId: 'guardian_1',
        relation: 'MOTHER',
        isPrimary: true,
        canBook: true,
        canViewRecords: true,
        createdAt: new Date('2026-03-15T00:00:00.000Z'),
        updatedAt: new Date('2026-03-15T00:00:00.000Z'),
        studentProfile: {
          id: 'student_1',
          displayName: '小王',
          gradeLevel: 'PRIMARY',
        },
      },
    ]);

    const result = await service.listStudents('guardian_1');

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('小王');
  });

  it('should throw bad request when deleting guardian with relations', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue(guardianEntity);
    prisma.guardianProfile.delete.mockRejectedValue(createKnownRequestError('P2003'));

    await expect(service.remove('guardian_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw not found when querying unknown userId', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue(null);

    await expect(service.findByUserId('user_x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
