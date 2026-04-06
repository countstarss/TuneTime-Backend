import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  Prisma,
  TeacherVerificationStatus,
  Weekday,
} from '@prisma/client';
import { isDevMvpRelaxationEnabled } from '../common/dev-mvp.util';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  AvailabilityWindowDto,
  AvailabilityWindowsResponseDto,
  CreateAvailabilityBlockDto,
  CreateAvailabilityExtraSlotDto,
  DiscoverTeacherDto,
  DiscoverTeachersQueryDto,
  DiscoverTeachersResponseDto,
  ReplaceWeeklyRulesDto,
  SearchAvailabilityTeacherDto,
  SearchTeacherAvailabilityDto,
  SearchTeacherAvailabilityResponseDto,
  TeacherAvailabilityConfigResponseDto,
} from './dto/teacher-availability.dto';

type AvailabilityRuleRecord = {
  id: string;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
};

type AvailabilityBlockRecord = {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
};

type BookingConflictRecord = {
  id: string;
  startAt: Date;
  endAt: Date;
};

type TeacherSearchRecord = {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  employmentType: string | null;
  verificationStatus: TeacherVerificationStatus;
  baseHourlyRate: Prisma.Decimal;
  ratingAvg: Prisma.Decimal;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  subjects: Array<{
    subject: {
      id: string;
      code: string;
      name: string;
    };
    experienceYears: number;
    isActive: boolean;
  }>;
  credentials: Array<{
    name: string;
  }>;
  serviceAreas: Array<{
    district: string;
  }>;
};

