import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingCompletionStatus,
  BookingStatus,
  Lesson,
  LessonAttendanceStatus,
  LessonEvidenceType,
  PlatformRole,
  Prisma,
  SettlementReadiness,
} from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInLessonDto } from './dto/check-in-lesson.dto';
import { CheckOutLessonDto } from './dto/check-out-lesson.dto';
import { CreateLessonEvidenceDto } from './dto/create-lesson-evidence.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  DeleteLessonResponseDto,
  LessonListResponseDto,
  LessonResponseDto,
} from './dto/lesson-response.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { SubmitLessonFeedbackDto } from './dto/submit-lesson-feedback.dto';
import { UpdateLessonAttendanceDto } from './dto/update-lesson-attendance.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

type LessonWithRelations = Lesson & {
  booking: {
    id: string;
    bookingNo: string;
    status: BookingStatus;
    startAt: Date;
    endAt: Date;
    guardianProfile: {
      userId: string;
    } | null;
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
    gradeLevel: string | null;
  };
  evidences: Array<{
    id: string;
    type: LessonEvidenceType;
    url: string;
    note: string | null;
    uploadedByUserId: string;
    uploadedAt: Date;
  }>;
};

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly removableStatuses: LessonAttendanceStatus[] = [
    LessonAttendanceStatus.SCHEDULED,
    LessonAttendanceStatus.CANCELLED,
  ];

  private parseDate(value: string | Date, fieldName: string): Date {
    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} 不是有效的日期时间`);
    }

    return parsed;
  }

  private toNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private hasAttendanceStatus(
    status: LessonAttendanceStatus,
    candidates: LessonAttendanceStatus[],
  ): boolean {
    return candidates.includes(status);
  }

  private hasBookingStatus(
    status: BookingStatus,
    candidates: BookingStatus[],
  ): boolean {
    return candidates.includes(status);
  }

  private getLessonInclude() {
    return {
      booking: {
        select: {
          id: true,
          bookingNo: true,
          status: true,
          startAt: true,
          endAt: true,
          guardianProfile: {
            select: {
              userId: true,
            },
          },
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
          gradeLevel: true,
        },
      },
      evidences: {
        orderBy: [{ uploadedAt: 'desc' }],
        select: {
          id: true,
          type: true,
          url: true,
          note: true,
          uploadedByUserId: true,
          uploadedAt: true,
        },
      },
    } satisfies Prisma.LessonInclude;
  }

  private toResponse(lesson: LessonWithRelations): LessonResponseDto {
    return {
      id: lesson.id,
      bookingId: lesson.bookingId,
      teacherProfileId: lesson.teacherProfileId,
      studentProfileId: lesson.studentProfileId,
      attendanceStatus: lesson.attendanceStatus,
      arrivalConfirmedAt: lesson.arrivalConfirmedAt,
      arrivalLatitude: this.toNumber(lesson.arrivalLatitude),
      arrivalLongitude: this.toNumber(lesson.arrivalLongitude),
      arrivalAddress: lesson.arrivalAddress,
      arrivalNote: lesson.arrivalNote,
      checkInAt: lesson.checkInAt,
      checkInLatitude: this.toNumber(lesson.checkInLatitude),
      checkInLongitude: this.toNumber(lesson.checkInLongitude),
      checkInAddress: lesson.checkInAddress,
      startedAt: lesson.startedAt,
      endedAt: lesson.endedAt,
      checkOutAt: lesson.checkOutAt,
      checkOutLatitude: this.toNumber(lesson.checkOutLatitude),
      checkOutLongitude: this.toNumber(lesson.checkOutLongitude),
      checkOutAddress: lesson.checkOutAddress,
      teacherSummary: lesson.teacherSummary,
      homework: lesson.homework,
      outcomeVideoUrl: lesson.outcomeVideoUrl,
      feedbackSubmittedAt: lesson.feedbackSubmittedAt,
      guardianFeedback: lesson.guardianFeedback,
      booking: {
        id: lesson.booking.id,
        bookingNo: lesson.booking.bookingNo,
        status: lesson.booking.status,
        startAt: lesson.booking.startAt,
        endAt: lesson.booking.endAt,
      },
      teacher: {
        id: lesson.teacherProfile.id,
        userId: lesson.teacherProfile.userId,
        displayName: lesson.teacherProfile.displayName,
      },
      student: {
        id: lesson.studentProfile.id,
        userId: lesson.studentProfile.userId,
        displayName: lesson.studentProfile.displayName,
        gradeLevel: lesson.studentProfile.gradeLevel,
      },
      evidences: (lesson.evidences ?? []).map((item) => ({
        id: item.id,
        type: item.type,
        url: item.url,
        note: item.note,
        uploadedByUserId: item.uploadedByUserId,
        uploadedAt: item.uploadedAt,
      })),
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  private async findLessonOrThrow(id: string): Promise<LessonWithRelations> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: this.getLessonInclude(),
    });

    if (!lesson) {
      throw new NotFoundException(`未找到课程：${id}`);
    }

    return lesson;
  }

  private ensureLessonAccess(
    currentUser: AuthenticatedUserContext,
    lesson: LessonWithRelations,
  ) {
    if (
      currentUser.activeRole === PlatformRole.ADMIN ||
      currentUser.activeRole === PlatformRole.SUPER_ADMIN
    ) {
      return;
    }

    if (
      currentUser.activeRole === PlatformRole.TEACHER &&
      lesson.teacherProfile.userId === currentUser.userId
    ) {
      return;
    }

    if (
      currentUser.activeRole === PlatformRole.GUARDIAN &&
      lesson.booking.guardianProfile?.userId === currentUser.userId
    ) {
      return;
    }

    throw new ForbiddenException('当前账号无权访问该课程记录');
  }

  private async findLessonByBookingIdOrThrow(
    bookingId: string,
  ): Promise<LessonWithRelations> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { bookingId },
      include: this.getLessonInclude(),
    });

    if (!lesson) {
      throw new NotFoundException(`未找到预约 ${bookingId} 对应的课程记录`);
    }

    return lesson;
  }

  async create(dto: CreateLessonDto): Promise<LessonResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        teacherProfileId: true,
        studentProfileId: true,
        status: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约：${dto.bookingId}`);
    }

    if (
      this.hasBookingStatus(booking.status, [
        BookingStatus.CANCELLED,
        BookingStatus.REFUNDED,
        BookingStatus.EXPIRED,
      ])
    ) {
      throw new BadRequestException('当前预约状态不能创建课程记录');
    }

    try {
      const lesson = await this.prisma.lesson.create({
        data: {
          bookingId: booking.id,
          teacherProfileId: booking.teacherProfileId,
          studentProfileId: booking.studentProfileId,
        },
        include: this.getLessonInclude(),
      });

      return this.toResponse(lesson);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('该预约已经存在课程记录');
      }

      throw error;
    }
  }

  async findAll(query: ListLessonsQueryDto): Promise<LessonListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.LessonWhereInput = {
      ...(query.bookingId ? { bookingId: query.bookingId.trim() } : {}),
      ...(query.teacherProfileId
        ? { teacherProfileId: query.teacherProfileId.trim() }
        : {}),
      ...(query.studentProfileId
        ? { studentProfileId: query.studentProfileId.trim() }
        : {}),
      ...(query.attendanceStatus
        ? { attendanceStatus: query.attendanceStatus }
        : {}),
      ...(query.createdAtFrom || query.createdAtTo
        ? {
            createdAt: {
              ...(query.createdAtFrom
                ? { gte: this.parseDate(query.createdAtFrom, 'createdAtFrom') }
                : {}),
              ...(query.createdAtTo
                ? { lte: this.parseDate(query.createdAtTo, 'createdAtTo') }
                : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        include: this.getLessonInclude(),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.lesson.count({ where }),
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
  ): Promise<LessonResponseDto> {
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

    const lesson = await this.findLessonByBookingIdOrThrow(bookingId);
    if (currentUser) {
      this.ensureLessonAccess(currentUser, lesson);
    }
    return this.toResponse(lesson);
  }

  async findOne(
    currentUserOrId: AuthenticatedUserContext | string,
    maybeId?: string,
  ): Promise<LessonResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id = typeof currentUserOrId === 'string' ? currentUserOrId : maybeId;

    if (!id) {
      throw new BadRequestException('id 不能为空');
    }

    const lesson = await this.findLessonOrThrow(id);
    if (currentUser) {
      this.ensureLessonAccess(currentUser, lesson);
    }
    return this.toResponse(lesson);
  }

  async update(id: string, dto: UpdateLessonDto): Promise<LessonResponseDto> {
    const current = await this.findLessonOrThrow(id);
    const startedAt = dto.startedAt
      ? this.parseDate(dto.startedAt, 'startedAt')
      : current.startedAt;
    const endedAt = dto.endedAt
      ? this.parseDate(dto.endedAt, 'endedAt')
      : current.endedAt;

    if (startedAt && endedAt && endedAt < startedAt) {
      throw new BadRequestException('课程结束时间不能早于开始时间');
    }

    const lesson = await this.prisma.lesson.update({
      where: { id },
      data: {
        startedAt,
        endedAt,
        teacherSummary:
          dto.teacherSummary !== undefined
            ? dto.teacherSummary.trim() || null
            : current.teacherSummary,
        homework:
          dto.homework !== undefined
            ? dto.homework.trim() || null
            : current.homework,
        outcomeVideoUrl:
          dto.outcomeVideoUrl !== undefined
            ? dto.outcomeVideoUrl.trim() || null
            : current.outcomeVideoUrl,
        guardianFeedback:
          dto.guardianFeedback !== undefined
            ? dto.guardianFeedback.trim() || null
            : current.guardianFeedback,
        feedbackSubmittedAt:
          dto.feedbackSubmittedAt !== undefined
            ? dto.feedbackSubmittedAt
              ? this.parseDate(dto.feedbackSubmittedAt, 'feedbackSubmittedAt')
              : null
            : current.feedbackSubmittedAt,
      },
      include: this.getLessonInclude(),
    });

    return this.toResponse(lesson);
  }

  async checkIn(
    currentUserOrId: AuthenticatedUserContext | string,
    idOrDto: string | CheckInLessonDto,
    maybeDto?: CheckInLessonDto,
  ): Promise<LessonResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id =
      typeof currentUserOrId === 'string'
        ? currentUserOrId
        : (idOrDto as string);
    const dto =
      typeof currentUserOrId === 'string'
        ? (idOrDto as CheckInLessonDto)
        : maybeDto;

    if (!dto) {
      throw new BadRequestException('签到参数不能为空');
    }

    const current = await this.findLessonOrThrow(id);
    if (currentUser) {
      this.ensureLessonAccess(currentUser, current);
    }

    if (current.attendanceStatus !== LessonAttendanceStatus.SCHEDULED) {
      throw new BadRequestException('只有待上课状态的课程才可以签到');
    }

    const checkInAt = dto.checkInAt
      ? this.parseDate(dto.checkInAt, 'checkInAt')
      : new Date();
    const startedAt = dto.startedAt
      ? this.parseDate(dto.startedAt, 'startedAt')
      : checkInAt;

    const lesson = await this.prisma.$transaction(async (tx) => {
      const updatedLesson = await tx.lesson.update({
        where: { id },
        data: {
          attendanceStatus: LessonAttendanceStatus.ONGOING,
          checkInAt,
          checkInLatitude: dto.checkInLatitude ?? null,
          checkInLongitude: dto.checkInLongitude ?? null,
          checkInAddress: dto.checkInAddress?.trim() || null,
          startedAt,
        },
        include: this.getLessonInclude(),
      });

      await tx.booking.update({
        where: { id: current.bookingId },
        data: {
          status: BookingStatus.IN_PROGRESS,
          settlementReadiness: SettlementReadiness.NOT_READY,
        },
      });

      return updatedLesson;
    });

    return this.toResponse(lesson);
  }

  async checkOut(
    currentUserOrId: AuthenticatedUserContext | string,
    idOrDto: string | CheckOutLessonDto,
    maybeDto?: CheckOutLessonDto,
  ): Promise<LessonResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id =
      typeof currentUserOrId === 'string'
        ? currentUserOrId
        : (idOrDto as string);
    const dto =
      typeof currentUserOrId === 'string'
        ? (idOrDto as CheckOutLessonDto)
        : maybeDto;

    if (!dto) {
      throw new BadRequestException('签退参数不能为空');
    }

    const current = await this.findLessonOrThrow(id);
    if (currentUser) {
      this.ensureLessonAccess(currentUser, current);
    }

    if (
      !this.hasAttendanceStatus(current.attendanceStatus, [
        LessonAttendanceStatus.SCHEDULED,
        LessonAttendanceStatus.ONGOING,
      ])
    ) {
      throw new BadRequestException('当前课程状态不允许签退');
    }

    const checkOutAt = dto.checkOutAt
      ? this.parseDate(dto.checkOutAt, 'checkOutAt')
      : new Date();
    const endedAt = dto.endedAt
      ? this.parseDate(dto.endedAt, 'endedAt')
      : checkOutAt;
    const startedAt =
      current.startedAt ?? current.checkInAt ?? current.booking.startAt;

    if (endedAt < startedAt) {
      throw new BadRequestException('课程结束时间不能早于开始时间');
    }

    const lesson = await this.prisma.$transaction(async (tx) => {
      const updatedLesson = await tx.lesson.update({
        where: { id },
        data: {
          attendanceStatus: LessonAttendanceStatus.COMPLETED,
          checkOutAt,
          checkOutLatitude: dto.checkOutLatitude ?? null,
          checkOutLongitude: dto.checkOutLongitude ?? null,
          checkOutAddress: dto.checkOutAddress?.trim() || null,
          endedAt,
          ...(current.startedAt ? {} : { startedAt }),
        },
        include: this.getLessonInclude(),
      });

      await tx.booking.update({
        where: { id: current.bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          completionStatus: BookingCompletionStatus.PENDING_TEACHER_RECORD,
          settlementReadiness: SettlementReadiness.NOT_READY,
        },
      });

      return updatedLesson;
    });

    return this.toResponse(lesson);
  }

  async updateAttendance(
    id: string,
    dto: UpdateLessonAttendanceDto,
  ): Promise<LessonResponseDto> {
    const current = await this.findLessonOrThrow(id);

    if (current.attendanceStatus === LessonAttendanceStatus.COMPLETED) {
      throw new BadRequestException('已完成课程不建议直接改出勤状态');
    }

    const lesson = await this.prisma.$transaction(async (tx) => {
      const updatedLesson = await tx.lesson.update({
        where: { id },
        data: {
          attendanceStatus: dto.attendanceStatus,
        },
        include: this.getLessonInclude(),
      });

      if (dto.attendanceStatus === LessonAttendanceStatus.CANCELLED) {
        await tx.booking.update({
          where: { id: current.bookingId },
          data: { status: BookingStatus.CANCELLED },
        });
      }

      return updatedLesson;
    });

    return this.toResponse(lesson);
  }

  async submitFeedback(
    currentUserOrId: AuthenticatedUserContext | string,
    idOrDto: string | SubmitLessonFeedbackDto,
    maybeDto?: SubmitLessonFeedbackDto,
  ): Promise<LessonResponseDto> {
    const currentUser =
      typeof currentUserOrId === 'string' ? undefined : currentUserOrId;
    const id =
      typeof currentUserOrId === 'string'
        ? currentUserOrId
        : (idOrDto as string);
    const dto =
      typeof currentUserOrId === 'string'
        ? (idOrDto as SubmitLessonFeedbackDto)
        : maybeDto;

    if (!dto) {
      throw new BadRequestException('课后反馈参数不能为空');
    }

    const current = await this.findLessonOrThrow(id);
    if (currentUser) {
      this.ensureLessonAccess(currentUser, current);
    }

    if (currentUser && current.booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('只有已完课的课程才可以提交课后反馈');
    }

    const feedbackSubmittedAt = dto.feedbackSubmittedAt
      ? this.parseDate(dto.feedbackSubmittedAt, 'feedbackSubmittedAt')
      : new Date();

    if (!currentUser) {
      const lesson = await this.prisma.lesson.update({
        where: { id },
        data: {
          teacherSummary:
            dto.teacherSummary !== undefined
              ? dto.teacherSummary.trim() || null
              : current.teacherSummary,
          homework:
            dto.homework !== undefined
              ? dto.homework.trim() || null
              : current.homework,
          outcomeVideoUrl:
            dto.outcomeVideoUrl !== undefined
              ? dto.outcomeVideoUrl.trim() || null
              : current.outcomeVideoUrl,
          guardianFeedback:
            dto.guardianFeedback !== undefined
              ? dto.guardianFeedback.trim() || null
              : current.guardianFeedback,
          feedbackSubmittedAt,
        },
        include: this.getLessonInclude(),
      });

      return this.toResponse(lesson);
    }

    const lesson = await this.prisma.$transaction(async (tx) => {
      const updatedLesson = await tx.lesson.update({
        where: { id },
        data: {
          teacherSummary:
            dto.teacherSummary !== undefined
              ? dto.teacherSummary.trim() || null
              : current.teacherSummary,
          homework:
            dto.homework !== undefined
              ? dto.homework.trim() || null
              : current.homework,
          outcomeVideoUrl:
            dto.outcomeVideoUrl !== undefined
              ? dto.outcomeVideoUrl.trim() || null
              : current.outcomeVideoUrl,
          guardianFeedback:
            dto.guardianFeedback !== undefined
              ? dto.guardianFeedback.trim() || null
              : current.guardianFeedback,
          feedbackSubmittedAt,
        },
        include: this.getLessonInclude(),
      });

      await tx.booking.update({
        where: { id: current.bookingId },
        data: {
          completionStatus: BookingCompletionStatus.PENDING_GUARDIAN_CONFIRM,
          settlementReadiness: SettlementReadiness.NOT_READY,
        },
      });

      return updatedLesson;
    });

    return this.toResponse(lesson);
  }

  async createEvidence(
    currentUser: AuthenticatedUserContext,
    id: string,
    dto: CreateLessonEvidenceDto,
  ): Promise<LessonResponseDto> {
    const current = await this.findLessonOrThrow(id);
    this.ensureLessonAccess(currentUser, current);

    await this.prisma.lessonEvidence.create({
      data: {
        lessonId: current.id,
        type: dto.type,
        url: dto.url,
        note: dto.note?.trim() || null,
        uploadedByUserId: currentUser.userId,
      },
    });

    const updated = await this.findLessonOrThrow(id);
    return this.toResponse(updated);
  }

  async remove(id: string): Promise<DeleteLessonResponseDto> {
    const current = await this.findLessonOrThrow(id);

    if (
      !this.hasAttendanceStatus(
        current.attendanceStatus,
        this.removableStatuses,
      )
    ) {
      throw new BadRequestException('当前课程状态不允许删除');
    }

    await this.prisma.lesson.delete({ where: { id } });
    return {
      success: true,
      message: '课程已删除',
    };
  }
}
