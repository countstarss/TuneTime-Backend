import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';

describe('AddressesService', () => {
  const addressEntity = {
    id: 'addr_1',
    userId: 'user_1',
    label: '家里',
    contactName: '王女士',
    contactPhone: '13800138000',
    country: 'CN',
    province: '天津市',
    city: '天津市',
    district: '南开区',
    street: '黄河道 100 号',
    building: '3 号楼',
    latitude: { toString: () => '39.1267' },
    longitude: { toString: () => '117.2059' },
    isDefault: true,
    createdAt: new Date('2026-03-15T00:00:00.000Z'),
    updatedAt: new Date('2026-03-15T00:00:00.000Z'),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    address: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: AddressesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AddressesService(prisma as never);
  });

  it('should create default address and clear previous defaults', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_1' });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        address: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue(addressEntity),
        },
      } as never),
    );

    const result = await service.create({
      userId: 'user_1',
      contactName: '王女士',
      contactPhone: '13800138000',
      province: '天津市',
      city: '天津市',
      district: '南开区',
      street: '黄河道 100 号',
      isDefault: true,
    });

    expect(result.isDefault).toBe(true);
  });

  it('should return paginated addresses', async () => {
    prisma.address.findMany.mockResolvedValue([addressEntity]);
    prisma.address.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );

    const result = await service.findAll({
      userId: 'user_1',
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].contactName).toBe('王女士');
  });

  it('should find default address by user id', async () => {
    prisma.address.findFirst.mockResolvedValue(addressEntity);

    const result = await service.findDefaultByUserId('user_1');

    expect(result.id).toBe('addr_1');
  });

  it('should reject setting default to false', async () => {
    await expect(
      service.setDefault('addr_1', { isDefault: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should throw bad request when deleting referenced address', async () => {
    prisma.address.findUnique.mockResolvedValue(addressEntity);
    prisma.address.delete.mockRejectedValue(createKnownRequestError('P2003'));

    await expect(service.remove('addr_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw not found for unknown default address', async () => {
    prisma.address.findFirst.mockResolvedValue(null);

    await expect(service.findDefaultByUserId('user_x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
