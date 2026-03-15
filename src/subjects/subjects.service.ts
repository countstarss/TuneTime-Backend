import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Subject } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects-query.dto';
import { UpdateSubjectStatusDto } from './dto/update-subject-status.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { DeleteSubjectResponseDto, SubjectListResponseDto, SubjectResponseDto } from './dto/subject-response.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(subject: Subject): SubjectResponseDto {
    return {
      id: subject.id,
      code: subject.code,
      name: subject.name,
      description: subject.description,
      isActive: subject.isActive,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };
  }

  private buildKeywordWhere(keyword?: string): Prisma.SubjectWhereInput | undefined {
    const value = keyword?.trim();
    if (!value) {
      return undefined;
    }

    return {
      OR: [
        { name: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { code: { contains: value.toUpperCase(), mode: Prisma.QueryMode.insensitive } },
        { description: { contains: value, mode: Prisma.QueryMode.insensitive } },
      ],
    };
  }

  private async findSubjectOrThrow(id: string): Promise<Subject> {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException(`未找到科目：${id}`);
    }
    return subject;
  }

  async create(dto: CreateSubjectDto): Promise<SubjectResponseDto> {
    try {
      const subject = await this.prisma.subject.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });

      return this.toResponse(subject);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('科目编码已存在，请更换后重试');
      }

      throw error;
    }
  }

  async findAll(query: ListSubjectsQueryDto): Promise<SubjectListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubjectWhereInput = {
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(this.buildKeywordWhere(query.keyword) ?? {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.subject.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findActive(): Promise<SubjectResponseDto[]> {
    const subjects = await this.prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return subjects.map((subject) => this.toResponse(subject));
  }

  async findOne(id: string): Promise<SubjectResponseDto> {
    const subject = await this.findSubjectOrThrow(id);
    return this.toResponse(subject);
  }

  async findByCode(code: string): Promise<SubjectResponseDto> {
    const normalizedCode = code.trim().toUpperCase();
    const subject = await this.prisma.subject.findUnique({
      where: { code: normalizedCode },
    });

    if (!subject) {
      throw new NotFoundException(`未找到科目编码：${normalizedCode}`);
    }

    return this.toResponse(subject);
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectResponseDto> {
    await this.findSubjectOrThrow(id);

    try {
      const subject = await this.prisma.subject.update({
        where: { id },
        data: {
          ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      return this.toResponse(subject);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('更新失败，科目编码已存在');
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateSubjectStatusDto,
  ): Promise<SubjectResponseDto> {
    await this.findSubjectOrThrow(id);

    const subject = await this.prisma.subject.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    return this.toResponse(subject);
  }

  async remove(id: string): Promise<DeleteSubjectResponseDto> {
    await this.findSubjectOrThrow(id);

    try {
      await this.prisma.subject.delete({ where: { id } });
      return {
        success: true,
        message: '科目已删除',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          '当前科目已被老师资料或订单引用，无法直接删除，请改为停用',
        );
      }

      throw error;
    }
  }
}
