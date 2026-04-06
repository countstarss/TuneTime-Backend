import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PlatformRole,
  Prisma,
  TeacherReview,
} from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherReviewDto } from './dto/create-teacher-review.dto';
import { ListTeacherReviewsQueryDto } from './dto/list-teacher-reviews-query.dto';
import {
  DeleteTeacherReviewResponseDto,
  TeacherReviewListResponseDto,
  TeacherReviewResponseDto,
  TeacherReviewSummaryResponseDto,
} from './dto/teacher-review-response.dto';
import { UpdateTeacherReviewDto } from './dto/update-teacher-review.dto';

type TeacherReviewWithRelations = TeacherReview & {
  booking: {
    id: string;
    bookingNo: string;
    status: BookingStatus;
  };
  teacherProfile: {
    id: string;
    userId: string;
    displayName: string;
  };
  studentProfile: {
    id: string;
    userId: string | null;
    displayName: string;
  };
  guardianProfile: {
    id: string;
    userId: string;
    displayName: string;
  } | null;
};

@Injectable()
export class TeacherReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private roundRating(value: number | null | undefined): number {
    return Number((value ?? 0).toFixed(2));
  }

  private toNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }

    return typeof value === 'number' ? value : Number(value.toString());
  }

  private hasBookingStatus(
    status: BookingStatus,
    candidates: BookingStatus[],
  ): boolean {
    return candidates.includes(status);
  }

  private normalizeTags(tags: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags.filter((item): item is string => typeof item === 'string');
  }

  private getReviewInclude() {
    return {
      booking: {
        select: {
          id: true,
          bookingNo: true,
          status: true,
        },
      },
      teacherProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
        },
      },
      guardianProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
        },
      },
    } satisfies Prisma.TeacherReviewInclude;
  }

  private toResponse(
    review: TeacherReviewWithRelations,
  ): TeacherReviewResponseDto {
    return {
      id: review.id,
      bookingId: review.bookingId,
      teacherProfileId: review.teacherProfileId,
      studentProfileId: review.studentProfileId,
      guardianProfileId: review.guardianProfileId,
      rating: review.rating,
      lessonQualityRating: review.lessonQualityRating,
      teacherPerformanceRating: review.teacherPerformanceRating,
      comment: review.comment,
      improvementNotes: review.improvementNotes,
      tags: this.normalizeTags(review.tags),
      booking: {
        id: review.booking.id,
        bookingNo: review.booking.bookingNo,
        status: review.booking.status,
      },
      teacher: {
        id: review.teacherProfile.id,
        userId: review.teacherProfile.userId,
        displayName: review.teacherProfile.displayName,
      },
      student: {
        id: review.studentProfile.id,
        userId: review.studentProfile.userId,
        displayName: review.studentProfile.displayName,
      },
      guardian: {
        id: review.guardianProfile?.id ?? null,
        userId: review.guardianProfile?.userId ?? null,
        displayName: review.guardianProfile?.displayName ?? null,
      },
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  private async findReviewOrThrow(
    id: string,
  ): Promise<TeacherReviewWithRelations> {
    const review = await this.prisma.teacherReview.findUnique({
      where: { id },
      include: this.getReviewInclude(),
    });

    if (!review) {
      throw new NotFoundException(`未找到老师评价：${id}`);
    }

    return review;
  }

  private async findReviewByBookingIdOrThrow(
    bookingId: string,
  ): Promise<TeacherReviewWithRelations> {
    const review = await this.prisma.teacherReview.findUnique({
      where: { bookingId },
      include: this.getReviewInclude(),
    });

    if (!review) {
      throw new NotFoundException(`未找到预约 ${bookingId} 对应的老师评价`);
    }

    return review;
  }

  private isAdminUser(currentUser: AuthenticatedUserContext): boolean {
    return (
      currentUser.activeRole === PlatformRole.ADMIN ||
      currentUser.activeRole === PlatformRole.SUPER_ADMIN
    );
  }

  private ensureGuardianAccess(
    currentUser: AuthenticatedUserContext,
    review: TeacherReviewWithRelations,
  ) {
    if (this.isAdminUser(currentUser)) {
      return;
    }

    if (
      currentUser.activeRole === PlatformRole.GUARDIAN &&
      review.guardianProfile?.userId === currentUser.userId
    ) {
      return;
    }

    throw new ForbiddenException('当前账号无权访问该评价');
  }

  private async syncTeacherReviewStats(
    teacherProfileId: string,
    tx: Pick<PrismaService, 'teacherReview' | 'teacherProfile'>,
  ) {
    const aggregate = await tx.teacherReview.aggregate({
      where: { teacherProfileId },
      _avg: {
        rating: true,
        lessonQualityRating: true,
        teacherPerformanceRating: true,
      },
      _count: {
        _all: true,
      },
    });

    await tx.teacherProfile.update({
      where: { id: teacherProfileId },
      data: {
        ratingAvg: this.roundRating(aggregate._avg.rating),
        ratingCount: aggregate._count._all,
      },
    });

    return aggregate;
  }

  async create(
    currentUserOrDto: AuthenticatedUserContext | CreateTeacherReviewDto,
    maybeDto?: CreateTeacherReviewDto,
  ): Promise<TeacherReviewResponseDto> {
    const currentUser =
      'userId' in currentUserOrDto ? currentUserOrDto : undefined;
    const dto = ('userId' in currentUserOrDto ? maybeDto : currentUserOrDto) as
      | CreateTeacherReviewDto
      | undefined;

    if (!dto) {
      throw new BadRequestException('评价参数不能为空');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        teacherProfileId: true,
        studentProfileId: true,
        guardianProfileId: true,
        status: true,
        guardianProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约：${dto.bookingId}`);
    }

    if (
      !this.hasBookingStatus(booking.status, [
        BookingStatus.COMPLETED,
        BookingStatus.REFUNDED,
      ])
    ) {
      throw new BadRequestException('只有已完成或已退款的预约才可以评价');
    }

    if (
      currentUser &&
      !this.isAdminUser(currentUser) &&
      booking.guardianProfile?.userId !== currentUser.userId
    ) {
      throw new ForbiddenException('当前家长无权评价该预约');
    }

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        const createdReview = await tx.teacherReview.create({
          data: {
            bookingId: booking.id,
            teacherProfileId: booking.teacherProfileId,
            studentProfileId: booking.studentProfileId,
            guardianProfileId: booking.guardianProfileId,
            rating: dto.rating,
            lessonQualityRating: dto.lessonQualityRating ?? null,
            teacherPerformanceRating: dto.teacherPerformanceRating ?? null,
            comment: dto.comment?.trim() || null,
            improvementNotes: dto.improvementNotes?.trim() || null,
            tags: dto.tags ?? [],
          },
          include: this.getReviewInclude(),
        });

        await this.syncTeacherReviewStats(booking.teacherProfileId, tx);
        return createdReview;
      });

      return this.toResponse(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('该预约已经存在老师评价');
      }

      throw error;
    }
  }

  async findAll(
    currentUserOrQuery: AuthenticatedUserContext | ListTeacherReviewsQueryDto,
    maybeQuery?: ListTeacherReviewsQueryDto,
  ): Promise<TeacherReviewListResponseDto> {
    const currentUser =
      'userId' in currentUserOrQuery ? currentUserOrQuery : undefined;
    const query = (
      'userId' in currentUserOrQuery ? maybeQuery : currentUserOrQuery
    ) as ListTeacherReviewsQueryDto | undefined;

    if (!query) {
      throw new BadRequestException('查询参数不能为空');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const keyword = query.keyword?.trim();

    const where: Prisma.TeacherReviewWhereInput = {
      ...(query.bookingId ? { bookingId: query.bookingId.trim() } : {}),
      ...(query.teacherProfileId
        ? { teacherProfileId: query.teacherProfileId.trim() }
        : {}),
      ...(query.studentProfileId
        ? { studentProfileId: query.studentProfileId.trim() }
        : {}),
      ...(query.guardianProfileId
        ? { guardianProfileId: query.guardianProfileId.trim() }
        : {}),
      ...(keyword
        ? {
            OR: [
              {
                comment: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                improvementNotes: {
                  contains: keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                tags: {
                  array_contains: [keyword],
                },
              },
            ],
          }
        : {}),
      ...(currentUser && !this.isAdminUser(currentUser)
        ? {
            guardianProfile: {
              userId: currentUser.userId,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.teacherReview.findMany({
        where,
        include: this.getReviewInclude(),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.teacherReview.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findByBookingId(
    currentUserOrBookingId: AuthenticatedUserContext | string,
    maybeBookingId?: string,
  ): Promise<TeacherReviewResponseDto> {
    const currentUser =
      typeof currentUserOrBookingId === 'string'
        ? undefined
        : currentUserOrBookingId;
    const bookingId =
      typeof currentUserOrBookingId === 'string'
        ? currentUserOrBookingId
        : maybeBookingId;

    if (!bookingId) {
      throw new BadRequestException('bookingId 不能为空');
    }

    const review = await this.findReviewByBookingIdOrThrow(bookingId);
    if (currentUser) {
      this.ensureGuardianAccess(currentUser, review);
    }
    return this.toResponse(review);
  }

  async findOne(
    currentUserOrId: AuthenticatedUserContext | string,
    maybeId?: string,
  ): Promise<TeacherReviewResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id = typeof currentUserOrId === 'string' ? currentUserOrId : maybeId;

    if (!id) {
      throw new BadRequestException('id 不能为空');
    }

    const review = await this.findReviewOrThrow(id);
    if (currentUser) {
      this.ensureGuardianAccess(currentUser, review);
    }
    return this.toResponse(review);
  }

  async getTeacherSummary(
    teacherProfileId: string,
  ): Promise<TeacherReviewSummaryResponseDto> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      select: {
        id: true,
        displayName: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException(`未找到老师档案：${teacherProfileId}`);
    }

    const aggregate = await this.prisma.teacherReview.aggregate({
      where: { teacherProfileId },
      _avg: {
        lessonQualityRating: true,
        teacherPerformanceRating: true,
      },
    });

    return {
      teacherProfileId: teacher.id,
      displayName: teacher.displayName,
      ratingAvg: this.roundRating(this.toNumber(teacher.ratingAvg)),
      ratingCount: teacher.ratingCount,
      lessonQualityRatingAvg: this.roundRating(
        aggregate._avg.lessonQualityRating,
      ),
      teacherPerformanceRatingAvg: this.roundRating(
        aggregate._avg.teacherPerformanceRating,
      ),
    };
  }

  async update(
    currentUserOrId: AuthenticatedUserContext | string,
    idOrDto: string | UpdateTeacherReviewDto,
    maybeDto?: UpdateTeacherReviewDto,
  ): Promise<TeacherReviewResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id =
      typeof currentUserOrId === 'string'
        ? currentUserOrId
        : (idOrDto as string);
    const dto =
      typeof currentUserOrId === 'string'
        ? (idOrDto as UpdateTeacherReviewDto)
        : maybeDto;

    if (!dto) {
      throw new BadRequestException('更新参数不能为空');
    }

    const current = await this.findReviewOrThrow(id);
    if (currentUser) {
      this.ensureGuardianAccess(currentUser, current);
    }

    if (dto.bookingId && dto.bookingId !== current.bookingId) {
      throw new BadRequestException('当前版本不支持直接变更评价关联的预约');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.teacherReview.update({
        where: { id },
        data: {
          rating: dto.rating ?? current.rating,
          lessonQualityRating:
            dto.lessonQualityRating !== undefined
              ? dto.lessonQualityRating
              : current.lessonQualityRating,
          teacherPerformanceRating:
            dto.teacherPerformanceRating !== undefined
              ? dto.teacherPerformanceRating
              : current.teacherPerformanceRating,
          comment:
            dto.comment !== undefined
              ? dto.comment?.trim() || null
              : current.comment,
          improvementNotes:
            dto.improvementNotes !== undefined
              ? dto.improvementNotes?.trim() || null
              : current.improvementNotes,
          tags:
            dto.tags !== undefined
              ? dto.tags
              : this.normalizeTags(current.tags),
        },
        include: this.getReviewInclude(),
      });

      await this.syncTeacherReviewStats(current.teacherProfileId, tx);
      return updatedReview;
    });

    return this.toResponse(review);
  }

  async remove(
    currentUserOrId: AuthenticatedUserContext | string,
    maybeId?: string,
  ): Promise<DeleteTeacherReviewResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id = typeof currentUserOrId === 'string' ? currentUserOrId : maybeId;

    if (!id) {
      throw new BadRequestException('id 不能为空');
    }

    const current = await this.findReviewOrThrow(id);
    if (currentUser) {
      this.ensureGuardianAccess(currentUser, current);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherReview.delete({ where: { id } });
      await this.syncTeacherReviewStats(current.teacherProfileId, tx);
    });

    return {
      success: true,
      message: '评价已删除',
    };
  }
}
