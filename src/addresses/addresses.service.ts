import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import {
  AddressListResponseDto,
  AddressResponseDto,
  DeleteAddressResponseDto,
} from './dto/address-response.dto';
import { ListAddressesQueryDto } from './dto/list-addresses-query.dto';
import { SetDefaultAddressDto } from './dto/set-default-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private toResponse(address: Address): AddressResponseDto {
    return {
      id: address.id,
      userId: address.userId,
      label: address.label,
      contactName: address.contactName,
      contactPhone: address.contactPhone,
      country: address.country,
      province: address.province,
      city: address.city,
      district: address.district,
      street: address.street,
      building: address.building,
      latitude: this.toNumber(address.latitude),
      longitude: this.toNumber(address.longitude),
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`未找到关联用户：${userId}`);
    }
  }

  private async findAddressOrThrow(id: string): Promise<Address> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) {
      throw new NotFoundException(`未找到地址：${id}`);
    }
    return address;
  }

  async create(dto: CreateAddressDto): Promise<AddressResponseDto> {
    await this.ensureUserExists(dto.userId);

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId: dto.userId },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId: dto.userId,
          label: dto.label?.trim() || null,
          contactName: dto.contactName.trim(),
          contactPhone: dto.contactPhone.trim(),
          country: dto.country?.trim() || 'CN',
          province: dto.province.trim(),
          city: dto.city.trim(),
          district: dto.district.trim(),
          street: dto.street.trim(),
          building: dto.building?.trim() || null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    return this.toResponse(address);
  }

  async findAll(query: ListAddressesQueryDto): Promise<AddressListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const keyword = query.keyword?.trim();

    const where: Prisma.AddressWhereInput = {
      ...(query.userId ? { userId: query.userId.trim() } : {}),
      ...(query.city ? { city: query.city.trim() } : {}),
      ...(query.district ? { district: query.district.trim() } : {}),
      ...(typeof query.isDefault === 'boolean' ? { isDefault: query.isDefault } : {}),
      ...(keyword
        ? {
            OR: [
              {
                label: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                contactName: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                street: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                building: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.address.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.address.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findByUserId(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses.map((item) => this.toResponse(item));
  }

  async findDefaultByUserId(userId: string): Promise<AddressResponseDto> {
    const address = await this.prisma.address.findFirst({
      where: { userId, isDefault: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!address) {
      throw new NotFoundException(`未找到用户 ${userId} 的默认地址`);
    }

    return this.toResponse(address);
  }

  async findOne(id: string): Promise<AddressResponseDto> {
    const address = await this.findAddressOrThrow(id);
    return this.toResponse(address);
  }

  async update(id: string, dto: UpdateAddressDto): Promise<AddressResponseDto> {
    const current = await this.findAddressOrThrow(id);
    const nextUserId = dto.userId?.trim() || current.userId;

    if (dto.userId && dto.userId !== current.userId) {
      await this.ensureUserExists(nextUserId);
    }

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId: nextUserId },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: {
          ...(dto.userId ? { userId: nextUserId } : {}),
          ...(dto.label !== undefined ? { label: dto.label?.trim() || null } : {}),
          ...(dto.contactName ? { contactName: dto.contactName.trim() } : {}),
          ...(dto.contactPhone ? { contactPhone: dto.contactPhone.trim() } : {}),
          ...(dto.country !== undefined ? { country: dto.country?.trim() || 'CN' } : {}),
          ...(dto.province ? { province: dto.province.trim() } : {}),
          ...(dto.city ? { city: dto.city.trim() } : {}),
          ...(dto.district ? { district: dto.district.trim() } : {}),
          ...(dto.street ? { street: dto.street.trim() } : {}),
          ...(dto.building !== undefined
            ? { building: dto.building?.trim() || null }
            : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });

    return this.toResponse(address);
  }

  async setDefault(id: string, dto: SetDefaultAddressDto): Promise<AddressResponseDto> {
    if (!dto.isDefault) {
      throw new BadRequestException('默认地址接口仅支持将当前地址设为默认');
    }

    const current = await this.findAddressOrThrow(id);

    const address = await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId: current.userId },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    return this.toResponse(address);
  }

  async remove(id: string): Promise<DeleteAddressResponseDto> {
    await this.findAddressOrThrow(id);

    try {
      await this.prisma.address.delete({ where: { id } });
      return {
        success: true,
        message: '地址已删除',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('地址已被家长档案或订单引用，无法直接删除');
      }

      throw error;
    }
  }
}