@Injectable()
export class TeacherAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly devMvpRelaxationEnabled = isDevMvpRelaxationEnabled();

  private readonly conflictStatuses: BookingStatus[] = [
    BookingStatus.PENDING_ACCEPTANCE,
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
  ];

  private readonly weekdayMap = new Map<number, Weekday>([
    [0, Weekday.SUNDAY],
    [1, Weekday.MONDAY],
    [2, Weekday.TUESDAY],
    [3, Weekday.WEDNESDAY],
    [4, Weekday.THURSDAY],
    [5, Weekday.FRIDAY],
    [6, Weekday.SATURDAY],
  ]);

  private readonly zonedDateTimeFormatters = new Map<
    string,
    Intl.DateTimeFormat
  >();

  private toNumber(value: Prisma.Decimal | number): number {
    return Number(value);
  }

  private parseDateTime(value: string, fieldName: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} 不是有效时间`);
    }
    return parsed;
  }

  private parseDateOnly(value: string, fieldName: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} 不是有效日期`);
    }
    return parsed;
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private endOfUtcDay(value: Date): Date {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }

  private addUtcDays(value: Date, days: number): Date {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate() + days,
        value.getUTCHours(),
        value.getUTCMinutes(),
        value.getUTCSeconds(),
        value.getUTCMilliseconds(),
      ),
    );
  }

  private getZonedDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
    const existing = this.zonedDateTimeFormatters.get(timeZone);
    if (existing) {
      return existing;
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    this.zonedDateTimeFormatters.set(timeZone, formatter);
    return formatter;
  }

  private getZonedDateParts(
    date: Date,
    timeZone: string,
  ): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } {
    const parts = this.getZonedDateTimeFormatter(timeZone).formatToParts(date);
    const partMap = new Map(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return {
      year: Number(partMap.get('year')),
      month: Number(partMap.get('month')),
      day: Number(partMap.get('day')),
      hour: Number(partMap.get('hour')),
      minute: Number(partMap.get('minute')),
      second: Number(partMap.get('second')),
    };
  }

  private getTimeZoneOffsetMs(date: Date, timeZone: string): number {
    const parts = this.getZonedDateParts(date, timeZone);
    const asUtcTimestamp = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    );

    return asUtcTimestamp - date.getTime();
  }

  private zonedDateTimeToUtc(params: {
    timeZone: string;
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  }): Date {
    const baseUtcTimestamp = Date.UTC(
      params.year,
      params.month - 1,
      params.day,
      params.hour ?? 0,
      params.minute ?? 0,
      params.second ?? 0,
      0,
    );

    let resolvedTimestamp = baseUtcTimestamp;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const offsetMs = this.getTimeZoneOffsetMs(
        new Date(resolvedTimestamp),
        params.timeZone,
      );
      const candidateTimestamp = baseUtcTimestamp - offsetMs;
      if (candidateTimestamp === resolvedTimestamp) {
        break;
      }
      resolvedTimestamp = candidateTimestamp;
    }

    return new Date(resolvedTimestamp);
  }

  private toLocalDateHolder(date: Date, timeZone: string): Date {
    const parts = this.getZonedDateParts(date, timeZone);
    return new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0),
    );
  }

  private localDateKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addLocalDays(date: Date, days: number): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + days,
        0,
        0,
        0,
        0,
      ),
    );
  }

  private overlap(
    leftStart: Date,
    leftEnd: Date,
    rightStart: Date,
    rightEnd: Date,
  ): boolean {
    return leftStart < rightEnd && leftEnd > rightStart;
  }

  private buildExtraSlotDate(rule: AvailabilityRuleRecord): string {
    const date = rule.effectiveFrom ?? rule.effectiveTo;
    const safeDate = date ?? new Date();
    return this.localDateKey(this.startOfUtcDay(safeDate));
  }

  private isDateSpecificRule(rule: AvailabilityRuleRecord): boolean {
    if (!rule.effectiveFrom || !rule.effectiveTo) {
      return false;
    }

    return (
      this.startOfUtcDay(rule.effectiveFrom).getTime() ===
      this.startOfUtcDay(rule.effectiveTo).getTime()
    );
  }

  private isRuleActiveOnDate(
    rule: AvailabilityRuleRecord,
    localDate: Date,
  ): boolean {
    if (!rule.isActive) {
      return false;
    }

    const day = this.startOfUtcDay(localDate).getTime();
    const from = rule.effectiveFrom
      ? this.startOfUtcDay(rule.effectiveFrom).getTime()
      : null;
    const to = rule.effectiveTo
      ? this.startOfUtcDay(rule.effectiveTo).getTime()
      : null;

    if (from != null && day < from) {
      return false;
    }
    if (to != null && day > to) {
      return false;
    }

    if (this.isDateSpecificRule(rule)) {
      return from === day;
    }

    return this.weekdayMap.get(localDate.getUTCDay()) === rule.weekday;
  }

  private buildSlotsFromRule(
    rule: AvailabilityRuleRecord,
    localDate: Date,
    timezone: string,
  ): AvailabilityWindowDto[] {
    const windows: AvailabilityWindowDto[] = [];
    let cursor = rule.startMinute;

    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth() + 1;
    const day = localDate.getUTCDate();

    while (cursor + rule.slotDurationMinutes <= rule.endMinute) {
      const startAt = this.zonedDateTimeToUtc({
        timeZone: timezone,
        year,
        month,
        day,
        hour: Math.floor(cursor / 60),
        minute: cursor % 60,
      });
      const endAt = this.zonedDateTimeToUtc({
        timeZone: timezone,
        year,
        month,
        day,
        hour: Math.floor((cursor + rule.slotDurationMinutes) / 60),
        minute: (cursor + rule.slotDurationMinutes) % 60,
      });

      windows.push({
        startAt,
        endAt,
        timezone,
        weekday: this.weekdayMap.get(localDate.getUTCDay()) ?? Weekday.MONDAY,
        durationMinutes: rule.slotDurationMinutes,
      });

      cursor += rule.slotDurationMinutes + rule.bufferMinutes;
    }

    return windows;
  }

  private async resolveTeacherProfileIdForCurrentUser(
    currentUser: AuthenticatedUserContext,
  ): Promise<string> {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });

    if (!teacherProfile) {
      throw new NotFoundException('当前账号未找到老师档案');
    }

    return teacherProfile.id;
  }

  private async ensureTeacherExists(teacherProfileId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      select: { id: true, timezone: true },
    });

    if (!teacher) {
      throw new NotFoundException(`未找到老师档案：${teacherProfileId}`);
    }

    return teacher;
  }

  private async loadAvailabilityInputs(
    teacherProfileId: string,
    from: Date,
    to: Date,
  ) {
    const [teacher, rules, blocks, bookings] = await Promise.all([
      this.ensureTeacherExists(teacherProfileId),
      this.prisma.teacherAvailabilityRule.findMany({
        where: {
          teacherProfileId,
          isActive: true,
          OR: [
            { effectiveFrom: null, effectiveTo: null },
            {
              AND: [
                {
                  OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: to } }],
                },
                {
                  OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
                },
              ],
            },
          ],
        },
        orderBy: [
          { weekday: 'asc' },
          { effectiveFrom: 'asc' },
          { startMinute: 'asc' },
        ],
      }),
      this.prisma.teacherAvailabilityBlock.findMany({
        where: {
          teacherProfileId,
          startAt: { lt: to },
          endAt: { gt: from },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          teacherProfileId,
          status: { in: this.conflictStatuses },
          startAt: { lt: to },
          endAt: { gt: from },
        },
        select: { id: true, startAt: true, endAt: true },
      }),
    ]);

    return {
      timezone: teacher.timezone,
      rules,
      blocks,
      bookings,
    };
  }

  private async computeAvailabilityWindows(
    teacherProfileId: string,
    from: Date,
    to: Date,
  ): Promise<AvailabilityWindowDto[]> {
    if (from >= to) {
      throw new BadRequestException('时间范围不合法');
    }

    const { timezone, rules, blocks, bookings } =
      await this.loadAvailabilityInputs(teacherProfileId, from, to);
    const windows: AvailabilityWindowDto[] = [];
    const seen = new Set<string>();
    const dayStart = this.toLocalDateHolder(from, timezone);
    const inclusiveEnd = new Date(to.getTime() - 1);
    const dayEnd = this.toLocalDateHolder(inclusiveEnd, timezone);

    for (
      let currentDay = dayStart;
      currentDay.getTime() <= dayEnd.getTime();
      currentDay = this.addLocalDays(currentDay, 1)
    ) {
      const activeRules = rules.filter((rule) =>
        this.isRuleActiveOnDate(rule, currentDay),
      );

      for (const rule of activeRules) {
        for (const slot of this.buildSlotsFromRule(
          rule,
          currentDay,
          timezone,
        )) {
          if (slot.startAt < from || slot.endAt > to) {
            continue;
          }

          const hasBlockConflict = blocks.some((block) =>
            this.overlap(slot.startAt, slot.endAt, block.startAt, block.endAt),
          );
          if (hasBlockConflict) {
            continue;
          }

          const hasBookingConflict = bookings.some((booking) =>
            this.overlap(
              slot.startAt,
              slot.endAt,
              booking.startAt,
              booking.endAt,
            ),
          );
          if (hasBookingConflict) {
            continue;
          }

          const key = `${slot.startAt.toISOString()}_${slot.endAt.toISOString()}`;
          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          windows.push(slot);
        }
      }
    }

    windows.sort(
      (left, right) => left.startAt.getTime() - right.startAt.getTime(),
    );
    return windows;
  }

  private async loadDiscoverableTeacherSearchRecords(): Promise<
    TeacherSearchRecord[]
  > {
    return (await this.prisma.teacherProfile.findMany({
      where: {
        ...(this.devMvpRelaxationEnabled
          ? {
              // FIXME(dev-mvp): 为了在开发阶段跑通“新老师完成资料后即可被家长发现并下单”的闭环，
              // 这里临时放宽老师发现条件，不再强制要求审核通过。
              onboardingCompletedAt: { not: null },
            }
          : {
              verificationStatus: TeacherVerificationStatus.APPROVED,
            }),
        subjects: {
          some: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        bio: true,
        employmentType: true,
        verificationStatus: true,
        baseHourlyRate: true,
        ratingAvg: true,
        ratingCount: true,
        createdAt: true,
        updatedAt: true,
        subjects: {
          where: { isActive: true },
          select: {
            experienceYears: true,
            isActive: true,
            subject: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        credentials: {
          select: {
            name: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        serviceAreas: {
          select: { district: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: [
        { ratingAvg: 'desc' },
        { ratingCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })) as TeacherSearchRecord[];
  }

  private toTeacherSummary(
    teacher: TeacherSearchRecord,
  ): Omit<DiscoverTeacherDto, 'previewWindows'> &
    Omit<SearchAvailabilityTeacherDto, 'matchingWindows'> {
    return {
      id: teacher.id,
      userId: teacher.userId,
      displayName: teacher.displayName,
      bio: teacher.bio,
      baseHourlyRate: this.toNumber(teacher.baseHourlyRate),
      district: teacher.serviceAreas[0]?.district ?? null,
      ratingAvg: this.toNumber(teacher.ratingAvg),
      ratingCount: teacher.ratingCount,
      experienceYears: Math.max(
        ...teacher.subjects.map((item) => item.experienceYears),
        0,
      ),
      verificationStatus: teacher.verificationStatus,
      employmentType: teacher.employmentType ?? 'PART_TIME',
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
      subjects: teacher.subjects.map((item) => item.subject.name),
      subjectIds: teacher.subjects.map((item) => item.subject.id),
      primarySubjectId: teacher.subjects[0]?.subject.id ?? null,
      credentials: teacher.credentials.map((item) => item.name),
    };
  }

  async getTeacherAvailabilityWindows(
    teacherProfileId: string,
    params: {
      from: string;
      to: string;
    },
  ): Promise<AvailabilityWindowsResponseDto> {
    const from = this.parseDateTime(params.from, 'from');
    const to = this.parseDateTime(params.to, 'to');

    return {
      teacherProfileId,
      windows: await this.computeAvailabilityWindows(
        teacherProfileId,
        from,
        to,
      ),
    };
  }

  async hasSellableWindow(
    teacherProfileId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<boolean> {
    const windows = await this.computeAvailabilityWindows(
      teacherProfileId,
      startAt,
      endAt,
    );
    return windows.some(
      (window) =>
        window.startAt.getTime() === startAt.getTime() &&
        window.endAt.getTime() === endAt.getTime(),
    );
  }

  async listDiscoverTeachers(
    query: DiscoverTeachersQueryDto,
  ): Promise<DiscoverTeachersResponseDto> {
    const from = query.from
      ? this.parseDateTime(query.from, 'from')
      : new Date();
    const to = query.to
      ? this.parseDateTime(query.to, 'to')
      : this.addUtcDays(from, 14);

    if (from >= to) {
      throw new BadRequestException('时间范围不合法');
    }

    const teachers = await this.loadDiscoverableTeacherSearchRecords();
    const items = await Promise.all(
      teachers.map(async (teacher) => {
        const previewWindows = (
          await this.computeAvailabilityWindows(teacher.id, from, to)
        ).slice(0, query.windowLimit);

        return {
          ...this.toTeacherSummary(teacher),
          previewWindows,
        };
      }),
    );

    return { items };
  }

  async searchTeachersByAvailability(
    dto: SearchTeacherAvailabilityDto,
  ): Promise<SearchTeacherAvailabilityResponseDto> {
    const startAt = this.parseDateTime(dto.startAt, 'startAt');
    const endAt = new Date(startAt.getTime() + dto.durationMinutes * 60 * 1000);
    const keyword = dto.subject.trim();

    const teachers = await this.prisma.teacherProfile.findMany({
      where: {
        ...(this.devMvpRelaxationEnabled
          ? {
              // FIXME(dev-mvp): 为了在开发阶段跑通“新老师完成资料后即可被家长搜索并下单”的闭环，
              // 这里临时放宽老师搜索条件，不再强制要求审核通过。
              onboardingCompletedAt: { not: null },
            }
          : {
              verificationStatus: TeacherVerificationStatus.APPROVED,
            }),
        subjects: {
          some: {
            isActive: true,
            subject: {
              OR: [
                { id: keyword },
                { code: { equals: keyword.toUpperCase() } },
                {
                  name: {
                    contains: keyword,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        bio: true,
        employmentType: true,
        verificationStatus: true,
        baseHourlyRate: true,
        ratingAvg: true,
        ratingCount: true,
        createdAt: true,
        updatedAt: true,
        subjects: {
          where: { isActive: true },
          select: {
            experienceYears: true,
            isActive: true,
            subject: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        credentials: {
          select: {
            name: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        serviceAreas: {
          select: { district: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
    });

    const items: SearchAvailabilityTeacherDto[] = [];
    for (const teacher of teachers as TeacherSearchRecord[]) {
      const windows = await this.computeAvailabilityWindows(
        teacher.id,
        startAt,
        endAt,
      );
      const matchingWindows = windows.filter(
        (window) => window.startAt.getTime() === startAt.getTime(),
      );

      if (matchingWindows.length === 0) {
        continue;
      }

      items.push({
        ...this.toTeacherSummary(teacher),
        matchingWindows,
      });
    }

    return { items };
  }

  async getSelfAvailabilityConfig(
    currentUser: AuthenticatedUserContext,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    const teacherProfileId =
      await this.resolveTeacherProfileIdForCurrentUser(currentUser);
    const now = new Date();
    const next30Days = this.addUtcDays(now, 30);
    const [rules, blocks] = await Promise.all([
      this.prisma.teacherAvailabilityRule.findMany({
        where: {
          teacherProfileId,
          isActive: true,
        },
        orderBy: [
          { effectiveFrom: 'asc' },
          { weekday: 'asc' },
          { startMinute: 'asc' },
        ],
      }),
      this.prisma.teacherAvailabilityBlock.findMany({
        where: {
          teacherProfileId,
          endAt: { gte: now },
        },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    const weeklyRules = rules.filter((rule) => !this.isDateSpecificRule(rule));
    const extraSlots = rules.filter((rule) => this.isDateSpecificRule(rule));

    return {
      teacherProfileId,
      weeklyRules: weeklyRules.map((rule) => ({
        id: rule.id,
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
        slotDurationMinutes: rule.slotDurationMinutes,
        bufferMinutes: rule.bufferMinutes,
      })),
      blocks: blocks
        .filter((block) => block.startAt <= next30Days)
        .map((block) => ({
          id: block.id,
          startAt: block.startAt,
          endAt: block.endAt,
          reason: block.reason,
        })),
      extraSlots: extraSlots
        .filter((rule) => {
          const date = rule.effectiveFrom ?? rule.effectiveTo;
          return (
            date != null &&
            date >= this.startOfUtcDay(now) &&
            date <= next30Days
          );
        })
        .map((rule) => ({
          id: rule.id,
          date: this.buildExtraSlotDate(rule),
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          slotDurationMinutes: rule.slotDurationMinutes,
          bufferMinutes: rule.bufferMinutes,
        })),
    };
  }

  async replaceSelfWeeklyRules(
    currentUser: AuthenticatedUserContext,
    dto: ReplaceWeeklyRulesDto,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    const teacherProfileId =
      await this.resolveTeacherProfileIdForCurrentUser(currentUser);
    for (const item of dto.items) {
      if (item.startMinute >= item.endMinute) {
        throw new BadRequestException('周模板开始时间必须早于结束时间');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherAvailabilityRule.deleteMany({
        where: {
          teacherProfileId,
          OR: [{ effectiveFrom: null }, { effectiveTo: null }],
        },
      });

      if (dto.items.length > 0) {
        await tx.teacherAvailabilityRule.createMany({
          data: dto.items.map((item) => ({
            teacherProfileId,
            weekday: item.weekday,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            slotDurationMinutes: item.slotDurationMinutes,
            bufferMinutes: item.bufferMinutes,
            isActive: true,
            effectiveFrom: null,
            effectiveTo: null,
          })),
        });
      }
    });

    return this.getSelfAvailabilityConfig(currentUser);
  }

  async createSelfAvailabilityBlock(
    currentUser: AuthenticatedUserContext,
    dto: CreateAvailabilityBlockDto,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    const teacherProfileId =
      await this.resolveTeacherProfileIdForCurrentUser(currentUser);
    const startAt = this.parseDateTime(dto.startAt, 'startAt');
    const endAt = this.parseDateTime(dto.endAt, 'endAt');

    if (startAt >= endAt) {
      throw new BadRequestException('封锁开始时间必须早于结束时间');
    }

    await this.prisma.teacherAvailabilityBlock.create({
      data: {
        teacherProfileId,
        startAt,
        endAt,
        reason: dto.reason?.trim() || null,
        createdByUserId: currentUser.userId,
      },
    });

    return this.getSelfAvailabilityConfig(currentUser);
  }

  async deleteSelfAvailabilityBlock(
    currentUser: AuthenticatedUserContext,
    blockId: string,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    const teacherProfileId =
      await this.resolveTeacherProfileIdForCurrentUser(currentUser);
    const block = await this.prisma.teacherAvailabilityBlock.findUnique({
      where: { id: blockId },
      select: { id: true, teacherProfileId: true },
    });

    if (!block) {
      throw new NotFoundException(`未找到封锁时段：${blockId}`);
    }

    if (block.teacherProfileId !== teacherProfileId) {
      throw new ForbiddenException('不能删除其他老师的封锁时段');
    }

    await this.prisma.teacherAvailabilityBlock.delete({
      where: { id: blockId },
    });
    return this.getSelfAvailabilityConfig(currentUser);
  }

  async createSelfExtraSlot(
    currentUser: AuthenticatedUserContext,
    dto: CreateAvailabilityExtraSlotDto,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    const teacherProfileId =
      await this.resolveTeacherProfileIdForCurrentUser(currentUser);
    if (dto.startMinute >= dto.endMinute) {
      throw new BadRequestException('临时开放开始时间必须早于结束时间');
    }

    const date = this.parseDateOnly(dto.date, 'date');
    const weekday = this.weekdayMap.get(date.getUTCDay()) ?? Weekday.MONDAY;

    await this.prisma.teacherAvailabilityRule.create({
      data: {
        teacherProfileId,
        weekday,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        slotDurationMinutes: dto.slotDurationMinutes,
        bufferMinutes: dto.bufferMinutes,
        isActive: true,
        effectiveFrom: date,
        effectiveTo: date,
      },
    });

    return this.getSelfAvailabilityConfig(currentUser);
  }

  async deleteSelfExtraSlot(
    currentUser: AuthenticatedUserContext,
    ruleId: string,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    const teacherProfileId =
      await this.resolveTeacherProfileIdForCurrentUser(currentUser);
    const rule = await this.prisma.teacherAvailabilityRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        teacherProfileId: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(`未找到临时开放时段：${ruleId}`);
    }

    if (rule.teacherProfileId !== teacherProfileId) {
      throw new ForbiddenException('不能删除其他老师的临时开放时段');
    }

    if (!rule.effectiveFrom || !rule.effectiveTo) {
      throw new BadRequestException('当前规则不是临时开放时段');
    }

    await this.prisma.teacherAvailabilityRule.delete({ where: { id: ruleId } });
    return this.getSelfAvailabilityConfig(currentUser);
  }
}
