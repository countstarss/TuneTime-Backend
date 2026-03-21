import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlatformRole, Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CalendarItemDto,
  CalendarQueryDto,
  CalendarResponseDto,
} from './dto/calendar.dto';

type CalendarBookingRow = {
  id: string;
  teacherProfileId: string;
  studentProfileId: string;
  guardianProfileId: string | null;
  startAt: Date;
  endAt: Date;
  timezone: string;
  status: string;
  paymentStatus: string;
  statusRemark: string | null;
  isTrial: boolean;
  subject: {
    name: string;
  };
  teacherProfile: {
    id: string;
    userId: string;
    displayName: string;
  };
  studentProfile: {
    id: string;
    displayName: string;
    gradeLevel: string | null;
  };
  guardianProfile: {
    id: string;
    userId: string;
    displayName: string;
  } | null;
  serviceAddress: {
    province: string;
    city: string;
    district: string;
    street: string;
    building: string | null;
  };
  lesson: {
    id: string;
    attendanceStatus: string;
  } | null;
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(value: string, fieldName: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} 不是有效的日期时间`);
    }
    return parsed;
  }

  private buildAddressSummary(booking: CalendarBookingRow): string {
    return [
      booking.serviceAddress.province,
      booking.serviceAddress.city,
      booking.serviceAddress.district,
      booking.serviceAddress.street,
      booking.serviceAddress.building,
    ]
      .filter((item): item is string => Boolean(item && item.trim()))
      .join(' ');
  }

  private toItem(booking: CalendarBookingRow): CalendarItemDto {
    return {
      bookingId: booking.id,
      lessonId: booking.lesson?.id ?? null,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.timezone,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      attendanceStatus: booking.lesson?.attendanceStatus ?? null,
      subjectName: booking.subject.name,
      serviceAddressSummary: this.buildAddressSummary(booking),
      statusRemark: booking.statusRemark,
      isTrial: booking.isTrial,
      teacher: {
        id: booking.teacherProfile.id,
        displayName: booking.teacherProfile.displayName,
      },
      student: {
        id: booking.studentProfile.id,
        displayName: booking.studentProfile.displayName,
        gradeLevel: booking.studentProfile.gradeLevel,
      },
      guardian: {
        id: booking.guardianProfile?.id ?? null,
        displayName: booking.guardianProfile?.displayName ?? null,
      },
    };
  }

  private getBookingSelect() {
    return {
      id: true,
      teacherProfileId: true,
      studentProfileId: true,
      guardianProfileId: true,
      startAt: true,
      endAt: true,
      timezone: true,
      status: true,
      paymentStatus: true,
      statusRemark: true,
      isTrial: true,
      subject: {
        select: {
          name: true,
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
          displayName: true,
          gradeLevel: true,
        },
      },
      guardianProfile: {
        select: {
          id: true,
          userId: true,
          displayName: true,
        },
      },
      serviceAddress: {
        select: {
          province: true,
          city: true,
          district: true,
          street: true,
          building: true,
        },
      },
      lesson: {
        select: {
          id: true,
          attendanceStatus: true,
        },
      },
    } satisfies Prisma.BookingSelect;
  }

  private async resolveGuardianProfileId(userId: string): Promise<string> {
    const guardianProfile = await this.prisma.guardianProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!guardianProfile) {
      throw new NotFoundException('当前账号未找到家长档案');
    }

    return guardianProfile.id;
  }

  private async resolveTeacherProfileId(userId: string): Promise<string> {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!teacherProfile) {
      throw new NotFoundException('当前账号未找到老师档案');
    }

    return teacherProfile.id;
  }

  async getMyCalendar(
    currentUser: AuthenticatedUserContext,
    query: CalendarQueryDto,
  ): Promise<CalendarResponseDto> {
    const from = this.parseDate(query.from, 'from');
    const to = this.parseDate(query.to, 'to');

    if (to <= from) {
      throw new BadRequestException('课表时间范围不合法');
    }

    if (query.role === PlatformRole.GUARDIAN) {
      const guardianProfileId = await this.resolveGuardianProfileId(
        currentUser.userId,
      );
      const items = await this.prisma.booking.findMany({
        where: {
          guardianProfileId,
          startAt: { gte: from, lte: to },
        },
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        select: this.getBookingSelect(),
      });

      return { items: items.map((item) => this.toItem(item)) };
    }

    if (query.role === PlatformRole.TEACHER) {
      const teacherProfileId = await this.resolveTeacherProfileId(
        currentUser.userId,
      );
      const items = await this.prisma.booking.findMany({
        where: {
          teacherProfileId,
          startAt: { gte: from, lte: to },
        },
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        select: this.getBookingSelect(),
      });

      return { items: items.map((item) => this.toItem(item)) };
    }

    throw new ForbiddenException('当前角色不支持查看该课表');
  }
}
