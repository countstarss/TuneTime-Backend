import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StudentProfile, StudentGuardian } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStudentDto,
  CreateStudentGuardianBindingDto,
} from './dto/create-student.dto';
import {
  DeleteStudentResponseDto,
  StudentGuardianResponseDto,
  StudentListResponseDto,
  StudentResponseDto,
} from './dto/student-response.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpsertStudentGuardianDto } from './dto/upsert-student-guardian.dto';

type StudentWithRelations = StudentProfile & {
  guardians: Array<
    StudentGuardian & {
      guardianProfile: {
        id: string;
        displayName: string;
        phone: string | null;
      };
    }
  >;
};

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toGuardianResponse(
    relation: StudentWithRelations['guardians'][number],
  ): StudentGuardianResponseDto {
    return {
      guardianProfileId: relation.guardianProfileId,
      displayName: relation.guardianProfile.displayName,
      phone: relation.guardianProfile.phone,
      relation: relation.relation,
      isPrimary: relation.isPrimary,
      canBook: relation.canBook,
      canViewRecords: relation.canViewRecords,
    };
  }

  private toResponse(student: StudentWithRelations): StudentResponseDto {
    return {
      id: student.id,
      userId: student.userId,
      displayName: student.displayName,
      gradeLevel: student.gradeLevel,
      dateOfBirth: student.dateOfBirth,
      schoolName: student.schoolName,
      learningGoals: student.learningGoals,
      specialNeeds: student.specialNeeds,
      timezone: student.timezone,
      guardians: student.guardians.map((item) => this.toGuardianResponse(item)),
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  private getStudentInclude() {
    return {
      guardians: {
        include: {
          guardianProfile: {
            select: {
              id: true,
              displayName: true,
              phone: true,
            },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    } satisfies Prisma.StudentProfileInclude;
  }

  private async ensureUserExists(userId?: string | null) {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`未找到关联用户：${userId}`);
    }
  }

  private async ensureGuardianExists(guardianProfileId: string) {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { id: guardianProfileId },
      select: { id: true },
    });

    if (!guardian) {
      throw new NotFoundException(`未找到家长档案：${guardianProfileId}`);
    }
  }

  private async findStudentOrThrow(id: string): Promise<StudentWithRelations> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: this.getStudentInclude(),
    });

    if (!student) {
      throw new NotFoundException(`未找到学生档案：${id}`);
    }

    return student;
  }

  private async syncGuardianBindings(
    studentId: string,
    bindings: CreateStudentGuardianBindingDto[] | UpsertStudentGuardianDto[],
  ) {
    for (const binding of bindings) {
      await this.ensureGuardianExists(binding.guardianProfileId);

      if (binding.isPrimary) {
        await this.prisma.studentGuardian.updateMany({
          where: { studentProfileId: studentId },
          data: { isPrimary: false },
        });
      }

      await this.prisma.studentGuardian.upsert({
        where: {
          studentProfileId_guardianProfileId: {
            studentProfileId: studentId,
            guardianProfileId: binding.guardianProfileId,
          },
        },
        create: {
          studentProfileId: studentId,
          guardianProfileId: binding.guardianProfileId,
          relation: binding.relation,
          isPrimary: binding.isPrimary ?? false,
          canBook: binding.canBook ?? true,
          canViewRecords: binding.canViewRecords ?? true,
        },
        update: {
          relation: binding.relation,
          isPrimary: binding.isPrimary ?? false,
          canBook: binding.canBook ?? true,
          canViewRecords: binding.canViewRecords ?? true,
        },
      });
    }
  }

  async create(dto: CreateStudentDto): Promise<StudentResponseDto> {
    await this.ensureUserExists(dto.userId);

    try {
      const student = await this.prisma.$transaction(async (tx) => {
        const created = await tx.studentProfile.create({
          data: {
            userId: dto.userId ?? null,
            displayName: dto.displayName.trim(),
            gradeLevel: dto.gradeLevel,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            schoolName: dto.schoolName?.trim() || null,
            learningGoals: dto.learningGoals?.trim() || null,
            specialNeeds: dto.specialNeeds?.trim() || null,
            timezone: dto.timezone?.trim() || 'Asia/Shanghai',
          },
        });

        if (dto.guardians?.length) {
          for (const binding of dto.guardians) {
            if (binding.isPrimary) {
              await tx.studentGuardian.updateMany({
                where: { studentProfileId: created.id },
                data: { isPrimary: false },
              });
            }

            await this.ensureGuardianExists(binding.guardianProfileId);

            await tx.studentGuardian.create({
              data: {
                studentProfileId: created.id,
                guardianProfileId: binding.guardianProfileId,
                relation: binding.relation,
                isPrimary: binding.isPrimary ?? false,
                canBook: binding.canBook ?? true,
                canViewRecords: binding.canViewRecords ?? true,
              },
            });
          }
        }

        return tx.studentProfile.findUniqueOrThrow({
          where: { id: created.id },
          include: this.getStudentInclude(),
        });
      });

      return this.toResponse(student);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          '学生档案创建失败，userId 或家长绑定可能已重复',
        );
      }

      throw error;
    }
  }

  async findAll(query: ListStudentsQueryDto): Promise<StudentListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const keyword = query.keyword?.trim();

    const where: Prisma.StudentProfileWhereInput = {
      ...(query.gradeLevel ? { gradeLevel: query.gradeLevel } : {}),
      ...(query.userId ? { userId: query.userId.trim() } : {}),
      ...(query.guardianProfileId
        ? {
            guardians: {
              some: { guardianProfileId: query.guardianProfileId.trim() },
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
                schoolName: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                learningGoals: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where,
        include: this.getStudentInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.studentProfile.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string): Promise<StudentResponseDto> {
    const student = await this.findStudentOrThrow(id);
    return this.toResponse(student);
  }

  async findByUserId(userId: string): Promise<StudentResponseDto> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: this.getStudentInclude(),
    });

    if (!student) {
      throw new NotFoundException(`未找到 userId 对应的学生档案：${userId}`);
    }

    return this.toResponse(student);
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentResponseDto> {
    const current = await this.findStudentOrThrow(id);
    const nextUserId = dto.userId !== undefined ? dto.userId : current.userId;
    await this.ensureUserExists(nextUserId);

    try {
      const student = await this.prisma.studentProfile.update({
        where: { id },
        data: {
          ...(dto.userId !== undefined ? { userId: dto.userId || null } : {}),
          ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.gradeLevel ? { gradeLevel: dto.gradeLevel } : {}),
          ...(dto.dateOfBirth !== undefined
            ? {
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
              }
            : {}),
          ...(dto.schoolName !== undefined
            ? { schoolName: dto.schoolName?.trim() || null }
            : {}),
          ...(dto.learningGoals !== undefined
            ? { learningGoals: dto.learningGoals?.trim() || null }
            : {}),
          ...(dto.specialNeeds !== undefined
            ? { specialNeeds: dto.specialNeeds?.trim() || null }
            : {}),
          ...(dto.timezone !== undefined
            ? { timezone: dto.timezone?.trim() || 'Asia/Shanghai' }
            : {}),
        },
        include: this.getStudentInclude(),
      });

      if (dto.guardians) {
        await this.syncGuardianBindings(id, dto.guardians);
        return this.findOne(id);
      }

      return this.toResponse(student);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('更新失败，userId 已被其他学生档案占用');
      }

      throw error;
    }
  }

  async upsertGuardian(
    id: string,
    dto: UpsertStudentGuardianDto,
  ): Promise<StudentResponseDto> {
    await this.findStudentOrThrow(id);
    await this.syncGuardianBindings(id, [dto]);
    return this.findOne(id);
  }

  async removeGuardian(
    id: string,
    guardianProfileId: string,
  ): Promise<StudentResponseDto> {
    await this.findStudentOrThrow(id);

    const relation = await this.prisma.studentGuardian.findUnique({
      where: {
        studentProfileId_guardianProfileId: {
          studentProfileId: id,
          guardianProfileId,
        },
      },
    });

    if (!relation) {
      throw new NotFoundException('未找到该学生与家长的绑定关系');
    }

    await this.prisma.studentGuardian.delete({
      where: {
        studentProfileId_guardianProfileId: {
          studentProfileId: id,
          guardianProfileId,
        },
      },
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<DeleteStudentResponseDto> {
    await this.findStudentOrThrow(id);

    try {
      await this.prisma.studentProfile.delete({ where: { id } });
      return {
        success: true,
        message: '学生档案已删除',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          '学生档案已关联订单、课程或评价记录，无法直接删除',
        );
      }

      throw error;
    }
  }
}
