import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TeacherProfile,
  TeacherVerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ListTeachersQueryDto } from './dto/list-teachers-query.dto';
import {
  ReplaceTeacherAvailabilityRulesDto,
  ReplaceTeacherCredentialsDto,
  ReplaceTeacherServiceAreasDto,
  ReplaceTeacherSubjectsDto,
} from './dto/replace-teacher-resources.dto';
import {
  DeleteTeacherResponseDto,
  TeacherListResponseDto,
  TeacherResponseDto,
} from './dto/teacher-response.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateTeacherVerificationDto } from './dto/update-teacher-verification.dto';

type TeacherWithRelations = TeacherProfile & {
  subjects: Array<{
    id: string;
    subjectId: string;
    hourlyRate: Prisma.Decimal;
    trialRate: Prisma.Decimal | null;
    experienceYears: number;
    isActive: boolean;
    subject: {
      id: string;
      code: string;
      name: string;
    };
  }>;
  serviceAreas: Array<{
    id: string;
    province: string;
    city: string;
    district: string;
    radiusKm: number;
  }>;
  availabilityRules: Array<{
    id: string;
    weekday: string;
    startMinute: number;
    endMinute: number;
    slotDurationMinutes: number;
    bufferMinutes: number;
    isActive: boolean;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  }>;
  credentials: Array<{
    id: string;
    credentialType: string;
    name: string;
    fileUrl: string;
    reviewStatus: string;
    reviewNotes: string | null;
    issuedBy: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    reviewedByUserId: string | null;
    reviewedAt: Date | null;
  }>;
};

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return Number(value);
  }

  private getTeacherInclude() {
    return {
      subjects: {
        include: {
          subject: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      },
      serviceAreas: {
        orderBy: [{ city: 'asc' }, { district: 'asc' }],
      },
      availabilityRules: {
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      },
      credentials: {
        orderBy: { createdAt: 'asc' },
      },
    } satisfies Prisma.TeacherProfileInclude;
  }

  private toResponse(teacher: TeacherWithRelations): TeacherResponseDto {
    return {
      id: teacher.id,
      userId: teacher.userId,
      displayName: teacher.displayName,
      bio: teacher.bio,
      employmentType: teacher.employmentType,
      verificationStatus: teacher.verificationStatus,
      baseHourlyRate: this.toNumber(teacher.baseHourlyRate) ?? 0,
      serviceRadiusKm: teacher.serviceRadiusKm,
      acceptTrial: teacher.acceptTrial,
      maxTravelMinutes: teacher.maxTravelMinutes,
      timezone: teacher.timezone,
      ratingAvg: this.toNumber(teacher.ratingAvg) ?? 0,
      ratingCount: teacher.ratingCount,
      totalCompletedLessons: teacher.totalCompletedLessons,
      agreementAcceptedAt: teacher.agreementAcceptedAt,
      agreementVersion: teacher.agreementVersion,
      interviewedAt: teacher.interviewedAt,
      interviewNotes: teacher.interviewNotes,
      onboardingCompletedAt: teacher.onboardingCompletedAt,
      subjects: teacher.subjects.map((item) => ({
        id: item.id,
        subjectId: item.subjectId,
        subjectCode: item.subject.code,
        subjectName: item.subject.name,
        hourlyRate: this.toNumber(item.hourlyRate) ?? 0,
        trialRate: this.toNumber(item.trialRate),
        experienceYears: item.experienceYears,
        isActive: item.isActive,
      })),
      serviceAreas: teacher.serviceAreas.map((item) => ({
        id: item.id,
        province: item.province,
        city: item.city,
        district: item.district,
        radiusKm: item.radiusKm,
      })),
      availabilityRules: teacher.availabilityRules.map((item) => ({
        id: item.id,
        weekday: item.weekday,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        slotDurationMinutes: item.slotDurationMinutes,
        bufferMinutes: item.bufferMinutes,
        isActive: item.isActive,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
      })),
      credentials: teacher.credentials.map((item) => ({
        id: item.id,
        credentialType: item.credentialType,
        name: item.name,
        fileUrl: item.fileUrl,
        reviewStatus: item.reviewStatus,
        reviewNotes: item.reviewNotes,
        issuedBy: item.issuedBy,
        issuedAt: item.issuedAt,
        expiresAt: item.expiresAt,
        reviewedByUserId: item.reviewedByUserId,
        reviewedAt: item.reviewedAt,
      })),
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
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

  private async ensureTeacherExists(id: string): Promise<TeacherWithRelations> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id },
      include: this.getTeacherInclude(),
    });

    if (!teacher) {
      throw new NotFoundException(`未找到老师档案：${id}`);
    }

    return teacher;
  }

  private async ensureSubjectsExist(subjectIds: string[]) {
    if (!subjectIds.length) {
      return;
    }

    const uniqueIds = Array.from(new Set(subjectIds));
    const count = await this.prisma.subject.count({
      where: { id: { in: uniqueIds } },
    });

    if (count !== uniqueIds.length) {
      throw new NotFoundException('存在无效的科目 ID');
    }
  }

  async create(dto: CreateTeacherDto): Promise<TeacherResponseDto> {
    await this.ensureUserExists(dto.userId);

    try {
      const teacher = await this.prisma.teacherProfile.create({
        data: {
          userId: dto.userId,
          displayName: dto.displayName.trim(),
          bio: dto.bio?.trim() || null,
          employmentType: dto.employmentType,
          baseHourlyRate: dto.baseHourlyRate ?? 0,
          serviceRadiusKm: dto.serviceRadiusKm ?? 10,
          acceptTrial: dto.acceptTrial ?? true,
          maxTravelMinutes: dto.maxTravelMinutes ?? 60,
          timezone: dto.timezone?.trim() || 'Asia/Shanghai',
          agreementAcceptedAt: dto.agreementAcceptedAt
            ? new Date(dto.agreementAcceptedAt)
            : null,
          agreementVersion: dto.agreementVersion?.trim() || null,
          interviewedAt: dto.interviewedAt ? new Date(dto.interviewedAt) : null,
          interviewNotes: dto.interviewNotes?.trim() || null,
          onboardingCompletedAt: dto.onboardingCompletedAt
            ? new Date(dto.onboardingCompletedAt)
            : null,
        },
        include: this.getTeacherInclude(),
      });

      return this.toResponse(teacher);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('该用户已存在老师档案，请勿重复创建');
      }

      throw error;
    }
  }

  async findAll(query: ListTeachersQueryDto): Promise<TeacherListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const keyword = query.keyword?.trim();

    const where: Prisma.TeacherProfileWhereInput = {
      ...(query.verificationStatus
        ? { verificationStatus: query.verificationStatus }
        : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.subjectId
        ? {
            subjects: {
              some: {
                subjectId: query.subjectId.trim(),
                isActive: true,
              },
            },
          }
        : {}),
      ...(query.city || query.district
        ? {
            serviceAreas: {
              some: {
                ...(query.city ? { city: query.city.trim() } : {}),
                ...(query.district ? { district: query.district.trim() } : {}),
              },
            },
          }
        : {}),
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
                bio: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.teacherProfile.findMany({
        where,
        include: this.getTeacherInclude(),
        orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.teacherProfile.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findVerified(): Promise<TeacherResponseDto[]> {
    const teachers = await this.prisma.teacherProfile.findMany({
      where: {
        verificationStatus: TeacherVerificationStatus.APPROVED,
      },
      include: this.getTeacherInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return teachers.map((item) => this.toResponse(item));
  }

  async findOne(id: string): Promise<TeacherResponseDto> {
    const teacher = await this.ensureTeacherExists(id);
    return this.toResponse(teacher);
  }

  async findByUserId(userId: string): Promise<TeacherResponseDto> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: this.getTeacherInclude(),
    });

    if (!teacher) {
      throw new NotFoundException(`未找到 userId 对应的老师档案：${userId}`);
    }

    return this.toResponse(teacher);
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<TeacherResponseDto> {
    const current = await this.ensureTeacherExists(id);
    const nextUserId = dto.userId?.trim() || current.userId;

    if (dto.userId && dto.userId !== current.userId) {
      await this.ensureUserExists(nextUserId);
    }

    try {
      const teacher = await this.prisma.teacherProfile.update({
        where: { id },
        data: {
          ...(dto.userId ? { userId: nextUserId } : {}),
          ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
          ...(dto.employmentType ? { employmentType: dto.employmentType } : {}),
          ...(dto.baseHourlyRate !== undefined
            ? { baseHourlyRate: dto.baseHourlyRate }
            : {}),
          ...(dto.serviceRadiusKm !== undefined
            ? { serviceRadiusKm: dto.serviceRadiusKm }
            : {}),
          ...(dto.acceptTrial !== undefined
            ? { acceptTrial: dto.acceptTrial }
            : {}),
          ...(dto.maxTravelMinutes !== undefined
            ? { maxTravelMinutes: dto.maxTravelMinutes }
            : {}),
          ...(dto.timezone !== undefined
            ? { timezone: dto.timezone?.trim() || 'Asia/Shanghai' }
            : {}),
          ...(dto.agreementAcceptedAt !== undefined
            ? {
                agreementAcceptedAt: dto.agreementAcceptedAt
                  ? new Date(dto.agreementAcceptedAt)
                  : null,
              }
            : {}),
          ...(dto.agreementVersion !== undefined
            ? { agreementVersion: dto.agreementVersion?.trim() || null }
            : {}),
          ...(dto.interviewedAt !== undefined
            ? {
                interviewedAt: dto.interviewedAt
                  ? new Date(dto.interviewedAt)
                  : null,
              }
            : {}),
          ...(dto.interviewNotes !== undefined
            ? { interviewNotes: dto.interviewNotes?.trim() || null }
            : {}),
          ...(dto.onboardingCompletedAt !== undefined
            ? {
                onboardingCompletedAt: dto.onboardingCompletedAt
                  ? new Date(dto.onboardingCompletedAt)
                  : null,
              }
            : {}),
        },
        include: this.getTeacherInclude(),
      });

      return this.toResponse(teacher);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('更新失败，该用户已绑定其他老师档案');
      }

      throw error;
    }
  }

  async updateVerification(
    id: string,
    dto: UpdateTeacherVerificationDto,
  ): Promise<TeacherResponseDto> {
    await this.ensureTeacherExists(id);

    const teacher = await this.prisma.teacherProfile.update({
      where: { id },
      data: {
        verificationStatus: dto.verificationStatus,
        ...(dto.interviewNotes !== undefined
          ? { interviewNotes: dto.interviewNotes.trim() }
          : {}),
      },
      include: this.getTeacherInclude(),
    });

    return this.toResponse(teacher);
  }

  async replaceSubjects(
    id: string,
    dto: ReplaceTeacherSubjectsDto,
  ): Promise<TeacherResponseDto> {
    await this.ensureTeacherExists(id);
    await this.ensureSubjectsExist(dto.items.map((item) => item.subjectId));

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherSubject.deleteMany({
        where: { teacherProfileId: id },
      });

      if (dto.items.length) {
        await tx.teacherSubject.createMany({
          data: dto.items.map((item) => ({
            teacherProfileId: id,
            subjectId: item.subjectId,
            hourlyRate: item.hourlyRate,
            trialRate: item.trialRate ?? null,
            experienceYears: item.experienceYears ?? 0,
            isActive: item.isActive ?? true,
          })),
        });
      }
    });

    return this.findOne(id);
  }

  async replaceServiceAreas(
    id: string,
    dto: ReplaceTeacherServiceAreasDto,
  ): Promise<TeacherResponseDto> {
    await this.ensureTeacherExists(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherServiceArea.deleteMany({
        where: { teacherProfileId: id },
      });

      if (dto.items.length) {
        await tx.teacherServiceArea.createMany({
          data: dto.items.map((item) => ({
            teacherProfileId: id,
            province: item.province.trim(),
            city: item.city.trim(),
            district: item.district.trim(),
            radiusKm: item.radiusKm ?? 10,
          })),
        });
      }
    });

    return this.findOne(id);
  }

  async replaceAvailabilityRules(
    id: string,
    dto: ReplaceTeacherAvailabilityRulesDto,
  ): Promise<TeacherResponseDto> {
    await this.ensureTeacherExists(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherAvailabilityRule.deleteMany({
        where: { teacherProfileId: id },
      });

      if (dto.items.length) {
        await tx.teacherAvailabilityRule.createMany({
          data: dto.items.map((item) => ({
            teacherProfileId: id,
            weekday: item.weekday,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            slotDurationMinutes: item.slotDurationMinutes ?? 60,
            bufferMinutes: item.bufferMinutes ?? 0,
            isActive: item.isActive ?? true,
            effectiveFrom: item.effectiveFrom
              ? new Date(item.effectiveFrom)
              : null,
            effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
          })),
        });
      }
    });

    return this.findOne(id);
  }

  async replaceCredentials(
    id: string,
    dto: ReplaceTeacherCredentialsDto,
  ): Promise<TeacherResponseDto> {
    await this.ensureTeacherExists(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherCredential.deleteMany({
        where: { teacherProfileId: id },
      });

      if (dto.items.length) {
        await tx.teacherCredential.createMany({
          data: dto.items.map((item) => ({
            teacherProfileId: id,
            credentialType: item.credentialType,
            name: item.name.trim(),
            fileUrl: item.fileUrl.trim(),
            issuedBy: item.issuedBy?.trim() || null,
            issuedAt: item.issuedAt ? new Date(item.issuedAt) : null,
            expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
            reviewStatus: item.reviewStatus ?? 'PENDING',
            reviewNotes: item.reviewNotes?.trim() || null,
          })),
        });
      }
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<DeleteTeacherResponseDto> {
    await this.ensureTeacherExists(id);

    try {
      await this.prisma.teacherProfile.delete({ where: { id } });
      return {
        success: true,
        message: '老师档案已删除',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          '老师档案已关联订单、课程或评价记录，无法直接删除',
        );
      }

      throw error;
    }
  }
}
