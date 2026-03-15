import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuardianProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { GuardianAddressSummaryDto, GuardianListResponseDto, GuardianResponseDto, GuardianStudentSummaryDto, DeleteGuardianResponseDto } from './dto/guardian-response.dto';
import { ListGuardiansQueryDto } from './dto/list-guardians-query.dto';
import { SetGuardianDefaultAddressDto } from './dto/set-default-address.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  private toAddressSummary(address: {
    id: string;
    label: string | null;
    province: string;
    city: string;
    district: string;
    street: string;
  }): GuardianAddressSummaryDto {
    return {
      id: address.id,
      label: address.label,
      province: address.province,
      city: address.city,
      district: address.district,
      street: address.street,
    };
  }

  private toResponse(
    guardian: GuardianProfile & {
      defaultServiceAddress?: {
        id: string;
        label: string | null;
        province: string;
        city: string;
        district: string;
        street: string;
      } | null;
    },
  ): GuardianResponseDto {
    return {
      id: guardian.id,
      userId: guardian.userId,
      displayName: guardian.displayName,
      phone: guardian.phone,
      emergencyContactName: guardian.emergencyContactName,
      emergencyContactPhone: guardian.emergencyContactPhone,
      defaultServiceAddressId: guardian.defaultServiceAddressId,
      defaultServiceAddress: guardian.defaultServiceAddress
        ? this.toAddressSummary(guardian.defaultServiceAddress)
        : null,
      createdAt: guardian.createdAt,
      updatedAt: guardian.updatedAt,
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

  private async validateDefaultAddress(userId: string, addressId?: string | null) {
    if (!addressId) {
      return null;
    }

    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
      select: {
        id: true,
        userId: true,
        label: true,
        province: true,
        city: true,
        district: true,
        street: true,
      },
    });

    if (!address) {
      throw new NotFoundException(`未找到地址：${addressId}`);
    }

    if (address.userId !== userId) {
      throw new BadRequestException('默认服务地址必须属于当前 userId');
    }

    return address;
  }

  private async findGuardianOrThrow(id: string) {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { id },
      include: {
        defaultServiceAddress: {
          select: {
            id: true,
            label: true,
            province: true,
            city: true,
            district: true,
            street: true,
          },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException(`未找到家长档案：${id}`);
    }

    return guardian;
  }

  async create(dto: CreateGuardianDto): Promise<GuardianResponseDto> {
    await this.ensureUserExists(dto.userId);
    await this.validateDefaultAddress(dto.userId, dto.defaultServiceAddressId);

    try {
      const guardian = await this.prisma.guardianProfile.create({
        data: {
          userId: dto.userId,
          displayName: dto.displayName.trim(),
          phone: dto.phone?.trim() || null,
          emergencyContactName: dto.emergencyContactName?.trim() || null,
          emergencyContactPhone: dto.emergencyContactPhone?.trim() || null,
          defaultServiceAddressId: dto.defaultServiceAddressId ?? null,
        },
        include: {
          defaultServiceAddress: {
            select: {
              id: true,
              label: true,
              province: true,
              city: true,
              district: true,
              street: true,
            },
          },
        },
      });

      return this.toResponse(guardian);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('该用户已存在家长档案，请勿重复创建');
      }

      throw error;
    }
  }

  async findAll(query: ListGuardiansQueryDto): Promise<GuardianListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const keyword = query.keyword?.trim();

    const where: Prisma.GuardianProfileWhereInput = {
      ...(query.userId ? { userId: query.userId.trim() } : {}),
      ...(keyword
        ? {
            OR: [
              {
                displayName: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                phone: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.guardianProfile.findMany({
        where,
        include: {
          defaultServiceAddress: {
            select: {
              id: true,
              label: true,
              province: true,
              city: true,
              district: true,
              street: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.guardianProfile.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string): Promise<GuardianResponseDto> {
    const guardian = await this.findGuardianOrThrow(id);
    return this.toResponse(guardian);
  }

  async findByUserId(userId: string): Promise<GuardianResponseDto> {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { userId },
      include: {
        defaultServiceAddress: {
          select: {
            id: true,
            label: true,
            province: true,
            city: true,
            district: true,
            street: true,
          },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException(`未找到 userId 对应的家长档案：${userId}`);
    }

    return this.toResponse(guardian);
  }

  async update(id: string, dto: UpdateGuardianDto): Promise<GuardianResponseDto> {
    const current = await this.findGuardianOrThrow(id);
    const nextUserId = dto.userId?.trim() || current.userId;

    if (dto.userId && dto.userId !== current.userId) {
      await this.ensureUserExists(nextUserId);
    }

    if (dto.defaultServiceAddressId !== undefined) {
      await this.validateDefaultAddress(nextUserId, dto.defaultServiceAddressId);
    }

    try {
      const guardian = await this.prisma.guardianProfile.update({
        where: { id },
        data: {
          ...(dto.userId ? { userId: nextUserId } : {}),
          ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(dto.emergencyContactName !== undefined
            ? { emergencyContactName: dto.emergencyContactName?.trim() || null }
            : {}),
          ...(dto.emergencyContactPhone !== undefined
            ? { emergencyContactPhone: dto.emergencyContactPhone?.trim() || null }
            : {}),
          ...(dto.defaultServiceAddressId !== undefined
            ? { defaultServiceAddressId: dto.defaultServiceAddressId || null }
            : {}),
        },
        include: {
          defaultServiceAddress: {
            select: {
              id: true,
              label: true,
              province: true,
              city: true,
              district: true,
              street: true,
            },
          },
        },
      });

      return this.toResponse(guardian);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('更新失败，该用户已绑定其他家长档案');
      }

      throw error;
    }
  }

  async setDefaultAddress(
    id: string,
    dto: SetGuardianDefaultAddressDto,
  ): Promise<GuardianResponseDto> {
    const guardian = await this.findGuardianOrThrow(id);
    await this.validateDefaultAddress(
      guardian.userId,
      dto.defaultServiceAddressId ?? null,
    );

    const updated = await this.prisma.guardianProfile.update({
      where: { id },
      data: {
        defaultServiceAddressId: dto.defaultServiceAddressId || null,
      },
      include: {
        defaultServiceAddress: {
          select: {
            id: true,
            label: true,
            province: true,
            city: true,
            district: true,
            street: true,
          },
        },
      },
    });

    return this.toResponse(updated);
  }

  async listStudents(id: string): Promise<GuardianStudentSummaryDto[]> {
    await this.findGuardianOrThrow(id);

    const relations = await this.prisma.studentGuardian.findMany({
      where: { guardianProfileId: id },
      include: {
        studentProfile: {
          select: {
            id: true,
            displayName: true,
            gradeLevel: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return relations.map((relation) => ({
      studentProfileId: relation.studentProfileId,
      displayName: relation.studentProfile.displayName,
      gradeLevel: relation.studentProfile.gradeLevel,
      relation: relation.relation,
      isPrimary: relation.isPrimary,
      canBook: relation.canBook,
      canViewRecords: relation.canViewRecords,
    }));
  }

  async remove(id: string): Promise<DeleteGuardianResponseDto> {
    await this.findGuardianOrThrow(id);

    try {
      await this.prisma.guardianProfile.delete({ where: { id } });
      return {
        success: true,
        message: '家长档案已删除',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          '家长档案已关联学生、订单或评价记录，无法直接删除',
        );
      }

      throw error;
    }
  }
}
